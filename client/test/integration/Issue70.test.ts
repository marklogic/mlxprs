/* eslint-disable @typescript-eslint/no-use-before-define */
import * as assert from 'assert'
import * as Path from 'path'
import { DebugProtocol } from '@vscode/debugprotocol'
import * as CP from 'child_process'
import * as fs from 'fs'

import { IntegrationTestHelper, wait } from './markLogicIntegrationTestHelper'


suite('Issue 70', async () => {
    const integrationTestHelper: IntegrationTestHelper = globalThis.integrationTestHelper

    test('check non-existing modules are loaded', async () => {
        const mlClient = integrationTestHelper.mlClient
        const scriptFolder = integrationTestHelper.scriptFolder
        const globalConfig = integrationTestHelper.config

        CP.exec(`curl --anyauth -k --user ${globalConfig.username}:${globalConfig.password} -i -X POST -H "Content-type: application/x-www-form-urlencoded" \
                    http${globalConfig.ssl ? 's' : ''}://${globalConfig.hostname}:${integrationTestHelper.appServerPort}/LATEST/invoke --data-urlencode module=/MarkLogic/test/helloWorld.sjs`)
        await wait(1000)
        const resp = await integrationTestHelper.getRid(mlClient, 'xdmp.serverStatus(xdmp.host(),xdmp.server("JSdebugTestServer")).toObject()[0].requestStatuses[0].requestId')
        const rid = resp[0]
        const path = Path.join(scriptFolder, 'helloWorld.sjs')
        const text = fs.readFileSync(path).toString()
        const root = Path.join(scriptFolder, 'MarkLogic/test')
        const config = {
            rid: rid, root: root,
            username: globalConfig.username, password: globalConfig.password,
            hostname: globalConfig.hostname, database: integrationTestHelper.modulesDatabase, modules: integrationTestHelper.modulesDatabase, authType: 'DIGEST',
            ssl: globalConfig.ssl, pathToCa: globalConfig.pathToCa, rejectUnauthorized: globalConfig.rejectUnauthorized
        }
        const debugClient = integrationTestHelper.debugClient
        await Promise.all([
            debugClient.initializeRequest(),
            debugClient.configurationSequence(),
            debugClient.attachRequest(config as DebugProtocol.AttachRequestArguments)
        ])
        const stackResponse = await debugClient.stackTraceRequest({ threadId: 1 })
        const src = stackResponse['body']['stackFrames'][0]['source']
        assert.equal(9, src['sourceReference'], 'confrim stackFrame source id indicates non-existing file')
        const srcReqResponse = await debugClient.sourceRequest({ source: src, sourceReference: src.sourceReference })
        return assert.equal(srcReqResponse['body']['content'], text, 'check if modules is streamed back')
    }).timeout(10000).skip()

})
