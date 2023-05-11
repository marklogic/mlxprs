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

suite('Basic', () => {
    const integrationTestHelper: IntegrationTestHelper = globalThis.integrationTestHelper;
    test('launch a script and it should stop at entry', async () => {
        const jsDebugClient = integrationTestHelper.jsDebugClient;
        return Promise.all([
            jsDebugClient.configurationSequence(),
            jsDebugClient.launch(integrationTestHelper.config),
            jsDebugClient.assertStoppedLocation('entry', { path: integrationTestHelper.hwPath, line: 1 })
        ]);
    }).timeout(5000);

    test('check stepOver', async () => {
        const jsDebugClient = integrationTestHelper.jsDebugClient;
        await Promise.all([
            jsDebugClient.configurationSequence(),
            jsDebugClient.launch(integrationTestHelper.config)
        ]);
        // 2 steps will actually go to the second line
        await jsDebugClient.nextRequest({ threadId: 1 });
        await jsDebugClient.waitForEvent('stopped');
        await jsDebugClient.nextRequest({ threadId: 1 });
        return jsDebugClient.assertStoppedLocation('step', { path: integrationTestHelper.hwPath, line: 4 });
    }).timeout(5000);

    test('set breakpoint', async () => {
        const jsDebugClient = integrationTestHelper.jsDebugClient;
        const hwPath = integrationTestHelper.hwPath;
        const config = integrationTestHelper.config;
        await Promise.all([
            jsDebugClient.configurationSequence(),
            jsDebugClient.launch(config)
        ]);
        await jsDebugClient.setBreakpointsRequest({ source: { path: hwPath }, breakpoints: [{ line: 4 }] });
        await jsDebugClient.continueRequest({ threadId: 1 });
        return jsDebugClient.assertStoppedLocation('breakpoint', { path: hwPath, line: 4 });
    }).timeout(5000);

    test('check stepInto', async () => {
        const jsDebugClient = integrationTestHelper.jsDebugClient;
        const hwPath = integrationTestHelper.hwPath;
        const config = integrationTestHelper.config;
        await Promise.all([
            jsDebugClient.configurationSequence(),
            jsDebugClient.launch(config)
        ]);
        await jsDebugClient.setBreakpointsRequest({ source: { path: hwPath }, breakpoints: [{ line: 6 }] });
        await jsDebugClient.continueRequest({ threadId: 1 });
        await jsDebugClient.waitForEvent('stopped');
        await jsDebugClient.stepInRequest({ threadId: 1 });
        return jsDebugClient.assertStoppedLocation('step', { path: hwPath, line: 12 });
    }).timeout(5000);

    test('check stepOut', async () => {
        const jsDebugClient = integrationTestHelper.jsDebugClient;
        const hwPath = integrationTestHelper.hwPath;
        const config = integrationTestHelper.config;
        await Promise.all([
            jsDebugClient.configurationSequence(),
            jsDebugClient.launch(config)
        ]);
        await jsDebugClient.setBreakpointsRequest({ source: { path: hwPath }, breakpoints: [{ line: 12 }] });
        await jsDebugClient.continueRequest({ threadId: 1 });
        await jsDebugClient.waitForEvent('stopped');
        await jsDebugClient.stepOutRequest({ threadId: 1 });
        return jsDebugClient.assertStoppedLocation('step', { path: hwPath, line: 7 });
    }).timeout(5000);

    test('check stack trace', async () => {
        const jsDebugClient = integrationTestHelper.jsDebugClient;
        const hwPath = integrationTestHelper.hwPath;
        const config = integrationTestHelper.config;
        await Promise.all([
            jsDebugClient.configurationSequence(),
            jsDebugClient.launch(config)
        ]);
        await jsDebugClient.setBreakpointsRequest({ source: { path: hwPath }, breakpoints: [{ line: 12 }] });
        await jsDebugClient.continueRequest({ threadId: 1 });
        const stackTrace = await jsDebugClient.assertStoppedLocation('breakpoint', { path: hwPath, line: 12 });
        const frame = stackTrace.body.stackFrames[0];
        assert(frame.name, 'loop');
        assert(frame.line, '12');
        return;
    }).timeout(5000);

    test('check variable', async () => {
        const jsDebugClient = integrationTestHelper.jsDebugClient;
        const hwPath = integrationTestHelper.hwPath;
        const config = integrationTestHelper.config;
        await Promise.all([
            jsDebugClient.configurationSequence(),
            jsDebugClient.launch(config)
        ]);
        await jsDebugClient.setBreakpointsRequest({ source: { path: hwPath }, breakpoints: [{ line: 12 }] });
        await jsDebugClient.continueRequest({ threadId: 1 });
        const stackTrace = await jsDebugClient.assertStoppedLocation('breakpoint', { path: hwPath, line: 12 });
        const frameId = stackTrace.body.stackFrames[0].id;
        const scope = await jsDebugClient.scopesRequest({ frameId: frameId });
        const vars = await jsDebugClient.variablesRequest({ variablesReference: scope.body.scopes[0].variablesReference });
        return assert.equal(vars.body.variables[0].name, 'ret');
    }).timeout(5000);

    test('check evaluate', async () => {
        const jsDebugClient = integrationTestHelper.jsDebugClient;
        const hwPath = integrationTestHelper.hwPath;
        const config = integrationTestHelper.config;
        await Promise.all([
            jsDebugClient.configurationSequence(),
            jsDebugClient.launch(config)
        ]);
        await jsDebugClient.setBreakpointsRequest({ source: { path: hwPath }, breakpoints: [{ line: 12 }] });
        await jsDebugClient.continueRequest({ threadId: 1 });
        await jsDebugClient.waitForEvent('stopped');
        const evalResult = await jsDebugClient.evaluateRequest({ expression: 'str' });
        return assert.equal(evalResult.body.result, 'Hello World SJS');
    }).timeout(5000);

    test('check conditional breakpoint', async () => {
        const jsDebugClient = integrationTestHelper.jsDebugClient;
        const hwPath = integrationTestHelper.hwPath;
        const config = integrationTestHelper.config;
        await Promise.all([
            jsDebugClient.configurationSequence(),
            jsDebugClient.launch(config)
        ]);
        await jsDebugClient.setBreakpointsRequest({ source: { path: hwPath }, breakpoints: [{ line: 14, condition: 'i==15' }] });
        await jsDebugClient.continueRequest({ threadId: 1 });
        await jsDebugClient.waitForEvent('stopped');
        const evalResult = await jsDebugClient.evaluateRequest({ expression: 'ret' });
        return assert.equal(evalResult.body.result, '105');
    }).timeout(5000);
});
