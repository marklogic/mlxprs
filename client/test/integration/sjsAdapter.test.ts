/* eslint-disable @typescript-eslint/no-use-before-define */
import * as assert from 'assert'
import { after, before } from 'mocha'
import { MarklogicClient, MlClientParameters, sendJSQuery } from '../../marklogicClient'
import { _connectServer, _disconnectServer } from '../../JSDebugger/configurationProvider'
import * as vscode from 'vscode'
import * as Path from 'path'
import { DebugClient } from 'vscode-debugadapter-testsupport'
import { DebugProtocol } from 'vscode-debugprotocol'
import * as CP from 'child_process'
import * as fs from 'fs'

import { getRid, wait } from './integrationTestHelper'



suite('JavaScript Debug Test Suite', () => {
    const wcfg = vscode.workspace.getConfiguration()
    const hostname = String(wcfg.get('marklogic.host'))
    const port = Number(wcfg.get('marklogic.port'))
    const username = String(wcfg.get('marklogic.username'))
    const password = String(wcfg.get('marklogic.password'))
    const modulesDB = String(wcfg.get('marklogic.modulesDb'))
    const pathToCa = String(wcfg.get('marklogic.pathToCa') || '')
    const ssl = Boolean(wcfg.get('marklogic.ssl'))
    const rejectUnauthorized = Boolean(wcfg.get('marklogic.rejectUnauthorized'))

    const rootFolder = Path.join(__dirname, '../../../')
    const exec = Path.join(rootFolder, 'dist/mlDebug.js')
    const scriptFolder = Path.join(rootFolder, 'client/test/integration/jsScripts')

    let dc: DebugClient
    const mlClient = new MarklogicClient(
        new MlClientParameters({
            host: hostname,
            port: port,
            user: username,
            pwd: password,
            authType: 'DIGEST',
            contentDb: modulesDB,
            modulesDb: modulesDB,
            pathToCa: pathToCa,
            ssl: ssl,
            rejectUnauthorized: rejectUnauthorized
        })
    )

    const module1 = Path.join(rootFolder, 'client/test/integration/jsScripts/MarkLogic/test/test.sjs')
    const module2 = Path.join(rootFolder, 'client/test/integration/jsScripts/MarkLogic/test/lib1.sjs')
    const module3 = Path.join(rootFolder, 'client/test/integration/jsScripts/MarkLogic/test/lib2.sjs')
    const module4 = Path.join(rootFolder, 'client/test/integration/jsScripts/MarkLogic/test/invoke1.xqy')
    const module5 = Path.join(rootFolder, 'client/test/integration/jsScripts/helloWorld.sjs')

    const module6 = Path.join(rootFolder, 'client/test/integration/jsScripts/MarkLogic/test/jsInvoke-1.sjs')
    const module7 = Path.join(rootFolder, 'client/test/integration/jsScripts/MarkLogic/test/xqyInvoke-1.xqy')
    const module8 = Path.join(rootFolder, 'client/test/integration/jsScripts/MarkLogic/test/jsInvoke-2.sjs')

    const debugServerModules = [module1, module2, module3, module4, module5, module6]
    const taskServerModules = [module6, module7, module8]
    const collection = 'VSCODE/SJS-debug-test'

    const hwPath = Path.join(scriptFolder, 'helloWorld.sjs')
    const config = {
        program: hwPath,
        queryText: fs.readFileSync(hwPath).toString(),
        username: username, password: password,
        hostname: hostname, authType: 'DIGEST',
        ssl: ssl, pathToCa: pathToCa, rejectUnauthorized: rejectUnauthorized }

    before(async () => {
        // load test data
        _connectServer('JSdebugTestServer')
        const requests = []
        debugServerModules.forEach(async (fsModulePath) => {
            const fname = Path.basename(fsModulePath)
            const module = fs.readFileSync(fsModulePath)
            const qry = `declareUpdate(); let textNode = new NodeBuilder();
                textNode.addText(\`${module}\`);
                const options = {collections: '${collection}'};
                xdmp.documentInsert("/MarkLogic/test/${fname}", textNode.toNode(), options);`
            requests.push(sendJSQuery(mlClient, qry))
        })
        taskServerModules.forEach(async (fsModulePath) => {
            const fname = Path.basename(fsModulePath)
            const module = fs.readFileSync(fsModulePath)
            const qry = `declareUpdate(); let textNode = new NodeBuilder();
                textNode.addText(\`${module}\`);
                const options = {collections: '${collection}'};
                xdmp.documentInsert("Apps/MarkLogic/test/${fname}", textNode.toNode(), options);`
            requests.push(sendJSQuery(mlClient, qry))
        })
        return Promise.all(requests).then(resp => {
            console.debug(`response: ${JSON.stringify(resp)}`)
        }).catch(err => {
            console.error(`Error uploading modules: ${JSON.stringify(err)}`)
        }).finally(() => {
            vscode.window.showInformationMessage('SJS Debugger Tests starting...')
        })
    })

    after(async () => {
        // delete test data
        _disconnectServer('JSdebugTestServer')
        sendJSQuery(mlClient, `declareUpdate(); xdmp.collectionDelete('${collection}')`)
            .result(
                () => {
                    console.debug(`Removed ${collection} modules after SJS debugger tests.`)
                    return
                },
                (err: any) => {
                    console.error(`Error removing modules after tests: ${JSON.stringify(err)}`)
                })
            .then(() => {
                vscode.window.showInformationMessage('SJS Debugger tests done!')
            })
    })

    setup(() => {
        dc = new DebugClient('node', exec, 'node')
        return dc.start()
    })

    teardown(async () => {
        dc.stop()
    })

    // testing commands
    suite('Basic', () => {
        test('launch a script and it should stop at entry', async () => {
            return Promise.all([
                dc.configurationSequence(),
                dc.launch(config),
                dc.assertStoppedLocation('entry', { path: config.program, line: 1 })
            ])
        }).timeout(5000)

        test('check stepOver', async () => {
            await Promise.all([
                dc.configurationSequence(),
                dc.launch(config)
            ])
            // 2 steps will actually go to the second line
            await dc.nextRequest({ threadId: 1 })
            await dc.waitForEvent('stopped')
            await dc.nextRequest({ threadId: 1 })
            return dc.assertStoppedLocation('step', { path: config.program, line: 4 })
        }).timeout(5000)

        test('set breakpoint', async () => {
            await Promise.all([
                dc.configurationSequence(),
                dc.launch(config)
            ])
            await dc.setBreakpointsRequest({ source: { path: config.program }, breakpoints: [{ line: 4 }] })
            await dc.continueRequest({ threadId: 1 })
            return dc.assertStoppedLocation('breakpoint', { path: config.program, line: 4 })
        }).timeout(5000)

        test('check stepInto', async () => {
            await Promise.all([
                dc.configurationSequence(),
                dc.launch(config)
            ])
            await dc.setBreakpointsRequest({ source: { path: config.program }, breakpoints: [{ line: 6 }] })
            await dc.continueRequest({ threadId: 1 })
            await dc.waitForEvent('stopped')
            await dc.stepInRequest({ threadId: 1 })
            return dc.assertStoppedLocation('step', { path: config.program, line: 12 })
        }).timeout(5000)

        test('check stepOut', async () => {
            await Promise.all([
                dc.configurationSequence(),
                dc.launch(config)
            ])
            await dc.setBreakpointsRequest({ source: { path: config.program }, breakpoints: [{ line: 12 }] })
            await dc.continueRequest({ threadId: 1 })
            await dc.waitForEvent('stopped')
            await dc.stepOutRequest({ threadId: 1 })
            return dc.assertStoppedLocation('step', { path: config.program, line: 7 })
        }).timeout(5000)

        test('check stack trace', async () => {
            await Promise.all([
                dc.configurationSequence(),
                dc.launch(config)
            ])
            await dc.setBreakpointsRequest({ source: { path: config.program }, breakpoints: [{ line: 12 }] })
            await dc.continueRequest({ threadId: 1 })
            const stackTrace = await dc.assertStoppedLocation('breakpoint', { path: config.program, line: 12 })
            const frame = stackTrace.body.stackFrames[0]
            assert(frame.name, 'loop')
            assert(frame.line, '12')
            return
        }).timeout(5000)

        test('check variable', async () => {
            await Promise.all([
                dc.configurationSequence(),
                dc.launch(config)
            ])
            await dc.setBreakpointsRequest({ source: { path: config.program }, breakpoints: [{ line: 12 }] })
            await dc.continueRequest({ threadId: 1 })
            const stackTrace = await dc.assertStoppedLocation('breakpoint', { path: config.program, line: 12 })
            const frameId = stackTrace.body.stackFrames[0].id
            const scope = await dc.scopesRequest({ frameId: frameId })
            const vars = await dc.variablesRequest({ variablesReference: scope.body.scopes[0].variablesReference })
            return assert.equal(vars.body.variables[0].name, 'ret')

        }).timeout(5000)

        test('check evaluate', async () => {
            await Promise.all([
                dc.configurationSequence(),
                dc.launch(config)
            ])
            await dc.setBreakpointsRequest({ source: { path: config.program }, breakpoints: [{ line: 12 }] })
            await dc.continueRequest({ threadId: 1 })
            await dc.waitForEvent('stopped')
            const evalResult = await dc.evaluateRequest({ expression: 'str' })
            return assert.equal(evalResult.body.result, 'Hello World SJS')

        }).timeout(5000)

        test('check conditional breakpoint', async () => {
            await Promise.all([
                dc.configurationSequence(),
                dc.launch(config)
            ])
            await dc.setBreakpointsRequest({ source: { path: config.program }, breakpoints: [{ line: 14, condition: 'i==15' }] })
            await dc.continueRequest({ threadId: 1 })
            await dc.waitForEvent('stopped')
            const evalResult = await dc.evaluateRequest({ expression: 'ret' })
            return assert.equal(evalResult.body.result, '105')
        }).timeout(5000)
    })

    suite('Testing sjs/xqy boundary in eval/invoke', async () => {
        test('sjs calling xdmp:eval()', async () => {
            config.program = Path.join(scriptFolder, 'eval2.sjs')
            config.queryText = fs.readFileSync(config.program).toString()

            await Promise.all([
                dc.configurationSequence(),
                dc.launch(config)
            ])
            await dc.setBreakpointsRequest({ source: { path: config.program }, breakpoints: [{ line: 4 }] })
            await dc.continueRequest({ threadId: 1 })
            await dc.assertStoppedLocation('breakpoint', { path: config.program, line: 4 })
            await dc.stepInRequest({ threadId: 1 })
            return dc.assertStoppedLocation('step', { path: config.program, line: 8 })
        }).timeout(25000)

        test('sjs calling xdmp:invoke()', async () => {
            config.program = Path.join(scriptFolder, 'invoke2.sjs')
            config.queryText = fs.readFileSync(config.program).toString()

            await Promise.all([
                dc.configurationSequence(),
                dc.launch(config)
            ])
            await dc.setBreakpointsRequest({ source: { path: config.program }, breakpoints: [{ line: 4 }] })
            await dc.continueRequest({ threadId: 1 })
            await dc.assertStoppedLocation('breakpoint', { path: config.program, line: 4 })
            await dc.stepInRequest({ threadId: 1 })
            return dc.assertStoppedLocation('step', { path: config.program, line: 6 })
        }).timeout(5000)

        test('sjs importing xqy', async () => {
            config.program = Path.join(scriptFolder, 'eval3.sjs')
            config.queryText = fs.readFileSync(config.program).toString()

            await Promise.all([
                dc.configurationSequence(),
                dc.launch(config)
            ])
            await dc.setBreakpointsRequest({ source: { path: config.program }, breakpoints: [{ line: 4 }] })
            await dc.continueRequest({ threadId: 1 })
            await dc.assertStoppedLocation('breakpoint', { path: config.program, line: 4 })
            await dc.stepInRequest({ threadId: 1 })
            return dc.assertStoppedLocation('step', { path: config.program, line: 6 })
        }).timeout(15000)

        test('xqy calling xdmp.invoke()', async () => {
            CP.exec(`curl --anyauth -k --user ${username}:${password} -i -X POST -H "Content-type: application/x-www-form-urlencoded" \
                http${ssl ? 's' : ''}://${hostname}:8055/LATEST/invoke --data-urlencode module=/MarkLogic/test/invoke1.xqy`)
            await wait(100)
            const resp = await getRid(mlClient, 'xdmp.serverStatus(xdmp.host(),xdmp.server("JSdebugTestServer")).toObject()[0].requestStatuses[0].requestId')
            const rid = resp[0]
            const root = Path.join(scriptFolder, 'MarkLogic/test')
            const config = {
                rid: rid, root: root,
                username: username, password: password,
                hostname: hostname, database: 'Modules', modules: 'Modules', authType: 'DIGEST',
                ssl: ssl, pathToCa: pathToCa, rejectUnauthorized: rejectUnauthorized
            }
            await Promise.all([
                dc.initializeRequest(),
                dc.configurationSequence(),
                dc.attachRequest(config as DebugProtocol.AttachRequestArguments)
            ])

            await dc.setBreakpointsRequest({ source: { path: Path.join('/MarkLogic/test', 'jsInvoke-1.sjs') }, breakpoints: [{ line: 3 }] })
            await dc.continueRequest({ threadId: 1 })
            return dc.assertStoppedLocation('breakpoint', { path: Path.join('/MarkLogic/test', 'jsInvoke-1.sjs'), line: 3 })
        }).timeout(10000).skip()

    })
})
