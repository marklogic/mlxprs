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
import * as sinon from 'sinon';
import { QuickPickItem } from 'vscode';

import { JsDebugManager } from '../../JSDebugger/jsDebugManager';
import { ClientContext } from '../../marklogicClient';
import { IntegrationTestHelper } from './markLogicIntegrationTestHelper';
import { XqyDebugManager } from '../../XQDebugger/xqyDebugManager';

suite('Testing \'disconnect\' functionality with varying scenarios', async () => {
    const integrationTestHelper: IntegrationTestHelper = globalThis.integrationTestHelper;
    const dbClientContext: ClientContext = integrationTestHelper.mlClient;
    const mlClientWithBadSsl: ClientContext = integrationTestHelper.mlClientWithBadSsl;
    const attachServerName: string = integrationTestHelper.attachServerName;
    const showErrorPopup = integrationTestHelper.showErrorPopup;
    const mlClientWithSslWithRejectUnauthorized: ClientContext = integrationTestHelper.mlClientWithSslWithRejectUnauthorized;


    test('When there are no "connected" app-servers, and no SSL settings are configured', async () => {
        const connectedAppServers = await JsDebugManager.getFilteredListOfJsAppServers(dbClientContext, 'true');
        showErrorPopup.resetHistory();
        assert.strictEqual(connectedAppServers.length, 0, 'Then the response should be an empty array');
        sinon.assert.notCalled(showErrorPopup);
    }).timeout(5000);


    test('When there is a single "connected" app-server, and no SSL settings are configured', async () => {
        await JsDebugManager.connectToNamedJsDebugServer(attachServerName);
        globalThis.integrationTestHelper.attachedToServer = true;

        showErrorPopup.resetHistory();
        const connectedAppServers: QuickPickItem[] = await JsDebugManager.getFilteredListOfJsAppServers(dbClientContext, 'true');
        sinon.assert.notCalled(showErrorPopup);
        assert.strictEqual(connectedAppServers.length, 1, 'Then the response array should have 1 server listed');
        assert.strictEqual(connectedAppServers[0].label, attachServerName,
            `Then the label of the server in the response array match ${attachServerName}`);
    }).timeout(5000);


    test('When there are no "connected" app-servers, and no SSL settings are configured, but the extension is set to use SSL',
        async () => {
            const connectedAppServers = await JsDebugManager.getFilteredListOfJsAppServers(mlClientWithBadSsl, 'true');
            assert.strictEqual(connectedAppServers, null,
                'Then the response should be <undefined> because the call to MarkLogic should fail.');

            showErrorPopup.resetHistory();
            await JsDebugManager.disconnectFromJsDebugServer(mlClientWithBadSsl);
            sinon.assert.calledWith(showErrorPopup, sinon.match('Could not get list of app servers'));
        }).timeout(5000);

    test('When attempting to \'connect\' App Server with a self-signed certificate and the client turns ON the \'rejectUnauthorized\' setting',
        async () => {
            showErrorPopup.resetHistory();

            const listServersForConnectQuery = mlClientWithSslWithRejectUnauthorized.buildListServersForConnectQuery();
            await JsDebugManager.getAppServerListForJs(mlClientWithSslWithRejectUnauthorized, listServersForConnectQuery);

            sinon.assert.calledWith(showErrorPopup, sinon.match('Could not get list of app servers'));
        }).timeout(5000);

    test('When attempting to \'disconnect\' App Server with a self-signed certificate and the client turns ON the \'rejectUnauthorized\' setting',
        async () => {
            showErrorPopup.resetHistory();
            await JsDebugManager.disconnectFromJsDebugServer(mlClientWithSslWithRejectUnauthorized);
            sinon.assert.calledWith(showErrorPopup, sinon.match('Could not get list of app servers'));
        }).timeout(5000);


    test('When port is misconfigured for a "connect" XQY server request',
        async () => {
            showErrorPopup.resetHistory();
            await XqyDebugManager.connectToXqyDebugServer(integrationTestHelper.mlClientWithBadPort);
            sinon.assert.calledWith(showErrorPopup, sinon.match('Could not get list of app servers'));
        }).timeout(5000);


    test('When port is misconfigured for a "disconnect" XQY server request',
        async () => {
            showErrorPopup.resetHistory();
            await XqyDebugManager.disconnectFromXqyDebugServer(integrationTestHelper.mlClientWithBadPort);
            sinon.assert.calledWith(showErrorPopup, sinon.match('Could not get list of app servers'));
        }).timeout(5000);


    test('When port is misconfigured for a "connect" JS server request',
        async () => {
            showErrorPopup.resetHistory();
            await JsDebugManager.connectToJsDebugServer(integrationTestHelper.mlClientWithBadPort);
            sinon.assert.calledWith(showErrorPopup, sinon.match('Could not get list of app servers'));
        }).timeout(5000);


    test('When port is misconfigured for a "disconnect" JS server request',
        async () => {
            showErrorPopup.resetHistory();
            await XqyDebugManager.disconnectFromXqyDebugServer(integrationTestHelper.mlClientWithBadPort);
            sinon.assert.calledWith(showErrorPopup, sinon.match('Could not get list of app servers'));
        }).timeout(5000);

});
