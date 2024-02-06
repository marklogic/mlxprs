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
import * as fs from 'fs';
import * as Path from 'path';

import { MarkLogicTdeValidateClient } from '../../marklogicTdeValidateClient';
import { IntegrationTestHelper } from './markLogicIntegrationTestHelper';

suite('Testing TDE Template Validation functionality', async () => {
    const integrationTestHelper: IntegrationTestHelper = globalThis.integrationTestHelper;
    const mlClient = integrationTestHelper.mlClient;
    const markLogicTdeValidateClient = new MarkLogicTdeValidateClient(null);

    test('When a valid JSON TDE Template is validated', async () => {
        const validationResult = await validateFile('test-app/src/main/ml-schemas/authors-TDE.json');
        assert.equal(validationResult['valid'], true, 'Then the validation result should true');
    }).timeout(5000);

    test('When a valid XML TDE Template is validated', async () => {
        const validationResult = await validateFile('test-app/src/main/ml-schemas/publications-TDE.xml');
        assert.equal(validationResult['valid'], true, 'Then the validation result should true');
    }).timeout(5000);

    test('When an invalid JSON TDE Template is validated', async () => {
        const validationResult = await validateFile('test-app/src/main/ml-bad-schemas/invalid-authors-TDE.json');
        assert.equal(validationResult['valid'], false, 'Then the validation result should false');
        assert.equal(validationResult['error'], 'TDE-INVALIDTEMPLATENODE', 'Then the validation error should match the expected error');
    }).timeout(5000);

    test('When an invalid XML TDE Template is validated', async () => {
        const validationResult = await validateFile('test-app/src/main/ml-bad-schemas/invalid-publications-TDE.xml');
        assert.equal(validationResult['valid'], false, 'Then the validation result should false');
        assert.equal(validationResult['error'], 'TDE-INVALIDTEMPLATENODE', 'Then the validation error should match the expected error');
    }).timeout(5000);

    test('When an unparsable JSON TDE Template is validated', async () => {
        const validationResult = await validateFile('test-app/src/main/ml-bad-schemas/invalid-json-TDE.json');
        assert.equal(validationResult, 'To be validated, the template must be either valid JSON or XML.',
            'Then the validation result should be an error message');
    }).timeout(5000);

    test('When an unparsable XML TDE Template is validated', async () => {
        const validationResult = await validateFile('test-app/src/main/ml-bad-schemas/invalid-xml-TDE.xml');
        assert.equal(validationResult, 'To be validated, the template must be either valid JSON or XML.',
            'Then the validation result should be an error message');
    }).timeout(5000);

    async function validateFile(jsonTdeRelativeFilePath: string) {
        const jsonTdeFilePath = Path.join(integrationTestHelper.rootFolder, jsonTdeRelativeFilePath);
        const module = fs.readFileSync(jsonTdeFilePath);
        return await markLogicTdeValidateClient.validateTdeTemplate(mlClient, module.toString('utf8'));
    }
});

