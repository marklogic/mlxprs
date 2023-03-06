/* eslint-disable @typescript-eslint/no-use-before-define */
import * as Path from 'path'
import { DebugProtocol } from 'vscode-debugprotocol'
import * as CP from 'child_process'
import * as fs from 'fs'

import { IntegrationTestHelper, wait } from './markLogicIntegrationTestHelper'


suite('Testing sjs/xqy boundary in eval/invoke', async () => {
    const integrationTestHelper: IntegrationTestHelper = globalThis.integrationTestHelper
    test('sjs calling xdmp:invoke()', async () => {
        const globalConfig = integrationTestHelper.config
        globalConfig.program = Path.join(integrationTestHelper.scriptFolder, 'invoke2.sjs')
        globalConfig.queryText = fs.readFileSync(globalConfig.program).toString()

        const debugClient = integrationTestHelper.debugClient
        await Promise.all([
            debugClient.configurationSequence(),
            debugClient.launch(globalConfig)
        ])
        await debugClient.setBreakpointsRequest({ source: { path: globalConfig.program }, breakpoints: [{ line: 4 }] })
        await debugClient.continueRequest({ threadId: 1 })
        await debugClient.assertStoppedLocation('breakpoint', { path: globalConfig.program, line: 4 })
        await debugClient.stepInRequest({ threadId: 1 })
        return debugClient.assertStoppedLocation('step', { path: globalConfig.program, line: 6 })
    }).timeout(5000)

    test('sjs calling xdmp:eval()', async () => {
        const globalConfig = integrationTestHelper.config
        globalConfig.program = Path.join(integrationTestHelper.scriptFolder, 'eval2.sjs')
        globalConfig.queryText = fs.readFileSync(globalConfig.program).toString()

        const debugClient = integrationTestHelper.debugClient
        await Promise.all([
            debugClient.configurationSequence(),
            debugClient.launch(globalConfig)
        ])
        await debugClient.setBreakpointsRequest({ source: { path: globalConfig.program }, breakpoints: [{ line: 4 }] })
        await debugClient.continueRequest({ threadId: 1 })
        await debugClient.assertStoppedLocation('breakpoint', { path: globalConfig.program, line: 4 })
        await debugClient.stepInRequest({ threadId: 1 })
        return debugClient.assertStoppedLocation('step', { path: globalConfig.program, line: 8 })
    }).timeout(25000)

    test('sjs importing xqy', async () => {
        const globalConfig = integrationTestHelper.config
        globalConfig.program = Path.join(integrationTestHelper.scriptFolder, 'eval3.sjs')
        globalConfig.queryText = fs.readFileSync(globalConfig.program).toString()

        const debugClient = integrationTestHelper.debugClient
        await Promise.all([
            debugClient.configurationSequence(),
            debugClient.launch(globalConfig)
        ])
        await debugClient.setBreakpointsRequest({ source: { path: globalConfig.program }, breakpoints: [{ line: 4 }] })
        await debugClient.continueRequest({ threadId: 1 })
        await debugClient.assertStoppedLocation('breakpoint', { path: globalConfig.program, line: 4 })
        await debugClient.stepInRequest({ threadId: 1 })
        return debugClient.assertStoppedLocation('step', { path: globalConfig.program, line: 6 })
    }).timeout(15000)


    test('xqy calling xdmp.invoke()', async () => {
        const globalConfig = integrationTestHelper.config

        CP.exec(`curl --anyauth -k --user ${globalConfig.username}:${globalConfig.password} -i -X POST -H "Content-type: application/x-www-form-urlencoded" \
                http${globalConfig.ssl ? 's' : ''}://${globalConfig.hostname}:8055/LATEST/invoke --data-urlencode module=/MarkLogic/test/invoke1.xqy`)
        await wait(100)
        const resp = await integrationTestHelper.getRid(integrationTestHelper.mlClient, 'xdmp.serverStatus(xdmp.host(),xdmp.server("JSdebugTestServer")).toObject()[0].requestStatuses[0].requestId')
        const rid = resp[0]
        const root = Path.join(integrationTestHelper.scriptFolder, 'MarkLogic/test')
        const config = {
            rid: rid, root: root,
            username: globalConfig.username, password: globalConfig.password,
            hostname: globalConfig.hostname, database: 'Modules', modules: 'Modules', authType: 'DIGEST',
            ssl: globalConfig.ssl, pathToCa: globalConfig.pathToCa, rejectUnauthorized: globalConfig.rejectUnauthorized
        }
        const debugClient = integrationTestHelper.debugClient
        await Promise.all([
            debugClient.initializeRequest(),
            debugClient.configurationSequence(),
            debugClient.attachRequest(config as DebugProtocol.AttachRequestArguments)
        ])

        await debugClient.setBreakpointsRequest({ source: { path: Path.join('/MarkLogic/test', 'jsInvoke-1.sjs') }, breakpoints: [{ line: 3 }] })
        await debugClient.continueRequest({ threadId: 1 })
        return debugClient.assertStoppedLocation('breakpoint', { path: Path.join('/MarkLogic/test', 'jsInvoke-1.sjs'), line: 3 })
    }).timeout(10000).skip()

})
