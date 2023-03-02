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

    suite('Issue 70', async () => {
        test('check non-existing modules are loaded', async () => {
            CP.exec(`curl --anyauth -k --user ${username}:${password} -i -X POST -H "Content-type: application/x-www-form-urlencoded" \
                http${ssl ? 's' : ''}://${hostname}:8080/LATEST/invoke --data-urlencode module=/MarkLogic/test/helloWorld.sjs`)
            await wait(1000)
            const resp = await getRid(mlClient, 'xdmp.serverStatus(xdmp.host(),xdmp.server("JSdebugTestServer")).toObject()[0].requestStatuses[0].requestId')
            const rid = resp[0]
            const path = Path.join(scriptFolder, 'helloWorld.sjs')
            const text = fs.readFileSync(path).toString()
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
            const stackResponse = await dc.stackTraceRequest({ threadId: 1 })
            const src = stackResponse['body']['stackFrames'][0]['source']
            assert.equal(9, src['sourceReference'], 'confrim stackFrame source id indicates non-existing file')
            const srcReqResponse = await dc.sourceRequest({ source: src, sourceReference: src.sourceReference })
            return assert.equal(srcReqResponse['body']['content'], text, 'check if modules is streamed back')
        }).timeout(10000).skip();
    })
})
