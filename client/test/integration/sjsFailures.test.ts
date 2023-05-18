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

import { IntegrationTestHelper } from './markLogicIntegrationTestHelper';


suite('Testing SJS Debug failures in various scenarios, including a couple of successes to verify', async () => {
    const integrationTestHelper: IntegrationTestHelper = globalThis.integrationTestHelper;

    test('Attempt to Launch Eval Debug with SSL OFF in extension and in MarkLogic', async () => {
        const globalConfig = integrationTestHelper.config;
        globalConfig.queryText = '"A" + 1;';

        const jsDebugClient = integrationTestHelper.jsDebugClient;
        let launchResponse = null;
        await Promise.all([
            jsDebugClient.configurationSequence(),
            launchResponse = await jsDebugClient.launch(globalConfig)
        ]);
        assert.equal(launchResponse.body, null, 'Should work properly');
    }).timeout(5000);

    test('Attempt to Launch Eval Debug with SSL ON in extension, but OFF in MarkLogic', async () => {
        const globalConfig = integrationTestHelper.config;
        globalConfig.ssl = true;
        globalConfig.queryText = '"A" + 1;';

        const jsDebugClient = integrationTestHelper.jsDebugClient;
        let launchResponse = null;
        await Promise.all([
            jsDebugClient.configurationSequence(),
            launchResponse = await jsDebugClient.launch(globalConfig)
        ]);
        assert.equal(launchResponse.body.name, 'RequestError', 'The response should contain an error object with the expected name.');
    }).timeout(5000);

    test('Attempt to Launch Eval Debug with SSL OFF in extension, but ON in MarkLogic', async () => {
        const globalConfig = integrationTestHelper.config;
        globalConfig.port = 8057;
        globalConfig.managePort = 8052;
        globalConfig.queryText = '"A" + 1;';

        const jsDebugClient = integrationTestHelper.jsDebugClient;
        let launchResponse = null;
        await Promise.all([
            jsDebugClient.configurationSequence(),
            launchResponse = await jsDebugClient.launch(globalConfig)
        ]);
        assert.equal(launchResponse.body.name, 'RequestError', 'The response should contain an error object with the expected name.');
    }).timeout(5000);

    test('Attempt to Launch Eval Debug with SSL ON in extension and in MarkLogic', async () => {
        const globalConfig = integrationTestHelper.config;
        globalConfig.port = 8057;
        globalConfig.managePort = 8052;
        globalConfig.ssl = true;
        globalConfig.queryText = '"A" + 1;';

        const jsDebugClient = integrationTestHelper.jsDebugClient;
        let launchResponse = null;
        await Promise.all([
            jsDebugClient.configurationSequence(),
            launchResponse = await jsDebugClient.launch(globalConfig)
        ]);
        assert.equal(launchResponse.body, null, 'Should work properly');
    }).timeout(10000);

    test('Attempt to Launch Eval Debug with malformed JavaScript', async () => {
        const globalConfig = integrationTestHelper.config;
        globalConfig.queryText = 'aconst gibberish;';

        const jsDebugClient = integrationTestHelper.jsDebugClient;
        let launchResponse = null;
        await Promise.all([
            jsDebugClient.configurationSequence(),
            launchResponse = await jsDebugClient.launch(globalConfig)
        ]);
        assert.equal(launchResponse.body.name, 'StatusCodeError', 'The response should contain an error object with the expected name.');
    }).timeout(10000);

    test('Attempt to Launch Eval Debug with a bad password', async () => {
        const globalConfig = integrationTestHelper.config;
        globalConfig.password = 'qwerty';

        const jsDebugClient = integrationTestHelper.jsDebugClient;
        let launchResponse = null;
        await Promise.all([
            jsDebugClient.configurationSequence(),
            launchResponse = await jsDebugClient.launch(globalConfig)
        ]);
        assert.equal(launchResponse.body.name, 'StatusCodeError', 'The response should contain an error object with the expected name.');
    }).timeout(5000);

});
