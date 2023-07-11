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
import * as CP from 'child_process';

import { JsDebugManager } from '../../JSDebugger/jsDebugManager';
import { ClientContext, getFilteredListOfJsAppServers } from '../../marklogicClient';
import { IntegrationTestHelper, wait } from './markLogicIntegrationTestHelper';


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


suite('Testing various MarkLogic calls', async () => {
    const integrationTestHelper: IntegrationTestHelper = globalThis.integrationTestHelper;
    const attachServerName: string = integrationTestHelper.attachServerName;

    test('When querying MarkLogic for available requests', async () => {
        await JsDebugManager.connectToNamedJsDebugServer(attachServerName);
        globalThis.integrationTestHelper.restartServer = true;

        const globalConfig = integrationTestHelper.config;
        let availableRequestsString = await JsDebugManager.getAvailableRequests(attachServerName);
        let availableRequests = JSON.parse(availableRequestsString);
        assert.strictEqual(availableRequests.requestIds.length, 0,
            'If no requests have been started, then the number of available requests should be 0');

        CP.exec(`curl --anyauth -k --user ${globalConfig.username}:${globalConfig.password} -i -X POST -H "Content-type: application/x-www-form-urlencoded" \
                    http${globalConfig.ssl ? 's' : ''}://${globalConfig.hostname}:${integrationTestHelper.serverPortForAttaching}/LATEST/invoke --data-urlencode module=/MarkLogic/test/test.sjs`);
        await wait(2000);

        availableRequestsString = await JsDebugManager.getAvailableRequests(attachServerName);
        availableRequests = JSON.parse(availableRequestsString);
        assert.strictEqual(availableRequests.requestIds.length, 1,
            'if a request has been started, then the number of available requests should be 1');
        const resp = await JsDebugManager.getRequestInfo(availableRequests.requestIds[0], attachServerName);
        assert(resp, 'if a request has been started, then retrieving info for that request should return an object');
        assert(resp['requestText'], 'if a request has been started, then retrieving info for that request should return a requestText value');
        assert(resp['startTime'], 'if a request has been started, then retrieving info for that request should return a startTime value');
    }).timeout(10000);

    test('When resolving a database id for a database name that does not exist', async () => {
        const dbId = await JsDebugManager.resolveDatabasetoId('NoSuchDatabase');
        assert.strictEqual(dbId, null, 'The return value should be null');
    }).timeout(1000);

    test('When resolving a database id for a database name that does exist', async () => {
        const dbId = await JsDebugManager.resolveDatabasetoId('mlxprs-test-content');
        assert.notEqual(dbId, null, 'The return value should not be null');
    }).timeout(1000);
});
