import * as path from 'path'
import * as Mocha from 'mocha'
import * as glob from 'glob'
import { IntegrationTestHelper } from './markLogicIntegrationTestHelper'

export function run(): Promise<void> {
    const mocha = new Mocha({
        ui: 'tdd'
    })
    globalThis.integrationTestHelper = new IntegrationTestHelper()
    mocha.options.color = true
    mocha.rootHooks({
        beforeAll: () => {
            globalThis.integrationTestHelper.beforeEverything()
        },
        beforeEach: () => {
            globalThis.integrationTestHelper.setupEachTest()
        },
        afterAll: () => {
            globalThis.integrationTestHelper.afterEverything()
        },
        afterEach: () => {
            globalThis.integrationTestHelper.teardownEachTest()
        }
    })

    const testsRoot = path.resolve(__dirname, '..')

    return new Promise((c, e) => {
        // We can change the value below to run specific test files.
        // glob('integration/sjsAdapter.test.js', { cwd: testsRoot }, (err, files) => {
        glob('integration/**.test.js', { cwd: testsRoot }, (err, files) => {
            if (err) {
                return e(err)
            }

            // Add files to the test suite
            files.forEach(f => {
                mocha.addFile(path.resolve(testsRoot, f))
            })

            try {
                // Run the mocha test
                mocha.run(failures => {
                    if (failures > 0) {
                        e(new Error(`${failures} tests failed.`))
                    } else {
                        c()
                    }
                })
            } catch (err) {
                e(err)
            }
        })
    })
}
