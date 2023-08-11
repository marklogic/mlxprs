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
import { DebugProtocol } from '@vscode/debugprotocol';
import * as CP from 'child_process';

import { IntegrationTestHelper, wait } from './markLogicIntegrationTestHelper';


suite('Issue 69', async () => {
    const integrationTestHelper: IntegrationTestHelper = globalThis.integrationTestHelper;

    test('set breakpoints on two files', async () => {
        const mlClient = integrationTestHelper.mlClient;
        const jsScriptFolder = integrationTestHelper.jsScriptFolder;
        const globalConfig = integrationTestHelper.config;

        CP.exec(`curl --anyauth -k --user ${globalConfig.username}:${globalConfig.password} -i -X POST -H "Content-type: application/x-www-form-urlencoded" \
                    http${globalConfig.ssl ? 's' : ''}://${globalConfig.hostname}:${integrationTestHelper.serverPortForAttaching}/LATEST/invoke --data-urlencode module=/MarkLogic/test/test.sjs`);
        await wait(1000);
        const resp = await integrationTestHelper.getRid(mlClient, 'xdmp.serverStatus(xdmp.host(),xdmp.server(this.attachServerName)).toObject()[0].requestStatuses[0].requestId');
        const rid = resp[0];
        const root = Path.join(jsScriptFolder, 'MarkLogic/test');
        const config = {
            rid: rid, root: root,
            username: globalConfig.username, password: globalConfig.password,
            hostname: globalConfig.hostname, authType: 'DIGEST',
            ssl: globalConfig.ssl, pathToCa: globalConfig.pathToCa, rejectUnauthorized: globalConfig.rejectUnauthorized
        };
        const debugClient = integrationTestHelper.jsDebugClient;
        await Promise.all([
            debugClient.initializeRequest(),
            debugClient.configurationSequence(),
            debugClient.attachRequest(config as DebugProtocol.AttachRequestArguments)
        ]);

        await debugClient.setBreakpointsRequest({ source: { path: Path.join('/MarkLogic/test', 'test.sjs') }, breakpoints: [{ line: 3 }] });
        await debugClient.setBreakpointsRequest({ source: { path: Path.join('/MarkLogic/test', 'lib1.sjs') }, breakpoints: [{ line: 2 }] });
        await debugClient.setBreakpointsRequest({ source: { path: Path.join('/MarkLogic/test', 'lib2.sjs') }, breakpoints: [{ line: 2 }] });

        await debugClient.continueRequest({ threadId: 1 });
        await debugClient.waitForEvent('stopped');
        await debugClient.continueRequest({ threadId: 1 });
        await debugClient.waitForEvent('stopped');
        await debugClient.continueRequest({ threadId: 1 });
        await debugClient.waitForEvent('stopped');
        await debugClient.continueRequest({ threadId: 1 });
        return debugClient.assertStoppedLocation('breakpoint', { path: Path.join('/MarkLogic/test', 'test.sjs'), line: 3 });
    }).timeout(10000).skip();
});
