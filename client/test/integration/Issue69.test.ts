/* eslint-disable @typescript-eslint/no-use-before-define */
import * as Path from 'path'
import { DebugProtocol } from '@vscode/debugprotocol'
import * as CP from 'child_process'

import { IntegrationTestHelper, wait } from './markLogicIntegrationTestHelper'


suite('Issue 69', async () => {
    const integrationTestHelper: IntegrationTestHelper = globalThis.integrationTestHelper

    test('set breakpoints on two files', async () => {
        const mlClient = integrationTestHelper.mlClient
        const scriptFolder = integrationTestHelper.scriptFolder
        const globalConfig = integrationTestHelper.config

        CP.exec(`curl --anyauth -k --user ${globalConfig.username}:${globalConfig.password} -i -X POST -H "Content-type: application/x-www-form-urlencoded" \
                    http${globalConfig.ssl ? 's' : ''}://${globalConfig.hostname}:${integrationTestHelper.appServerPort}/LATEST/invoke --data-urlencode module=/MarkLogic/test/test.sjs`)
        await wait(1000)
        const resp = await integrationTestHelper.getRid(mlClient, 'xdmp.serverStatus(xdmp.host(),xdmp.server("JSdebugTestServer")).toObject()[0].requestStatuses[0].requestId')
        const rid = resp[0]
        const root = Path.join(scriptFolder, 'MarkLogic/test')
        const config = {
            rid: rid, root: root,
            username: globalConfig.username, password: globalConfig.password,
            hostname: globalConfig.hostname, authType: 'DIGEST',
            ssl: globalConfig.ssl, pathToCa: globalConfig.pathToCa, rejectUnauthorized: globalConfig.rejectUnauthorized
        }
        const debugClient = integrationTestHelper.debugClient
        await Promise.all([
            debugClient.initializeRequest(),
            debugClient.configurationSequence(),
            debugClient.attachRequest(config as DebugProtocol.AttachRequestArguments)
        ])

        await debugClient.setBreakpointsRequest({ source: { path: Path.join('/MarkLogic/test', 'test.sjs') }, breakpoints: [{ line: 3 }] })
        await debugClient.setBreakpointsRequest({ source: { path: Path.join('/MarkLogic/test', 'lib1.sjs') }, breakpoints: [{ line: 2 }] })
        await debugClient.setBreakpointsRequest({ source: { path: Path.join('/MarkLogic/test', 'lib2.sjs') }, breakpoints: [{ line: 2 }] })

        await debugClient.continueRequest({ threadId: 1 })
        await debugClient.waitForEvent('stopped')
        await debugClient.continueRequest({ threadId: 1 })
        await debugClient.waitForEvent('stopped')
        await debugClient.continueRequest({ threadId: 1 })
        await debugClient.waitForEvent('stopped')
        await debugClient.continueRequest({ threadId: 1 })
        return debugClient.assertStoppedLocation('breakpoint', { path: Path.join('/MarkLogic/test', 'test.sjs'), line: 3 })
    }).timeout(10000).skip()
})
