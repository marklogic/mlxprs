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

import * as fs from 'fs';
import * as ml from 'marklogic';
import * as Path from 'path';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { DebugClient } from '@vscode/debugadapter-testsupport';

import { JsDebugManager } from '../../JSDebugger/jsDebugManager';
import { ClientContext, sendJSQuery } from '../../marklogicClient';
import { ClientFactory } from '../../clientFactory';

export class IntegrationTestHelper {

    private collection = 'VSCODE/SJS-debug-test';
    public configuredServerPort = '8055';
    public serverPortForAttaching = '8056';
    public serverSslPort = '8057';
    public appServerName = String(process.env.ML_APPSERVER || 'mlxprs-test');
    public attachServerName = String(process.env.ML_ATTACH_APPSERVER || 'mlxprsSample');
    public attachedToServer = false;
    public restartServer = false;
    public attachSslServerName = String(process.env.ML_ATTACH_SSL_APPSERVER || 'mlxprs-ssl-test');
    public documentsDatabase = 'mlxprs-test-content';
    public modulesDatabase = 'mlxprs-test-modules';
    public modulesDatabaseToken = '%%MODULES-DATABASE%%';
    readonly rootFolder = Path.join(__dirname, '../../../');
    readonly jsScriptFolder = Path.join(this.rootFolder, 'client/test/integration/jsScripts');
    readonly xqyScriptFolder = Path.join(this.rootFolder, 'client/test/integration/xqyScripts');
    readonly testAppFolder = Path.join(__dirname, '../../../test-app');
    readonly hwPath = Path.join(this.jsScriptFolder, 'helloWorld.sjs');
    readonly hwXqyPath = Path.join(this.xqyScriptFolder, 'factorial.xqy');
    private jsDebugExec = Path.join(this.rootFolder, 'dist/mlDebug.js');
    private xqyDebugExec = Path.join(this.rootFolder, 'dist/XQDebugger/xqyDebug.js');
    readonly showErrorPopup = sinon.stub(vscode.window, 'showErrorMessage');

    private hostname = String(process.env.ML_HOST || 'localhost');
    private port = Number(process.env.ML_PORT || this.configuredServerPort);
    readonly restBasePath = process.env.ML_RESTBASEPATH ? String(process.env.ML_RESTBASEPATH) : '';
    readonly managePort = Number(process.env.ML_MANAGEPORT) || 8059;
    readonly manageBasePath = process.env.ML_MANAGEBASEPATH ? String(process.env.ML_MANAGEBASEPATH) : '';
    readonly testPort = Number(process.env.ML_TESTPORT || '8054');
    readonly testBasePath = process.env.ML_TESTBASEPATH ? String(process.env.ML_TESTBASEPATH) : '';
    private username = String(process.env.ML_USERNAME || 'admin');
    private password = String(process.env.ML_PASSWORD || 'admin');
    private modulesDB = String(process.env.ML_MODULESDB || this.modulesDatabase);
    private pathToCa = null;
    private ssl = false;
    private rejectUnauthorized = false;

    private clientDefaults = {
        host: this.hostname,
        port: this.port,
        restBasePath: this.restBasePath,
        managePort: this.managePort,
        manageBasePath: this.manageBasePath,
        user: this.username,
        password: this.password,
        authType: 'BASIC',
        contentDb: this.documentsDatabase,
        modulesDb: this.modulesDB,
        pathToCa: this.pathToCa,
        ssl: this.ssl,
        rejectUnauthorized: this.rejectUnauthorized
    };
    public config = null;
    public xqyConfig = null;
    public jsDebugClient: DebugClient = null;
    public xqyDebugClient: DebugClient = null;

    readonly mlClient = this.newClientWithDefaultsAndOverrides();
    readonly mlClientWithBadSsl = this.newClientWithDefaultsAndOverrides({
        ssl: true
    });
    readonly mlClientWithSslWithRejectUnauthorized = this.newClientWithDefaultsAndOverrides({
        port: this.serverSslPort,
        ssl: true,
        rejectUnauthorized: true
    });
    readonly mlClientWithBadPort = this.newClientWithDefaultsAndOverrides({
        port: 9999
    });
    readonly mlModulesClient = this.newClientWithDefaultsAndOverrides({
        contentDb: 'mlxprs-test-modules'
    });

    // Need to only define the parameters here, and the client in the test
    // Due to the internal global variables in the internal.js file
    readonly mlUnitTestClientParameters = new ClientFactory({
        host: this.hostname,
        port: null,
        restBasePath: null,
        testPort: this.testPort,
        testBasePath: this.testBasePath,
        managePort: ClientContext.DEFAULT_MANAGE_PORT,
        user: this.username,
        password: this.password,
        authType: 'BASIC',
        contentDb: 'mlxprs-test-test-content',
        modulesDb: null,
        pathToCa: this.pathToCa,
        ssl: false,
        rejectUnauthorized: true
    });

