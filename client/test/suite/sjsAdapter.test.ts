import * as assert from 'assert'
import { after, before } from 'mocha'
import { MarklogicClient, MlClientParameters, sendJSQuery } from '../../marklogicClient'
import {_connectServer, _disonnectServer} from '../../JSDebugger/configurationProvider'
import * as vscode from 'vscode'
import * as Path from 'path'
import {DebugClient} from 'vscode-debugadapter-testsupport'
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

    const rootFolder = Path.join(__dirname, '../../../../')
    const exec = Path.join(rootFolder, 'dist/jsDebug.js')
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

    const module5 = Path.join(rootFolder, 'client/test/jsScripts/MarkLogic/test/jsInvoke-1.sjs')
    const module6 = Path.join(rootFolder, 'client/test/jsScripts/MarkLogic/test/xqyInvoke-1.xqy')
    const module7 = Path.join(rootFolder, 'client/test/jsScripts/MarkLogic/test/jsInvoke-2.sjs')

    const debugServerModules = [module1, module2, module3, module4, module5]
    const taskServerModules = [module5, module6, module7]

    before(async () => {
        // load test data
        await _connectServer('JSdebugTestServer')
        const requests = []
        debugServerModules.forEach(async (module) => {
            const fname = Path.basename(module)
            const qry = `declareUpdate(); xdmp.documentLoad('${module}', {'uri':'/MarkLogic/test/${fname}'} )`
            requests.push(sendJSQuery(mlClient, qry))
        })
        taskServerModules.forEach(async (module) => {
            const fname = Path.basename(module)
            const qry = `declareUpdate(); xdmp.documentLoad('${module}', {'uri':'Apps/MarkLogic/test/${fname}'} )`
            requests.push(sendJSQuery(mlClient, qry))
        })
        Promise.all(requests)
    })

    after(async () => {
        // delete test data
        await _disonnectServer('JSdebugTestServer')
        const requests = []
        debugServerModules.forEach(async (module) => {
            const fname = Path.basename(module)
            const qry = `declareUpdate(); xdmp.documentDelete('/MarkLogic/test/${fname}',{ifNotExists:"allow"} )`
            requests.push(sendJSQuery(mlClient, qry))
        })
        taskServerModules.forEach(async (module) => {
            const fname = Path.basename(module)
            const qry = `declareUpdate(); xdmp.documentDelete('Apps/MarkLogic/test/${fname}',{ifNotExists:"allow"} )`
            requests.push(sendJSQuery(mlClient, qry))
        })
        Promise.all(requests)
        vscode.window.showInformationMessage('All tests done!')
    })

    setup( () => {
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
            const config = {queryText: text, program: path, username: username, password: password, hostname: hostname, authType: 'DIGEST'}
            return Promise.all([
                dc.configurationSequence(),
                dc.launch(config),
                dc.assertStoppedLocation('entry', { path: path, line: 1 })
            ])
        }).timeout(5000)

        test('check stepOver', async () => {
            const path = Path.join(scriptFolder, 'helloWorld.sjs')
            const text = fs.readFileSync(path).toString()
            const config = {queryText: text, program: path, username: username, password: password, hostname: hostname, authType: 'DIGEST'}
            await Promise.all([
                dc.configurationSequence(),
                dc.launch(config)
            ])
            // 2 steps will actually go to the second line
            await dc.nextRequest({threadId: 1})
            await dc.nextRequest({threadId: 1})
            return dc.assertStoppedLocation('step', { path: path, line: 4 })
        })

        test('set breakpoint', async () => {
            const path = Path.join(scriptFolder, 'helloWorld.sjs')
            const text = fs.readFileSync(path).toString()
            const config = {queryText: text, program: path, username: username, password: password, hostname: hostname, authType: 'DIGEST'}
            await Promise.all([
                dc.configurationSequence(),
                dc.launch(config)
            ])
            await dc.setBreakpointsRequest({source: {path: path}, breakpoints: [{line: 4}] })
            await dc.continueRequest({threadId: 1})
            return dc.assertStoppedLocation('breakpoint', { path: path, line: 4 } )
        })

        test('check stepInto', async () => {
            const path = Path.join(scriptFolder, 'helloWorld.sjs')
            const text = fs.readFileSync(path).toString()
            const config = {queryText: text, program: path, username: username, password: password, hostname: hostname, authType: 'DIGEST'}
            await Promise.all([
                dc.configurationSequence(),
                dc.launch(config)
            ])
            await dc.setBreakpointsRequest({source: {path: path}, breakpoints: [{line: 6}] })
            await dc.continueRequest({threadId: 1})
            await dc.stepInRequest({threadId: 1})
            return dc.assertStoppedLocation('step', { path: path, line: 12 } )
        })

        test('check stepOut', async () => {
            const path = Path.join(scriptFolder, 'helloWorld.sjs')
            const text = fs.readFileSync(path).toString()
            const config = {queryText: text, program: path, username: username, password: password, hostname: hostname, authType: 'DIGEST'}
            await Promise.all([
                dc.configurationSequence(),
                dc.launch(config)
            ])
            await dc.setBreakpointsRequest({source: {path: path}, breakpoints: [{line: 12}] })
            await dc.continueRequest({threadId: 1})
            await dc.stepOutRequest({threadId: 1})
            return dc.assertStoppedLocation('step', { path: path, line: 7 } )
        })

        test('check stack trace', async () => {
            const path = Path.join(scriptFolder, 'helloWorld.sjs')
            const text = fs.readFileSync(path).toString()
            const config = {queryText: text, program: path, username: username, password: password, hostname: hostname, authType: 'DIGEST'}
            await Promise.all([
                dc.configurationSequence(),
                dc.launch(config)
            ])
            await dc.setBreakpointsRequest({source: {path: path}, breakpoints: [{line: 11}] })
            await dc.continueRequest({threadId: 1})
            const stackTrace = await dc.assertStoppedLocation('breakpoint', { path: path, line: 12 })
            const frame = stackTrace.body.stackFrames[0]
            assert(frame.name, 'loop')
            assert(frame.line, '12')
            return
        })

        test('check variable', async () => {
            const path = Path.join(scriptFolder, 'helloWorld.sjs')
            const text = fs.readFileSync(path).toString()
            const config = {queryText: text, program: path, username: username, password: password, hostname: hostname, authType: 'DIGEST'}
            await Promise.all([
                dc.configurationSequence(),
                dc.launch(config)
            ])
            await dc.setBreakpointsRequest({source: {path: path}, breakpoints: [{line: 11}] })
            await dc.continueRequest({threadId: 1})
            const stackTrace = await dc.assertStoppedLocation('breakpoint', { path: path, line: 12 })
            const frameId = stackTrace.body.stackFrames[0].id
            const scope = await dc.scopesRequest({frameId: frameId})
            const vars = await dc.variablesRequest({variablesReference: scope.body.scopes[0].variablesReference})
            return assert.equal(vars.body.variables[0].name, 'ret')

        })

        test('check evaluate', async () => {
            const path = Path.join(scriptFolder, 'helloWorld.sjs')
            const text = fs.readFileSync(path).toString()
            const config = {queryText: text, program: path, username: username, password: password, hostname: hostname, authType: 'DIGEST'}
            await Promise.all([
                dc.configurationSequence(),
                dc.launch(config)
            ])
            await dc.setBreakpointsRequest({source: {path: path}, breakpoints: [{line: 11}] })
            await dc.continueRequest({threadId: 1})
            const evalResult = await dc.evaluateRequest({expression: 'str'})
            return assert.equal(evalResult.body.result, 'Hello World SJS')

        })

        test('check conditional breakpoint', async () => {
            const path = Path.join(scriptFolder, 'helloWorld.sjs')
            const text = fs.readFileSync(path).toString()
            const config = {queryText: text, program: path, username: username, password: password, hostname: hostname, authType: 'DIGEST'}
            await Promise.all([
                dc.configurationSequence(),
                dc.launch(config)
            ])
            await dc.setBreakpointsRequest({source: {path: path}, breakpoints: [{line: 14, condition: 'i==15'}] })
            await dc.continueRequest({threadId: 1})
            const evalResult = await dc.evaluateRequest({expression: 'ret'})
            return assert.equal(evalResult.body.result, '105')
        })
    })

    //helper
    async function getRid(client, qry): Promise<string[]> {
        return sendJSQuery(client, qry)
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

    suite('Issue 69', () => {
        test('set breakpoints on two files', async () => {
            CP.exec(`curl --anyauth --user ${username}:${password} -i -X POST -H "Content-type: application/x-www-form-urlencoded" \
                http://localhost:8080/LATEST/invoke --data-urlencode module=/MarkLogic/test/test.sjs`)
            await wait(100)
            const resp = await getRid(mlClient, 'xdmp.serverStatus(xdmp.host(),xdmp.server("JSdebugTestServer")).toObject()[0].requestStatuses[0].requestId')
            const rid = resp[0]
            const path = Path.join(scriptFolder, 'MarkLogic/test')
            const config = {rid: rid, root: path, username: username, password: password, hostname: hostname, authType: 'DIGEST'}
            await Promise.all([
                dc.initializeRequest(),
                dc.configurationSequence(),
                dc.attachRequest(config as never)
            ])

            await dc.setBreakpointsRequest({source: {path: Path.join('/MarkLogic/test', 'test.sjs')}, breakpoints: [{line: 3}] })
            await dc.setBreakpointsRequest({source: {path: Path.join('/MarkLogic/test', 'lib1.sjs')}, breakpoints: [{line: 2}] })
            await dc.setBreakpointsRequest({source: {path: Path.join('/MarkLogic/test', 'lib2.sjs')}, breakpoints: [{line: 2}] })

            await dc.continueRequest({threadId: 1})
            await dc.continueRequest({threadId: 1})
            await dc.continueRequest({threadId: 1})
            await dc.continueRequest({threadId: 1})
            return dc.assertStoppedLocation('breakpoint', { path: Path.join('/MarkLogic/test', 'test.sjs'), line: 3 } )
        }).timeout(5000)
    })

    suite('Testing sjs/xqy boundary in eval/invoke', () => {
        test('sjs calling xdmp.eval()', async () => {
            const path = Path.join(scriptFolder, 'eval1.sjs')
            const text = fs.readFileSync(path).toString()
            const config = {queryText: text, program: path, username: username, password: password, hostname: hostname, authType: 'DIGEST'}
            await Promise.all([
                dc.configurationSequence(),
                dc.launch(config)
            ])
            await dc.setBreakpointsRequest({source: {path: path}, breakpoints: [{line: 4}] })
            await dc.continueRequest({threadId: 1})
            dc.assertStoppedLocation('breakpoint', { path: path, line: 4 } )
            await dc.stepInRequest({threadId: 1})
            return dc.assertStoppedLocation('step', { path: path, line: 9 } )
        })

        test('sjs calling xdmp.invoke()', async () => {
            const path = Path.join(scriptFolder, 'invoke1.sjs')
            const text = fs.readFileSync(path).toString()
            const config = {queryText: text, program: path, username: username, password: password, hostname: hostname, authType: 'DIGEST'}
            await Promise.all([
                dc.configurationSequence(),
                dc.launch(config)
            ])
            await dc.setBreakpointsRequest({source: {path: path}, breakpoints: [{line: 4}] })
            await dc.continueRequest({threadId: 1})
            dc.assertStoppedLocation('breakpoint', { path: path, line: 4 } )
            await dc.stepInRequest({threadId: 1})
            return dc.assertStoppedLocation('step', { path: path, line: 6 } )
        }).timeout(5000)

        test('sjs calling xdmp:eval()', async () => {
            const path = Path.join(scriptFolder, 'eval2.sjs')
            const text = fs.readFileSync(path).toString()
            const config = {queryText: text, program: path, username: username, password: password, hostname: hostname, authType: 'DIGEST'}
            await Promise.all([
                dc.configurationSequence(),
                dc.launch(config)
            ])
            await dc.setBreakpointsRequest({source: {path: path}, breakpoints: [{line: 4}] })
            await dc.continueRequest({threadId: 1})
            dc.assertStoppedLocation('breakpoint', { path: path, line: 4 } )
            await dc.stepInRequest({threadId: 1})
            return dc.assertStoppedLocation('step', { path: path, line: 8 } )
        })

        test('sjs calling xdmp:invoke()', async () => {
            const path = Path.join(scriptFolder, 'invoke2.sjs')
            const text = fs.readFileSync(path).toString()
            const config = {queryText: text, program: path, username: username, password: password, hostname: hostname, authType: 'DIGEST'}
            await Promise.all([
                dc.configurationSequence(),
                dc.launch(config)
            ])
            await dc.setBreakpointsRequest({source: {path: path}, breakpoints: [{line: 4}] })
            await dc.continueRequest({threadId: 1})
            dc.assertStoppedLocation('breakpoint', { path: path, line: 4 } )
            await dc.stepInRequest({threadId: 1})
            return dc.assertStoppedLocation('step', { path: path, line: 6 } )
        })

        test('xqy calling xdmp.invoke()', async () => {
            CP.exec(`curl --anyauth --user ${username}:${password} -i -X POST -H "Content-type: application/x-www-form-urlencoded" \
                http://localhost:8080/LATEST/invoke --data-urlencode module=/MarkLogic/test/invoke1.xqy`)
            await wait(100)
            const resp = await getRid(mlClient, 'xdmp.serverStatus(xdmp.host(),xdmp.server("JSdebugTestServer")).toObject()[0].requestStatuses[0].requestId')
            const rid = resp[0]
            const path = Path.join(scriptFolder, 'MarkLogic/test')
            const config = {rid: rid, program: path, username: username, password: password, hostname: hostname, authType: 'DIGEST'}
            await Promise.all([
                dc.initializeRequest(),
                dc.configurationSequence(),
                dc.attachRequest(config as never)
            ])

            await dc.setBreakpointsRequest({source: {path: Path.join('/MarkLogic/test', 'jsInvoke-1.sjs')}, breakpoints: [{line: 3}] })
            await dc.continueRequest({threadId: 1})
            return dc.assertStoppedLocation('breakpoint', { path: Path.join('/MarkLogic/test', 'jsInvoke-1.sjs'), line: 3 } )
        }).timeout(10000)

        test('sjs importing xqy', async () => {
            const path = Path.join(scriptFolder, 'eval3.sjs')
            const text = fs.readFileSync(path).toString()
            const config = {queryText: text, program: path, username: username, password: password, hostname: hostname, authType: 'DIGEST'}
            await Promise.all([
                dc.configurationSequence(),
                dc.launch(config)
            ])
            await dc.setBreakpointsRequest({source: {path: path}, breakpoints: [{line: 4}] })
            await dc.continueRequest({threadId: 1})
            dc.assertStoppedLocation('breakpoint', { path: path, line: 4 } )
            await dc.stepInRequest({threadId: 1})
            return dc.assertStoppedLocation('step', { path: path, line: 6 } )
        })

        // test for nested call
        test('xqy invoking sjs invoking xqy', async () => {
            const path = Path.join(scriptFolder, 'nestedInvoke1.sjs')
            const text = fs.readFileSync(path).toString()
            const config = {queryText: text, program: path, username: username, password: password, hostname: hostname, authType: 'DIGEST'}
            await Promise.all([
                dc.configurationSequence(),
                dc.launch(config)
            ])
            await dc.setBreakpointsRequest({source: {path: path}, breakpoints: [{line: 4}] })
            await dc.continueRequest({threadId: 1})
            dc.assertStoppedLocation('breakpoint', { path: path, line: 4 } )
            await dc.stepInRequest({threadId: 1})
            return dc.assertStoppedLocation('step', { path: path, line: 7 } )
        })
    })
})
