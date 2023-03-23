import * as path from 'path';
import * as Mocha from 'mocha';
import * as glob from 'glob';
import { IntegrationTestHelper } from './markLogicIntegrationTestHelper';
import * as vscode from 'vscode';

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
    mocha.reporter('xunit', { output: resultsFileName });
    // mocha.reporter('spec')

    mocha.options.color = true;
    mocha.rootHooks({
        beforeEach: () => {
            globalThis.integrationTestHelper.setupEachTest();
        },
        afterEach: () => {
            globalThis.integrationTestHelper.teardownEachTest();
        }
    });

    const testsRoot = path.resolve(__dirname, '..');

    return new Promise((c, e) => {
        // We can change the value below to run specific test files.
        // glob('integration/sjsAdapter.test.js', { cwd: testsRoot }, (err, files) => {
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
