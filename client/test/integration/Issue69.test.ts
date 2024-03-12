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
import * as Path from 'path';
import { DebugClient } from '@vscode/debugadapter-testsupport';
import { DebugProtocol } from '@vscode/debugprotocol';
import * as CP from 'child_process';

import { IntegrationTestHelper, wait } from './markLogicIntegrationTestHelper';
import { JsDebugManager } from '../../JSDebugger/jsDebugManager';


suite('Issue 69', async () => {
    const integrationTestHelper: IntegrationTestHelper = globalThis.integrationTestHelper;

    test('set breakpoints on two files', async () => {
        await integrationTestHelper.restartMarkLogicAndWaitUntilItIsAvailableAgain();
        const globalConfig = integrationTestHelper.config;
        await JsDebugManager.connectToNamedJsDebugServer(integrationTestHelper.attachServerName);
        globalThis.integrationTestHelper.attachedToServer = true;

        const curlCommand = `curl --anyauth -k --user ${globalConfig.username}:${globalConfig.password} -i -X POST -H "Content-type: application/x-www-form-urlencoded" \
            http${globalConfig.ssl ? 's' : ''}://${globalConfig.hostname}:${integrationTestHelper.serverPortForAttaching}/LATEST/invoke --data-urlencode module=/MarkLogic/test/test.sjs`;
        CP.exec(curlCommand);
        await wait(1000);
        const serverName = integrationTestHelper.attachServerName;
        const resp = await integrationTestHelper.getRid(integrationTestHelper.mlClient, `xdmp.serverStatus(xdmp.host(),xdmp.server('${serverName}')).toObject()[0].requestStatuses[0].requestId`);
        const rid = resp[0];
        const root = Path.join(integrationTestHelper.jsScriptFolder, 'MarkLogic/test');
        const config = {
            rid: rid, root: root,
            username: globalConfig.username, password: globalConfig.password,
            hostname: globalConfig.hostname, managePort: integrationTestHelper.managePort,
            database: integrationTestHelper.modulesDatabase, modules: integrationTestHelper.modulesDatabase,
            authType: 'BASIC', ssl: globalConfig.ssl,
            pathToCa: globalConfig.pathToCa, rejectUnauthorized: globalConfig.rejectUnauthorized
        };
        const jsDebugClient: DebugClient = integrationTestHelper.jsDebugClient;
        await Promise.all([
            jsDebugClient.initializeRequest(),
            jsDebugClient.configurationSequence(),
            jsDebugClient.attachRequest(config as DebugProtocol.AttachRequestArguments)
        ]);

        await jsDebugClient.setBreakpointsRequest({ source: { path: Path.join('/MarkLogic/test', 'test.sjs') }, breakpoints: [{ line: 20 }] });
        await jsDebugClient.setBreakpointsRequest({ source: { path: Path.join('/MarkLogic/test', 'lib1.sjs') }, breakpoints: [{ line: 18 }] });
        await jsDebugClient.setBreakpointsRequest({ source: { path: Path.join('/MarkLogic/test', 'lib2.sjs') }, breakpoints: [{ line: 18 }] });
        await jsDebugClient.continueRequest({ threadId: 1 });
        await jsDebugClient.waitForEvent('stopped');
        await jsDebugClient.continueRequest({ threadId: 1 });
        await jsDebugClient.waitForEvent('stopped');
        await jsDebugClient.continueRequest({ threadId: 1 });
        await jsDebugClient.waitForEvent('stopped');
        await jsDebugClient.continueRequest({ threadId: 1 });
        await jsDebugClient.assertStoppedLocation('breakpoint', { path: Path.join('/MarkLogic/test', 'test.sjs'), line: 20 });
        await jsDebugClient.setBreakpointsRequest({ source: { path: Path.join('/MarkLogic/test', 'test.sjs') }, breakpoints: [] });
        await jsDebugClient.setBreakpointsRequest({ source: { path: Path.join('/MarkLogic/test', 'lib1.sjs') }, breakpoints: [] });
        await jsDebugClient.setBreakpointsRequest({ source: { path: Path.join('/MarkLogic/test', 'lib2.sjs') }, breakpoints: [] });
        await jsDebugClient.continueRequest({ threadId: 1 });
    }).timeout(15000);
});
