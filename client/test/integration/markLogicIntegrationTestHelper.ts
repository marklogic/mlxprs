import * as fs from 'fs';
import * as Path from 'path';
import * as vscode from 'vscode';
import { DebugClient } from '@vscode/debugadapter-testsupport';

import { _connectServer, _disconnectServer } from '../../JSDebugger/configurationProvider';
import { MarklogicClient, MlClientParameters, sendJSQuery } from '../../marklogicClient';

export class IntegrationTestHelper {

    private collection = 'VSCODE/SJS-debug-test';
    public appServerPort = '8055';
    public documentsDatabase = 'mlxprs-test-content';
    public modulesDatabase = 'mlxprs-test-modules';
    public modulesDatabaseToken = '%%MODULES-DATABASE%%';
    private rootFolder = Path.join(__dirname, '../../../');
    readonly scriptFolder = Path.join(this.rootFolder, 'client/test/integration/jsScripts');
    readonly hwPath = Path.join(this.scriptFolder, 'helloWorld.sjs');
    private exec = Path.join(this.rootFolder, 'dist/mlDebug.js');

    private wcfg = vscode.workspace.getConfiguration();
    private hostname = String(process.env.ML_HOST || this.wcfg.get('marklogic.host') || 'localhost');
    private port = Number(process.env.ML_PORT || this.wcfg.get('marklogic.port') || this.appServerPort);
    private managePort = Number(process.env.ML_MANAGEPORT || this.wcfg.get('marklogic.managePort') || '8002');
    private username = String(process.env.ML_USERNAME || this.wcfg.get('marklogic.username') || 'admin');
    private password = String(process.env.ML_PASSWORD || this.wcfg.get('marklogic.password') || 'admin');
    private modulesDB = String(process.env.ML_MODULESDB || this.wcfg.get('marklogic.modulesDb') || this.modulesDatabase);
    private pathToCa = String(this.wcfg.get('marklogic.pathToCa') || '');
    private ssl = Boolean(this.wcfg.get('marklogic.ssl'));
    private rejectUnauthorized = Boolean(this.wcfg.get('marklogic.rejectUnauthorized'));
    public appServerName = String(process.env.ML_APPSERVER || 'mlxprs-test');

    public config = null;
    public debugClient = null;
    readonly mlClient = new MarklogicClient(
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
        _disconnectServer(this.appServerName);
        _connectServer(this.appServerName);
        await this.loadTestData();
    }

    async afterEverything(): Promise<void> {
        _disconnectServer(this.appServerName);
        await this.deleteTestData();
    }

    setupEachTest(): void {
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
        this.debugClient = new DebugClient('node', this.exec, 'node');
        return this.debugClient.start();
    }

    teardownEachTest(): void {
        this.debugClient.stop();
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

    async getRid(client: MarklogicClient, qry: string): Promise<string[]> {
        const newParams: MlClientParameters = JSON.parse(JSON.stringify(client.params));
        newParams.port = this.managePort;
        const newClient = new MarklogicClient(newParams);
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

    async getRequestStatuses(client: MarklogicClient, qry: string): Promise<{ requestId: string }[][]> {
        const newParams: MlClientParameters = JSON.parse(JSON.stringify(client.params));
        newParams.port = this.managePort;
        const newClient = new MarklogicClient(newParams);
        return sendJSQuery(newClient, qry)
            .result(
                (fulfill) => {
                    return fulfill.map(o => {
                        return o.value;
                    });
                },
                (err) => {
                    throw err;
                });
    }

    async cancelRequest(client: MarklogicClient, qry: string): Promise<unknown> {
        const newParams: MlClientParameters = JSON.parse(JSON.stringify(client.params));
        newParams.port = this.managePort;
        const newClient = new MarklogicClient(newParams);
        return sendJSQuery(newClient, qry)
            .result(
                () => {
                    return null;
                },
                (err) => {
                    throw err;
                });
    }

    async cancelAllRequests(): Promise<void> {
        const existingRequestStatuses: { requestId: string }[][] = await this.getRequestStatuses(this.mlClient, 'xdmp.serverStatus(xdmp.host(),xdmp.server(this.appServerName)).toObject()[0].requestStatuses.toObject()');
        await existingRequestStatuses[0].forEach(async (requestStatus) => {
            const requestId = requestStatus.requestId;
            const cancelRequestCommand = `declareUpdate(); xdmp.requestCancel(xdmp.host(),xdmp.server(this.appServerName), \`${requestId}\`)`;
            await this.cancelRequest(this.mlClient, cancelRequestCommand);
        });
    }

    async runningRequestsExist(): Promise<boolean> {
        const existingRequestStatuses: { requestId: string }[][] = await this.getRequestStatuses(this.mlClient, 'xdmp.serverStatus(xdmp.host(),xdmp.server(this.appServerName)).toObject()[0].requestStatuses.toObject()');
        return (existingRequestStatuses[0].length > 0);
    }

}

export function wait(ms: number): Promise<unknown> {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}