suite('Testing TDE Template Node Extraction functionality', async () => {
    const integrationTestHelper: IntegrationTestHelper = globalThis.integrationTestHelper;
    const mlClient = integrationTestHelper.mlClient;
    const markLogicTdeValidateClient = new MarkLogicTdeValidateClient(null);
    const testAppDir = integrationTestHelper.testAppFolder;

    test('When a valid JSON TDE is used for Node Extraction', async () => {
        const validationResult = await extractNodes('test-app/src/main/ml-schemas/authors-TDE.json');
        assert.equal(validationResult['/citations.xml'].length, 15, 'Then the number of resulting nodes should match');
        assert.equal(validationResult['/extraCitations.xml'], null, 'Then there should not be an "/extraCitations.xml" property');
    }).timeout(5000);

    test('When a valid XML TDE Template is used for Node Extraction', async () => {
        const validationResult = await extractNodes('test-app/src/main/ml-schemas/publications-TDE.xml');
        assert.equal(validationResult['/citations.xml'].length, 5, 'Then the number of resulting nodes should match');
        assert.equal(validationResult['/extraCitations.xml'], null, 'Then there should not be an "/extraCitations.xml" property');
    }).timeout(5000);

    test('When an invalid JSON TDE Template is used for Node Extraction', async () => {
        const validationResult = await extractNodes('test-app/src/main/ml-bad-schemas/invalid-authors-TDE.json') as string;
        assert.equal(
            validationResult.startsWith('Unable to extract nodes using the template: TDE-INVALIDTEMPLATENODE:'), true,
            'Then the validation result should false');
    }).timeout(5000);

    test('When an invalid XML TDE Template is used for Node Extraction', async () => {
        const validationResult = await extractNodes('test-app/src/main/ml-bad-schemas/invalid-publications-TDE.xml') as string;
        assert.equal(
            validationResult.startsWith('Unable to extract nodes using the template: TDE-INVALIDTEMPLATENODE:'), true,
            'Then the validation result should false');
    }).timeout(5000);

    test('When an unparsable JSON TDE Template is used for Node Extraction', async () => {
        const validationResult = await extractNodes('test-app/src/main/ml-bad-schemas/invalid-json-TDE.json');
        assert.equal(validationResult, 'To perform node extraction, the template must be either valid JSON or XML.',
            'Then the validation result should be an error message');
    }).timeout(5000);

    test('When an unparsable XML TDE Template is used for Node Extraction', async () => {
        const validationResult = await extractNodes('test-app/src/main/ml-bad-schemas/invalid-xml-TDE.xml');
        assert.equal(validationResult, 'To perform node extraction, the template must be either valid JSON or XML.',
            'Then the validation result should be an error message');
    }).timeout(5000);

    test('When a JSON TDE Template without the MLXPRS_TEST_URI var is used for Node Extraction', async () => {
        const validationResult = await extractNodes('test-app/src/main/ml-schemas/no-var-authors-TDE.json');
        assert.equal(validationResult,
            'To perform node extraction, the template must include a "var" entry with the name property "MLXPRS_TEST_URI" or "MLXPRS_TEST_FILE", and a val property with the URI of the target document.',
            'Then the validation result should be an error message');
    }).timeout(5000);

    test('When a XML TDE Template without the MLXPRS_TEST_URI var is used for Node Extraction', async () => {
        const validationResult = await extractNodes('test-app/src/main/ml-schemas/no-var-publications-TDE.xml');
        assert.equal(validationResult,
            'To perform node extraction, the template must include a "var" entry with the name property "MLXPRS_TEST_URI" or "MLXPRS_TEST_FILE", and a val property with the URI of the target document.',
            'Then the validation result should be an error message');
    }).timeout(5000);

    test('When a valid JSON TDE is used for Node Extraction from a local data file', async () => {
        const validationResult = await extractNodes('test-app/src/main/ml-schemas/authors-local-data-TDE.json', testAppDir);
        assert.equal(validationResult['document1'].length, 3, 'Then the number of resulting nodes should match');
    }).timeout(5000);

    test('When a valid XML TDE Template is used for Node Extraction from a local data file', async () => {
        const validationResult = await extractNodes('test-app/src/main/ml-schemas/publications-local-data-TDE.xml', testAppDir);
        assert.equal(validationResult['document1'].length, 2, 'Then the number of resulting nodes should match');
    }).timeout(5000);

    async function extractNodes(jsonTdeRelativeFilePath: string, rootDir: string = null) {
        const jsonTdeFilePath = Path.join(integrationTestHelper.rootFolder, jsonTdeRelativeFilePath);
        const module = fs.readFileSync(jsonTdeFilePath);
        return await markLogicTdeValidateClient.tdeExtractNodes(mlClient, module.toString('utf8'), rootDir);
    }
});