    private module1 = Path.join(this.rootFolder, 'client/test/integration/jsScripts/MarkLogic/test/test.sjs');
    private module2 = Path.join(this.rootFolder, 'client/test/integration/jsScripts/MarkLogic/test/lib1.sjs');
    private module3 = Path.join(this.rootFolder, 'client/test/integration/jsScripts/MarkLogic/test/lib2.sjs');
    private module4 = Path.join(this.rootFolder, 'client/test/integration/jsScripts/MarkLogic/test/invoke1.xqy');
    private module5 = Path.join(this.rootFolder, 'client/test/integration/jsScripts/helloWorld.sjs');
    private module6 = Path.join(this.rootFolder, 'client/test/integration/jsScripts/MarkLogic/test/jsInvoke-1.sjs');
    private module7 = Path.join(this.rootFolder, 'client/test/integration/jsScripts/MarkLogic/test/xqyInvoke-1.xqy');
    private module8 = Path.join(this.rootFolder, 'client/test/integration/jsScripts/MarkLogic/test/jsInvoke-2.sjs');

    private debugServerModules = [this.module1, this.module2, this.module3, this.module4, this.module5, this.module6];
    private taskServerModules = [this.module6, this.module7, this.module8];

    async beforeEverything(): Promise<void> {
        await this.loadTestData();
        await this.restartMarkLogic();
        await wait(500);
        let markLogicIsRunning = false;
        while (!markLogicIsRunning) {
            await wait(500);
            markLogicIsRunning = await this.isMarkLogicRunning();
        }
    }

    async afterEverything(): Promise<void> {
        this.showErrorPopup.restore();
        await this.deleteTestData();
    }

    async setupEachTest(): Promise<void[]> {
        this.config = {
            program: this.hwPath,
            queryText: fs.readFileSync(this.hwPath).toString(),
            username: this.username,
            password: this.password,
            hostname: this.hostname,
            authType: 'BASIC',
            managePort: this.managePort,
            ssl: this.ssl,
            pathToCa: this.pathToCa,
            rejectUnauthorized: this.rejectUnauthorized
        };
        this.xqyConfig = {
            program: this.hwXqyPath,
            query: fs.readFileSync(this.hwXqyPath).toString(),
            clientParams: {
                host: this.hostname,
                port: this.testPort,
                user: this.username,
                password: this.password,
                pwd: this.password,
                database: 'mlxprs-test-test-content',
                contentDb: 'mlxprs-test-test-content',
                authType: 'BASIC',
                managePort: this.managePort,
                ssl: this.ssl,
                pathToCa: this.pathToCa,
                rejectUnauthorized: this.rejectUnauthorized
            }
        };
        this.jsDebugClient = new DebugClient('node', this.jsDebugExec, 'node');
        this.xqyDebugClient = new DebugClient('node', this.xqyDebugExec, 'xquery-ml', {}, true);

        return Promise.all([
            // Include the port parameter when using the debugger with the "Launch ??? Debug Adapter Server" launch configuration in launch.json
            // This is useful when you want to debug the adapter code while running a test
            // this.jsDebugClient.start(4711),

            // Exclude the port parameter when you want the test to start/stop a Debug Adapter Server on it's own.
            // This is useful when the tests are automated.
            this.jsDebugClient.start(),


            // We have not been successful creating an XQY Debug Client for the automated integration tests.
            // However, the information below will be useful if we try again in the future.
            // this.xqyDebugClient.start(4712)
            this.xqyDebugClient.start()
        ]);
    }

    async teardownEachTest(): Promise<void[]> {
        if (globalThis.integrationTestHelper.attachedToServer) {
            await JsDebugManager.disconnectFromNamedJsDebugServer(globalThis.integrationTestHelper.attachServerName);
            globalThis.integrationTestHelper.attachedToServer = false;
        }
        // Some tests can leave the MarkLogic server in a state that causes future tests to fail.
        // The only reliable method for resolving this state is to restart the MarkLogic server.
        if (globalThis.integrationTestHelper.restartServer) {
            await this.restartMarkLogic();
            globalThis.integrationTestHelper.restartServer = false;
            await wait(500);
            let markLogicIsRunning = false;
            while (!markLogicIsRunning) {
                await wait(500);
                markLogicIsRunning = await this.isMarkLogicRunning();
            }
        }

        return new Promise((resolve) => {
            Promise.all([
                globalThis.integrationTestHelper.jsDebugClient.stop(),
                globalThis.integrationTestHelper.xqyDebugClient.stop()
            ]);
            resolve([]);
        });
    }

