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
import * as Path from 'path';
import * as sinon from 'sinon';
import * as vscode from 'vscode';
import { DebugClient } from '@vscode/debugadapter-testsupport';

import { JsDebugManager } from '../../JSDebugger/jsDebugManager';
import { ClientContext, MlClientParameters, sendJSQuery } from '../../marklogicClient';

export class IntegrationTestHelper {

    private collection = 'VSCODE/SJS-debug-test';
    public configuredServerPort = '8055';
    public serverPortForAttaching = '8056';
    public serverSslPort = '8057';
    public appServerName = String(process.env.ML_APPSERVER || 'mlxprs-test');
    public attachServerName = String(process.env.ML_ATTACH_APPSERVER || 'mlxprsSample');
    public attachedToServer = false;
    public attachSslServerName = String(process.env.ML_ATTACH_SSL_APPSERVER || 'mlxprs-ssl-test');
    public documentsDatabase = 'mlxprs-test-content';
    public modulesDatabase = 'mlxprs-test-modules';
    public modulesDatabaseToken = '%%MODULES-DATABASE%%';
    private rootFolder = Path.join(__dirname, '../../../');
    readonly scriptFolder = Path.join(this.rootFolder, 'client/test/integration/jsScripts');
    readonly hwPath = Path.join(this.scriptFolder, 'helloWorld.sjs');
    private jsDebugExec = Path.join(this.rootFolder, 'dist/mlDebug.js');
    private xqyDebugExec = Path.join(this.rootFolder, 'dist/XQDebugger/xqyDebug.js');
    readonly showErrorPopup = sinon.stub(vscode.window, 'showErrorMessage');

    private hostname = String(process.env.ML_HOST || 'localhost');
    private port = Number(process.env.ML_PORT || this.configuredServerPort);
    readonly managePort = Number(process.env.ML_MANAGEPORT || '8002');
    private username = String(process.env.ML_USERNAME || 'admin');
    private password = String(process.env.ML_PASSWORD || 'admin');
    private modulesDB = String(process.env.ML_MODULESDB || this.modulesDatabase);
    private pathToCa = null;
    private ssl = false;
    private rejectUnauthorized = false;

    public config = null;
    public jsDebugClient: DebugClient = null;
    readonly mlClient = new ClientContext(
        new MlClientParameters({
            host: this.hostname,
            port: this.port,
            managePort: this.managePort,
            user: this.username,
            pwd: this.password,
            authType: 'DIGEST',
            contentDb: this.modulesDB,
            modulesDb: this.modulesDB,
            pathToCa: this.pathToCa,
            ssl: this.ssl,
            rejectUnauthorized: this.rejectUnauthorized
        })
    );
    readonly mlClientWithBadSsl = new ClientContext(
        new MlClientParameters({
            host: this.hostname,
            port: this.port,
            managePort: this.managePort,
            user: this.username,
            pwd: this.password,
            authType: 'DIGEST',
            contentDb: this.modulesDB,
            modulesDb: this.modulesDB,
            pathToCa: this.pathToCa,
            ssl: true,
            rejectUnauthorized: this.rejectUnauthorized
        })
    );
    readonly mlClientWithSslWithRejectUnauthorized = new ClientContext(
        new MlClientParameters({
            host: this.hostname,
            port: this.serverSslPort,
            managePort: this.managePort,
            user: this.username,
            pwd: this.password,
            authType: 'DIGEST',
            contentDb: this.modulesDB,
            modulesDb: this.modulesDB,
            pathToCa: this.pathToCa,
            ssl: true,
            rejectUnauthorized: true
        })
    );
    readonly mlClientWithBadPort = new ClientContext(
        new MlClientParameters({
            host: this.hostname,
            port: 9999,
            managePort: this.managePort,
            user: this.username,
            pwd: this.password,
            authType: 'DIGEST',
            contentDb: this.modulesDB,
            modulesDb: this.modulesDB,
            pathToCa: this.pathToCa,
            ssl: this.ssl,
            rejectUnauthorized: this.rejectUnauthorized
        })
    );

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
            authType: 'DIGEST',
            managePort: this.managePort,
            ssl: this.ssl,
            pathToCa: this.pathToCa,
            rejectUnauthorized: this.rejectUnauthorized
        };
        this.jsDebugClient = new DebugClient('node', this.jsDebugExec, 'node');

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
            // this.xqyDebugClient.start()
        ]);
    }

    async teardownEachTest(): Promise<void[]> {
        if (globalThis.integrationTestHelper.attachedToServer) {
            await JsDebugManager.disconnectFromNamedJsDebugServer(globalThis.integrationTestHelper.attachServerName);
            globalThis.integrationTestHelper.attachedToServer = false;
        }
        return new Promise((resolve) => {
            Promise.all([
                globalThis.integrationTestHelper.jsDebugClient.stop()
            ]);
            resolve([]);
        });
    }

    private async loadTestData(): Promise<void> {
        const requests = [];
        this.debugServerModules.forEach(async (fsModulePath) => {
            const fname = Path.basename(fsModulePath);
            const module = fs.readFileSync(fsModulePath);
            const qry = `declareUpdate(); let textNode = new NodeBuilder();
                    textNode.addText(\`${module}\`);
                    const options = {collections: '${this.collection}'};
                    xdmp.documentInsert("/MarkLogic/test/${fname}", textNode.toNode(), options);`;
            requests.push(sendJSQuery(this.mlClient, qry));
        });
        this.taskServerModules.forEach(async (fsModulePath) => {
            const fname = Path.basename(fsModulePath);
            const module = fs.readFileSync(fsModulePath);
            const qry = `declareUpdate(); let textNode = new NodeBuilder();
                    textNode.addText(\`${module}\`);
                    const options = {collections: '${this.collection}'};
                    xdmp.documentInsert("Apps/MarkLogic/test/${fname}", textNode.toNode(), options);`;
            requests.push(sendJSQuery(this.mlClient, qry));
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
        const newParams: MlClientParameters = JSON.parse(JSON.stringify(dbClientContext.params));
        newParams.port = this.managePort;
        const newClient = new ClientContext(newParams);
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

}

export function wait(ms: number): Promise<unknown> {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}