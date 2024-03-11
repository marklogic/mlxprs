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
import * as assert from 'assert';
import * as Path from 'path';
import { DebugClient } from '@vscode/debugadapter-testsupport';
import { DebugProtocol } from '@vscode/debugprotocol';
import * as CP from 'child_process';
import * as fs from 'fs';

import { IntegrationTestHelper, wait } from './markLogicIntegrationTestHelper';
import { JsDebugManager } from '../../JSDebugger/jsDebugManager';


suite('Issue 70', async () => {
    const integrationTestHelper: IntegrationTestHelper = globalThis.integrationTestHelper;

    test('check non-existing modules are loaded', async () => {
        const globalConfig = integrationTestHelper.config;
        await JsDebugManager.connectToNamedJsDebugServer(integrationTestHelper.attachServerName);
        globalThis.integrationTestHelper.attachedToServer = true;
        const jsScriptFolder = integrationTestHelper.jsScriptFolder;
        const path = Path.join(jsScriptFolder, 'helloWorld.sjs');
        const text = fs.readFileSync(path).toString();

        CP.exec(`curl --anyauth -k --user ${globalConfig.username}:${globalConfig.password} -i -X POST -H "Content-type: application/x-www-form-urlencoded" \
                    http${globalConfig.ssl ? 's' : ''}://${globalConfig.hostname}:${integrationTestHelper.serverPortForAttaching}/LATEST/invoke --data-urlencode module=/MarkLogic/test/helloWorld.sjs`);
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
        const stackResponse = await jsDebugClient.stackTraceRequest({ threadId: 1 });
        const src = stackResponse['body']['stackFrames'][0]['source'];
        assert.equal(9, src['sourceReference'], 'confrim stackFrame source id indicates non-existing file');
        const srcReqResponse = await jsDebugClient.sourceRequest({ source: src, sourceReference: src.sourceReference });
        assert.equal(srcReqResponse['body']['content'], text, 'check if modules is streamed back');
        await jsDebugClient.continueRequest({ threadId: 1 });
    }).timeout(10000);

});
