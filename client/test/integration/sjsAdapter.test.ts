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



suite('JavaScript Debug Test Suite', () => {
    const wcfg = vscode.workspace.getConfiguration()
    const hostname = String(wcfg.get('marklogic.host'))
    const port = Number(wcfg.get('marklogic.port'))
    const username = String(wcfg.get('marklogic.username'))
    const password = String(wcfg.get('marklogic.password'))
    const modulesDB = String(wcfg.get('marklogic.modulesDb'))
    const pathToCa = String(wcfg.get('marklogic.pathToCa'))

    const rootFolder = Path.join(__dirname, '../../../')
    const exec = Path.join(rootFolder, 'dist/mlDebug.js')
    const scriptFolder = Path.join(rootFolder, 'client/test/jsScripts')

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
            pathToCa: pathToCa
        })
    )

    const module1 = Path.join(rootFolder, 'client/test/jsScripts/MarkLogic/test/test.sjs')
    const module2 = Path.join(rootFolder, 'client/test/jsScripts/MarkLogic/test/lib1.sjs')
    const module3 = Path.join(rootFolder, 'client/test/jsScripts/MarkLogic/test/lib2.sjs')
    const module4 = Path.join(rootFolder, 'client/test/jsScripts/MarkLogic/test/invoke1.xqy')
    const module5 = Path.join(rootFolder, 'client/test/jsScripts/helloWorld.sjs')

    const module6 = Path.join(rootFolder, 'client/test/jsScripts/MarkLogic/test/jsInvoke-1.sjs')
    const module7 = Path.join(rootFolder, 'client/test/jsScripts/MarkLogic/test/xqyInvoke-1.xqy')
    const module8 = Path.join(rootFolder, 'client/test/jsScripts/MarkLogic/test/jsInvoke-2.sjs')

    const debugServerModules = [module1, module2, module3, module4, module5, module6]
    const taskServerModules = [module6, module7, module8]
    const collection = 'VSCODE/SJS-debug-test'

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
            const path = Path.join(scriptFolder, 'helloWorld.sjs')
            const text = fs.readFileSync(path).toString()
            const config = { queryText: text, program: path, username: username, password: password, hostname: hostname, authType: 'DIGEST' }
            return Promise.all([
                dc.configurationSequence(),
                dc.launch(config),
                dc.assertStoppedLocation('entry', { path: path, line: 1 })
            ])
        }).timeout(5000)

        test('check stepOver', async () => {
            const path = Path.join(scriptFolder, 'helloWorld.sjs')
            const text = fs.readFileSync(path).toString()
            const config = { queryText: text, program: path, username: username, password: password, hostname: hostname, authType: 'DIGEST' }
            await Promise.all([
                dc.configurationSequence(),
                dc.launch(config)
            ])
            // 2 steps will actually go to the second line
            await dc.nextRequest({ threadId: 1 })
            await dc.waitForEvent('stopped')
            await dc.nextRequest({ threadId: 1 })
            return dc.assertStoppedLocation('step', { path: path, line: 4 })
        }).timeout(5000)

        test('set breakpoint', async () => {
            const path = Path.join(scriptFolder, 'helloWorld.sjs')
            const text = fs.readFileSync(path).toString()
            const config = { queryText: text, program: path, username: username, password: password, hostname: hostname, authType: 'DIGEST' }
            await Promise.all([
                dc.configurationSequence(),
                dc.launch(config)
            ])
            await dc.setBreakpointsRequest({ source: { path: path }, breakpoints: [{ line: 4 }] })
            await dc.continueRequest({ threadId: 1 })
            return dc.assertStoppedLocation('breakpoint', { path: path, line: 4 })
        }).timeout(5000)

        test('check stepInto', async () => {
            const path = Path.join(scriptFolder, 'helloWorld.sjs')
            const text = fs.readFileSync(path).toString()
            const config = { queryText: text, program: path, username: username, password: password, hostname: hostname, authType: 'DIGEST' }
            await Promise.all([
                dc.configurationSequence(),
                dc.launch(config)
            ])
            await dc.setBreakpointsRequest({ source: { path: path }, breakpoints: [{ line: 6 }] })
            await dc.continueRequest({ threadId: 1 })
            await dc.waitForEvent('stopped')
            await dc.stepInRequest({ threadId: 1 })
            return dc.assertStoppedLocation('step', { path: path, line: 12 })
        }).timeout(5000)

        test('check stepOut', async () => {
            const path = Path.join(scriptFolder, 'helloWorld.sjs')
            const text = fs.readFileSync(path).toString()
            const config = { queryText: text, program: path, username: username, password: password, hostname: hostname, authType: 'DIGEST' }
            await Promise.all([
                dc.configurationSequence(),
                dc.launch(config)
            ])
            await dc.setBreakpointsRequest({ source: { path: path }, breakpoints: [{ line: 12 }] })
            await dc.continueRequest({ threadId: 1 })
            await dc.waitForEvent('stopped')
            await dc.stepOutRequest({ threadId: 1 })
            return dc.assertStoppedLocation('step', { path: path, line: 7 })
        }).timeout(5000)

        test('check stack trace', async () => {
            const path = Path.join(scriptFolder, 'helloWorld.sjs')
            const text = fs.readFileSync(path).toString()
            const config = { queryText: text, program: path, username: username, password: password, hostname: hostname, authType: 'DIGEST' }
            await Promise.all([
                dc.configurationSequence(),
                dc.launch(config)
            ])
            await dc.setBreakpointsRequest({ source: { path: path }, breakpoints: [{ line: 12 }] })
            await dc.continueRequest({ threadId: 1 })
            const stackTrace = await dc.assertStoppedLocation('breakpoint', { path: path, line: 12 })
            const frame = stackTrace.body.stackFrames[0]
            assert(frame.name, 'loop')
            assert(frame.line, '12')
            return
        }).timeout(5000)

        test('check variable', async () => {
            const path = Path.join(scriptFolder, 'helloWorld.sjs')
            const text = fs.readFileSync(path).toString()
            const config = { queryText: text, program: path, username: username, password: password, hostname: hostname, authType: 'DIGEST' }
            await Promise.all([
                dc.configurationSequence(),
                dc.launch(config)
            ])
            await dc.setBreakpointsRequest({ source: { path: path }, breakpoints: [{ line: 12 }] })
            await dc.continueRequest({ threadId: 1 })
            const stackTrace = await dc.assertStoppedLocation('breakpoint', { path: path, line: 12 })
            const frameId = stackTrace.body.stackFrames[0].id
            const scope = await dc.scopesRequest({ frameId: frameId })
            const vars = await dc.variablesRequest({ variablesReference: scope.body.scopes[0].variablesReference })
            return assert.equal(vars.body.variables[0].name, 'ret')

        }).timeout(5000)

        test('check evaluate', async () => {
            const path = Path.join(scriptFolder, 'helloWorld.sjs')
            const text = fs.readFileSync(path).toString()
            const config = { queryText: text, program: path, username: username, password: password, hostname: hostname, authType: 'DIGEST' }
            await Promise.all([
                dc.configurationSequence(),
                dc.launch(config)
            ])
            await dc.setBreakpointsRequest({ source: { path: path }, breakpoints: [{ line: 12 }] })
            await dc.continueRequest({ threadId: 1 })
            await dc.waitForEvent('stopped')
            const evalResult = await dc.evaluateRequest({ expression: 'str' })
            return assert.equal(evalResult.body.result, 'Hello World SJS')

        }).timeout(5000)

        test('check conditional breakpoint', async () => {
            const path = Path.join(scriptFolder, 'helloWorld.sjs')
            const text = fs.readFileSync(path).toString()
            const config = { queryText: text, program: path, username: username, password: password, hostname: hostname, authType: 'DIGEST' }
            await Promise.all([
                dc.configurationSequence(),
                dc.launch(config)
            ])
            await dc.setBreakpointsRequest({ source: { path: path }, breakpoints: [{ line: 14, condition: 'i==15' }] })
            await dc.continueRequest({ threadId: 1 })
            await dc.waitForEvent('stopped')
            const evalResult = await dc.evaluateRequest({ expression: 'ret' })
            return assert.equal(evalResult.body.result, '105')
        }).timeout(5000)
    })

    //helper
    async function getRid(client: MarklogicClient, qry: string): Promise<string[]> {
        const newParams: MlClientParameters = JSON.parse(JSON.stringify(client.params))
        newParams.port = 8002
        const newClient = new MarklogicClient(newParams)
        return sendJSQuery(newClient, qry)
            .result(
                (fulfill: Record<string, any>[]) => {
                    return fulfill.map(o => {
                        return o.value
                    })
                },
                (err) => {
                    throw err
                })
    }
    //helper
    function wait(ms: number): Promise<any> {
        return new Promise((resolve) => {
            setTimeout(resolve, ms)
        })
    }

    suite('Issue 69', async () => {
        test('set breakpoints on two files', async () => {
            CP.exec(`curl --anyauth --user ${username}:${password} -i -X POST -H "Content-type: application/x-www-form-urlencoded" \
                http://${hostname}:8080/LATEST/invoke --data-urlencode module=/MarkLogic/test/test.sjs`)
            await wait(1000)
            const resp = await getRid(mlClient, 'xdmp.serverStatus(xdmp.host(),xdmp.server("JSdebugTestServer")).toObject()[0].requestStatuses[0].requestId')
            const rid = resp[0]
            const path = Path.join(scriptFolder, 'MarkLogic/test')
            const config = { rid: rid, root: path, username: username, password: password, hostname: hostname, authType: 'DIGEST' }
            await Promise.all([
                dc.initializeRequest(),
                dc.configurationSequence(),
                dc.attachRequest(config as DebugProtocol.AttachRequestArguments)
            ])

            await dc.setBreakpointsRequest({ source: { path: Path.join('/MarkLogic/test', 'test.sjs') }, breakpoints: [{ line: 3 }] })
            await dc.setBreakpointsRequest({ source: { path: Path.join('/MarkLogic/test', 'lib1.sjs') }, breakpoints: [{ line: 2 }] })
            await dc.setBreakpointsRequest({ source: { path: Path.join('/MarkLogic/test', 'lib2.sjs') }, breakpoints: [{ line: 2 }] })

            await dc.continueRequest({ threadId: 1 })
            await dc.waitForEvent('stopped')
            await dc.continueRequest({ threadId: 1 })
            await dc.waitForEvent('stopped')
            await dc.continueRequest({ threadId: 1 })
            await dc.waitForEvent('stopped')
            await dc.continueRequest({ threadId: 1 })
            return dc.assertStoppedLocation('breakpoint', { path: Path.join('/MarkLogic/test', 'test.sjs'), line: 3 })
        }).timeout(10000)
    })

    suite('Issue 70', async () => {
        test('check non-existing modules are loaded', async () => {
            CP.exec(`curl --anyauth --user ${username}:${password} -i -X POST -H "Content-type: application/x-www-form-urlencoded" \
                http://${hostname}:8080/LATEST/invoke --data-urlencode module=/MarkLogic/test/helloWorld.sjs`)
            await wait(1000)
            const resp = await getRid(mlClient, 'xdmp.serverStatus(xdmp.host(),xdmp.server("JSdebugTestServer")).toObject()[0].requestStatuses[0].requestId')
            const rid = resp[0]
            const path = Path.join(scriptFolder, 'helloWorld.sjs')
            const text = fs.readFileSync(path).toString()
            const root = Path.join(scriptFolder, 'MarkLogic/test')
            const config = { rid: rid, root: root, username: username, password: password, hostname: hostname,
                database: 'Modules', modules: 'Modules', authType: 'DIGEST' }
            await Promise.all([
                dc.initializeRequest(),
                dc.configurationSequence(),
                dc.attachRequest(config as DebugProtocol.AttachRequestArguments)
            ])
            const stackResponse = await dc.stackTraceRequest({ threadId: 1 })
            const src = stackResponse['body']['stackFrames'][0]['source']
            assert.equal(9, src['sourceReference'], 'confrim stackFrame source id indicates non-existing file')
            const srcReqResponse = await dc.sourceRequest({ source: src, sourceReference: src.sourceReference })
            return assert.equal(srcReqResponse['body']['content'], text, 'check if modules is streamed back')
        }).timeout(10000)
    })

    suite('Testing sjs/xqy boundary in eval/invoke', async () => {
        test('sjs calling xdmp:eval()', async () => {
            const path = Path.join(scriptFolder, 'eval2.sjs')
            const text = fs.readFileSync(path).toString()
            const config = { queryText: text, program: path, username: username, password: password, hostname: hostname, authType: 'DIGEST' }
            await Promise.all([
                dc.configurationSequence(),
                dc.launch(config)
            ])
            await dc.setBreakpointsRequest({ source: { path: path }, breakpoints: [{ line: 4 }] })
            await dc.continueRequest({ threadId: 1 })
            await dc.assertStoppedLocation('breakpoint', { path: path, line: 4 })
            await dc.stepInRequest({ threadId: 1 })
            return dc.assertStoppedLocation('step', { path: path, line: 8 })
        }).timeout(25000)

        test('sjs calling xdmp:invoke()', async () => {
            const path = Path.join(scriptFolder, 'invoke2.sjs')
            const text = fs.readFileSync(path).toString()
            const config = { queryText: text, program: path, username: username, password: password, hostname: hostname, authType: 'DIGEST' }
            await Promise.all([
                dc.configurationSequence(),
                dc.launch(config)
            ])
            await dc.setBreakpointsRequest({ source: { path: path }, breakpoints: [{ line: 4 }] })
            await dc.continueRequest({ threadId: 1 })
            await dc.assertStoppedLocation('breakpoint', { path: path, line: 4 })
            await dc.stepInRequest({ threadId: 1 })
            return dc.assertStoppedLocation('step', { path: path, line: 6 })
        }).timeout(5000)

        test('xqy calling xdmp.invoke()', async () => {
            CP.exec(`curl --anyauth --user ${username}:${password} -i -X POST -H "Content-type: application/x-www-form-urlencoded" \
                http://${hostname}:8080/LATEST/invoke --data-urlencode module=/MarkLogic/test/invoke1.xqy`)
            await wait(100)
            const resp = await getRid(mlClient, 'xdmp.serverStatus(xdmp.host(),xdmp.server("JSdebugTestServer")).toObject()[0].requestStatuses[0].requestId')
            const rid = resp[0]
            const root = Path.join(scriptFolder, 'MarkLogic/test')
            const config = { rid: rid, root: root, username: username, password: password, hostname: hostname,
                database: 'Modules', modules: 'Modules', authType: 'DIGEST' }
            await Promise.all([
                dc.initializeRequest(),
                dc.configurationSequence(),
                dc.attachRequest(config as DebugProtocol.AttachRequestArguments)
            ])

            await dc.setBreakpointsRequest({ source: { path: Path.join('/MarkLogic/test', 'jsInvoke-1.sjs') }, breakpoints: [{ line: 3 }] })
            await dc.continueRequest({ threadId: 1 })
            return dc.assertStoppedLocation('breakpoint', { path: Path.join('/MarkLogic/test', 'jsInvoke-1.sjs'), line: 3 })
        }).timeout(10000)

        test('sjs importing xqy', async () => {
            const path = Path.join(scriptFolder, 'eval3.sjs')
            const text = fs.readFileSync(path).toString()
            const config = { queryText: text, program: path, username: username, password: password, hostname: hostname, authType: 'DIGEST' }
            await Promise.all([
                dc.configurationSequence(),
                dc.launch(config)
            ])
            await dc.setBreakpointsRequest({ source: { path: path }, breakpoints: [{ line: 4 }] })
            await dc.continueRequest({ threadId: 1 })
            await dc.assertStoppedLocation('breakpoint', { path: path, line: 4 })
            await dc.stepInRequest({ threadId: 1 })
            return dc.assertStoppedLocation('step', { path: path, line: 6 })
        }).timeout(15000)

    })
})
