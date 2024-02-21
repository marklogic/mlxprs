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

import * as glob from 'glob';
import * as Mocha from 'mocha';
import * as path from 'path';
import * as vscode from 'vscode';

import { IntegrationTestHelper } from './markLogicIntegrationTestHelper';

export async function run(): Promise<void> {
    const mocha = new Mocha({
        ui: 'tdd'
    });
    globalThis.integrationTestHelper = new IntegrationTestHelper();
    await globalThis.integrationTestHelper.beforeEverything();

    // Without extending the setup, only 1 reporter is support.
    // For available reporters, see https://mochajs.org/#reporters
    // For options on configuring multiple reports, see:
    // https://github.com/mochajs/mocha/pull/1360
    // https://github.com/glenjamin/mocha-multi
    const resultsFileName = __dirname + '/../../../results/integrationTestResults.xml';
    mocha.reporter('spec');
    // Use the 'xunit' reporter when we want file output for automation
    // mocha.reporter('xunit', { output: resultsFileName });

    mocha.options.color = true;
    // Need to set the timeout a little high since some tests require a server restart
    // 10s is a little arbitrary, but it works.
    // We could set the timeout lower, but that would only save time when things are broken.
    mocha.timeout(10000);
    mocha.rootHooks({
        beforeEach: async () => {
            await globalThis.integrationTestHelper.setupEachTest();
        },
        afterEach: async () => {
            await globalThis.integrationTestHelper.teardownEachTest();
        }
    });

    const testsRoot = path.resolve(__dirname, '..');

    return new Promise((c, e) => {
        // We can change the value below to run specific test files.
        // glob('integration/marklogicClient.test.js', { cwd: testsRoot }, (err, files) => {
        glob('integration/**.test.js', { cwd: testsRoot }, (err, files) => {
            console.debug(JSON.stringify(files));
            vscode.window.showInformationMessage(JSON.stringify(files));
            if (err) {
                return e(err);
            }
            // Add files to the test suite
            files.forEach(f => {
                mocha.addFile(path.resolve(testsRoot, f));
            });

            try {
                // Run the mocha test
                mocha.run(failures => {
                    if (failures > 0) {
                        vscode.window.showErrorMessage(`${failures} tests failed.`);
                        e(new Error(`${failures} tests failed.`));
                    } else {
                        vscode.window.showInformationMessage('No failures reported');
                        c();
                    }
                });
            } catch (err) {
                e(err);
            }
        });
    });
}