    private async loadTestData(): Promise<void> {
        const requests = [];
        this.debugServerModules.forEach(async (fsModulePath) => {
            const fname = Path.basename(fsModulePath);
            const module = fs.readFileSync(fsModulePath);
            const qry = `declareUpdate(); let textNode = new NodeBuilder(); textNode.addText(\`${module}\`); const options = {collections: '${this.collection}'}; xdmp.documentInsert('/MarkLogic/test/${fname}', textNode.toNode(), options);`;
            requests.push(sendJSQuery(this.mlModulesClient, qry));
        });
        this.taskServerModules.forEach(async (fsModulePath) => {
            const fname = Path.basename(fsModulePath);
            const module = fs.readFileSync(fsModulePath);
            const qry = `declareUpdate(); let textNode = new NodeBuilder();
                    textNode.addText(\`${module}\`);
                    const options = {collections: '${this.collection}'};
                    xdmp.documentInsert("Apps/MarkLogic/test/${fname}", textNode.toNode(), options);`;
            requests.push(sendJSQuery(this.mlModulesClient, qry));
        });
        try {
            try {
                const resp = await Promise.all(requests);
                console.debug(`response: ${JSON.stringify(resp)}`);
            } catch (err) {
                console.error(`Error uploading modules: ${JSON.stringify(err)}`);
            }
        } finally {
            vscode.window.showInformationMessage('SJS Debugger Tests starting...');
        }
    }

    private async deleteTestData(): Promise<void> {
        await sendJSQuery(this.mlClient, `declareUpdate(); xdmp.collectionDelete('${this.collection}')`)
            .result(
                () => {
                    console.debug(`Removed ${this.collection} modules after SJS debugger tests.`);
                    return;
                },
                (err) => {
                    console.error(`Error removing modules after tests: ${JSON.stringify(err)}`);
                })
            .then(() => {
                vscode.window.showInformationMessage('SJS Debugger tests done!');
            });
    }

    async getRid(dbClientContext: ClientContext, qry: string): Promise<string[]> {
        const overrides: Record<string, any> = {
            password: dbClientContext.params['pwd'],
            managePort: this.managePort,
            manageBasePath: this.manageBasePath
        };
        const clientFactory = new ClientFactory({ ...dbClientContext.params, ...overrides });
        const newClient: ClientContext = clientFactory.newMarklogicManageClient();
        return sendJSQuery(newClient, qry)
            .result(
                (fulfill: Record<string, never>[]) => {
                    return fulfill.map(o => {
                        return o.value;
                    });
                },
                (err) => {
                    throw err;
                });
    }

    private async restartMarkLogic(): Promise<string> {
        const overrides: Record<string, any> = {
            // password: dbClientContext.params['pwd'],
            managePort: this.managePort,
            manageBasePath: this.manageBasePath
        };
        const clientFactory = new ClientFactory({ ...this.clientDefaults, ...overrides });
        const manageClient = clientFactory.newMarklogicManageClient();

        return new Promise((resolve, reject) => {
            manageClient.databaseClient.internal.sendRequest(
                '/manage/v2',
                (requestOptions: ml.RequestOptions) => {
                    requestOptions.method = 'POST';
                    requestOptions.headers = {
                        'Content-type': 'application/json'
                    };
                },
                (operation: ml.RequestOperation) => {
                    operation.requestBody = '{"operation": "restart-local-cluster"}';
                })
                .result((result: string) => {
                    resolve(result);
                })
                .catch((error) => {
                    if (error.statusCode === 202) {
                        resolve('202');
                    } else {
                        reject(error);
                    }
                });
        });
    }

    private async isMarkLogicRunning(): Promise<boolean> {
        const overrides: Record<string, any> = {
            // password: dbClientContext.params['pwd'],
            managePort: this.managePort,
            manageBasePath: this.manageBasePath
        };
        const clientFactory = new ClientFactory({ ...this.clientDefaults, ...overrides });
        const manageClient = clientFactory.newMarklogicManageClient();

        return new Promise((resolve) => {
            manageClient.databaseClient.internal.sendRequest(
                '/admin/v1/timestamp',
                (requestOptions: ml.RequestOptions) => {
                    requestOptions.method = 'GET';
                })
                .result(() => {
                    resolve(true);
                })
                .catch(() => {
                    resolve(false);
                });
        });
    }

    private newClientWithDefaultsAndOverrides(overrides: object = {}): ClientContext {
        const newParams = new ClientFactory({ ...this.clientDefaults, ...overrides });
        return newParams.newMarklogicRestClient();
    }

}

export function wait(ms: number): Promise<unknown> {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}