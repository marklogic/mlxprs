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

import { IntegrationTestHelper } from './markLogicIntegrationTestHelper';

suite('Testing xqy debugging', async () => {
    const integrationTestHelper: IntegrationTestHelper = globalThis.integrationTestHelper;

    test('xqy calling xdmp:eval()', async () => {
        const xqyDebugClient = integrationTestHelper.xqyDebugClient;
        const xqyConfig = integrationTestHelper.xqyConfig;

        await Promise.all([
            xqyDebugClient.configurationSequence(),
            xqyDebugClient.launch(xqyConfig)
        ]);

        await xqyDebugClient.setBreakpointsRequest({ source: { path: xqyConfig.program }, breakpoints: [{ line: 22 }] });
        await xqyDebugClient.continueRequest({ threadId: 1 });
        await xqyDebugClient.assertStoppedLocation('breakpoint', { path: xqyConfig.program, line: 22 });
        await xqyDebugClient.continueRequest({ threadId: 1 });
    }).timeout(25000);

});
