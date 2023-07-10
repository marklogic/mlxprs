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
import { XMLParser } from 'fast-xml-parser';

import { ClientContext, requestMarkLogicUnitTest } from '../../marklogicClient';
import { IntegrationTestHelper } from './markLogicIntegrationTestHelper';

const options = {
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    format: true
};

suite('Testing MarkLogic-Unit-Test functionality', async () => {
    const integrationTestHelper: IntegrationTestHelper = globalThis.integrationTestHelper;

    test('When a test is requested that should pass completely', async () => {
        const mlUnitTestClient: ClientContext = new ClientContext(integrationTestHelper.mlUnitTestClientParameters);
        await requestMarkLogicUnitTest(mlUnitTestClient, 'SampleJavaScriptTestSuite', 'sample-jstest.sjs')
            .result((testResults: string) => {
                const parser = new XMLParser(options);
                const jObj = parser.parse(testResults);
                assert.equal(jObj['test:suite']['@_failed'], '0', 'Then there should be 0 failing tests');
            })
            .catch(error => {
                console.debug(error);
                assert.fail(`Then the call to MarkLogic should succeed (even if the tests fail): ${error.message}`);
            });
    }).timeout(5000);

    test('When a test is requested that does not exist', async () => {
        const mlUnitTestClient: ClientContext = new ClientContext(integrationTestHelper.mlUnitTestClientParameters);
        await requestMarkLogicUnitTest(mlUnitTestClient, 'SampleJavaScriptTestSuite', 'doesNotExist.sjs')
            .result((testResults: string) => {
                const parser = new XMLParser(options);
                const jObj = parser.parse(testResults);
                assert.equal(jObj['test:suite']['@_failed'], '1', 'Then there should be 1 failing tests');
                assert.equal(jObj['test:suite']['@_passed'], '0', 'Then there should be 0 passing tests');
                assert.equal(jObj['test:suite']['test:test']['test:result']['error:error']['error:code'], 'XDMP-MODNOTFOUND', 'Then the failure should be due to a module not found');
            })
            .catch(error => {
                console.debug(error);
                assert.fail(`Then the call to MarkLogic should succeed (even if the tests fail): ${error.message}`);
            });
    }).timeout(5000);

    test('When a test is requested that should have a failing test', async () => {
        const mlUnitTestClient: ClientContext = new ClientContext(integrationTestHelper.mlUnitTestClientParameters);
        await requestMarkLogicUnitTest(mlUnitTestClient, 'SampleJavaScriptTestSuite', 'sample-failing-jstest.sjs')
            .result((testResults: string) => {
                const parser = new XMLParser(options);
                const jObj = parser.parse(testResults);
                assert.equal(jObj['test:suite']['@_failed'], '1', 'Then there should be 1 failing tests');
                assert.equal(jObj['test:suite']['@_passed'], '0', 'Then there should be 0 passing tests');
                assert.equal(jObj['test:suite']['test:test']['test:result']['error:error']['error:message'], 'expected: 0 actual: 2', 'Then the failure should be due to an unexpected value');
            })
            .catch(error => {
                console.debug(error);
                assert.fail(`Then the call to MarkLogic should succeed (even if the tests fail): ${error.message}`);
            });
    }).timeout(5000);

});
