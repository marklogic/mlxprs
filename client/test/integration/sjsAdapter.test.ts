/*
 * Copyright (c) 2023 MarkLogic Corporation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/* eslint-disable @typescript-eslint/no-use-before-define */
import { DebugClient } from '@vscode/debugadapter-testsupport';
import { DebugProtocol } from '@vscode/debugprotocol';
import * as CP from 'child_process';
import * as fs from 'fs';
import * as Path from 'path';

import { JsDebugManager } from '../../JSDebugger/jsDebugManager';
import { IntegrationTestHelper, wait } from './markLogicIntegrationTestHelper';


suite('Testing sjs/xqy boundary in eval/invoke', async () => {
    const integrationTestHelper: IntegrationTestHelper = globalThis.integrationTestHelper;
    test('sjs calling xdmp:invoke()', async () => {
        const globalConfig = integrationTestHelper.config;
        globalConfig.program = Path.join(integrationTestHelper.scriptFolder, 'invoke2.sjs');
        globalConfig.queryText = fs.readFileSync(globalConfig.program).toString();
        globalConfig.queryText = globalConfig.queryText.replace(integrationTestHelper.modulesDatabaseToken, integrationTestHelper.modulesDatabase);

        const jsDebugClient = integrationTestHelper.jsDebugClient;
        await Promise.all([
            jsDebugClient.configurationSequence(),
            jsDebugClient.launch(globalConfig)
        ]);
        await jsDebugClient.setBreakpointsRequest({ source: { path: globalConfig.program }, breakpoints: [{ line: 4 }] });
        await jsDebugClient.continueRequest({ threadId: 1 });
        await jsDebugClient.assertStoppedLocation('breakpoint', { path: globalConfig.program, line: 4 });
        await jsDebugClient.stepInRequest({ threadId: 1 });
        return jsDebugClient.assertStoppedLocation('step', { path: globalConfig.program, line: 6 });
    }).timeout(5000);

    test('sjs calling xdmp:eval()', async () => {
        const globalConfig = integrationTestHelper.config;
        globalConfig.program = Path.join(integrationTestHelper.scriptFolder, 'eval2.sjs');
        globalConfig.queryText = fs.readFileSync(globalConfig.program).toString();

        const jsDebugClient = integrationTestHelper.jsDebugClient;
        await Promise.all([
            jsDebugClient.configurationSequence(),
            jsDebugClient.launch(globalConfig)
        ]);
        await jsDebugClient.setBreakpointsRequest({ source: { path: globalConfig.program }, breakpoints: [{ line: 4 }] });
        await jsDebugClient.continueRequest({ threadId: 1 });
        await jsDebugClient.assertStoppedLocation('breakpoint', { path: globalConfig.program, line: 4 });
        await jsDebugClient.stepInRequest({ threadId: 1 });
        return jsDebugClient.assertStoppedLocation('step', { path: globalConfig.program, line: 8 });
    }).timeout(25000);

    test('sjs importing xqy', async () => {
        const globalConfig = integrationTestHelper.config;
        globalConfig.program = Path.join(integrationTestHelper.scriptFolder, 'eval3.sjs');
        globalConfig.queryText = fs.readFileSync(globalConfig.program).toString();

        const jsDebugClient = integrationTestHelper.jsDebugClient;
        await Promise.all([
            jsDebugClient.configurationSequence(),
            jsDebugClient.launch(globalConfig)
        ]);
        await jsDebugClient.setBreakpointsRequest({ source: { path: globalConfig.program }, breakpoints: [{ line: 4 }] });
        await jsDebugClient.continueRequest({ threadId: 1 });
        await jsDebugClient.assertStoppedLocation('breakpoint', { path: globalConfig.program, line: 4 });
        await jsDebugClient.stepInRequest({ threadId: 1 });
        return jsDebugClient.assertStoppedLocation('step', { path: globalConfig.program, line: 6 });
    }).timeout(15000);


    test('xqy calling xdmp.invoke()', async () => {
        const globalConfig = integrationTestHelper.config;
        await JsDebugManager.connectToNamedJsDebugServer(integrationTestHelper.attachServerName);

        CP.exec(`curl --anyauth -k --user ${globalConfig.username}:${globalConfig.password} -i -X POST -H "Content-type: application/x-www-form-urlencoded" \
                http${globalConfig.ssl ? 's' : ''}://${globalConfig.hostname}:${integrationTestHelper.serverPortForAttaching}/LATEST/invoke --data-urlencode module=/MarkLogic/test/invoke1.xqy`);
        await wait(100);
        const resp = await integrationTestHelper.getRid(integrationTestHelper.mlClient, 'xdmp.serverStatus(xdmp.host(),xdmp.server(integrationTestHelper.attachServerName)).toObject()[0].requestStatuses[0].requestId');
        const rid = resp[0];
        const root = Path.join(integrationTestHelper.scriptFolder, 'MarkLogic/test');
        const config = {
            rid: rid, root: root,
            username: globalConfig.username, password: globalConfig.password,
            hostname: globalConfig.hostname, database: integrationTestHelper.modulesDatabase, modules: integrationTestHelper.modulesDatabase, authType: 'DIGEST',
            ssl: globalConfig.ssl, pathToCa: globalConfig.pathToCa, rejectUnauthorized: globalConfig.rejectUnauthorized
        };
        const jsDebugClient: DebugClient = integrationTestHelper.jsDebugClient;
        await Promise.all([
            jsDebugClient.initializeRequest(),
            jsDebugClient.configurationSequence(),
            jsDebugClient.attachRequest(config as DebugProtocol.AttachRequestArguments)
        ]);

        await jsDebugClient.setBreakpointsRequest({ source: { path: Path.join('/MarkLogic/test', 'jsInvoke-1.sjs') }, breakpoints: [{ line: 3 }] });
        await jsDebugClient.continueRequest({ threadId: 1 });
        jsDebugClient.assertStoppedLocation('breakpoint', { path: Path.join('/MarkLogic/test', 'jsInvoke-1.sjs'), line: 3 });
        JsDebugManager.disconnectFromNamedJsDebugServer(integrationTestHelper.attachServerName);
    }).timeout(10000).skip();

});
