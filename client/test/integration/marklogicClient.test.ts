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

import * as assert from 'assert';

import { JsDebugManager } from '../../JSDebugger/jsDebugManager';
import { ClientContext, getFilteredListOfJsAppServers } from '../../marklogicClient';
import { IntegrationTestHelper } from './markLogicIntegrationTestHelper';

suite('Testing \'disconnect\' functionality with varying scenarios', async () => {
    const integrationTestHelper: IntegrationTestHelper = globalThis.integrationTestHelper;
    const dbClientContext: ClientContext = integrationTestHelper.mlClient;
    const managePort = integrationTestHelper.managePort;
    const attachServerName: string = integrationTestHelper.attachServerName;

    test('When there are no "connected" app-servers initially', async () => {
        const disconnectedAppServers = await getFilteredListOfJsAppServers(dbClientContext, managePort, 'false');
        assert.ok(disconnectedAppServers.length,
            'this will return an unpredictable number, but in any case it should be greater than 0');
        const connectedAppServers = await getFilteredListOfJsAppServers(dbClientContext, managePort, 'true');
        assert.equal(connectedAppServers.length, 0, 'no app servers should be returned for this list');

        await JsDebugManager.connectToNamedJsDebugServer(attachServerName);
        globalThis.integrationTestHelper.attachedToServer = true;

        const updatedDisconnectedAppServers = await getFilteredListOfJsAppServers(dbClientContext, managePort, 'false');
        assert.equal(updatedDisconnectedAppServers.length + 1, disconnectedAppServers.length,
            'This will return 1 fewer app servers than the previous number of disconnected app servers');
        const updatedConnectedAppServers = await getFilteredListOfJsAppServers(dbClientContext, managePort, 'true');
        assert.equal(updatedConnectedAppServers.length, 1, 'This will return the single app server that was connected to');
    }).timeout(5000);

});
