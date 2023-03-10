import * as fs from 'fs'
import * as Path from 'path'
import * as vscode from 'vscode'
import { DebugClient } from '@vscode/debugadapter-testsupport'

import { _connectServer, _disconnectServer } from '../../JSDebugger/configurationProvider'
import { MarklogicClient, MlClientParameters, sendJSQuery } from '../../marklogicClient'

export class IntegrationTestHelper {

    private collection = 'VSCODE/SJS-debug-test'
    private rootFolder = Path.join(__dirname, '../../../')
    readonly scriptFolder = Path.join(this.rootFolder, 'client/test/integration/jsScripts')
    readonly hwPath = Path.join(this.scriptFolder, 'helloWorld.sjs')
    private exec = Path.join(this.rootFolder, 'dist/mlDebug.js')

    private wcfg = vscode.workspace.getConfiguration()
    private hostname = String(this.wcfg.get('marklogic.host') || 'localhost')
    private port = Number(this.wcfg.get('marklogic.port') || '8055')
    private username = String(this.wcfg.get('marklogic.username') || 'admin')
    private password = String(this.wcfg.get('marklogic.password') || process.env.ML_PASSWORD)
    private modulesDB = String(this.wcfg.get('marklogic.modulesDb') || 'Modules')
    private pathToCa = String(this.wcfg.get('marklogic.pathToCa') || '')
    private ssl = Boolean(this.wcfg.get('marklogic.ssl'))
    private rejectUnauthorized = Boolean(this.wcfg.get('marklogic.rejectUnauthorized'))
    public config = null
    public debugClient = null
    readonly mlClient = new MarklogicClient(
        new MlClientParameters({
            host: this.hostname,
            port: this.port,
            user: this.username,
            pwd: this.password,
            authType: 'DIGEST',
            contentDb: this.modulesDB,
            modulesDb: this.modulesDB,
            pathToCa: this.pathToCa,
            ssl: this.ssl,
            rejectUnauthorized: this.rejectUnauthorized
        })
    )

    private module1 = Path.join(this.rootFolder, 'client/test/integration/jsScripts/MarkLogic/test/test.sjs')
    private module2 = Path.join(this.rootFolder, 'client/test/integration/jsScripts/MarkLogic/test/lib1.sjs')
    private module3 = Path.join(this.rootFolder, 'client/test/integration/jsScripts/MarkLogic/test/lib2.sjs')
    private module4 = Path.join(this.rootFolder, 'client/test/integration/jsScripts/MarkLogic/test/invoke1.xqy')
    private module5 = Path.join(this.rootFolder, 'client/test/integration/jsScripts/helloWorld.sjs')
    private module6 = Path.join(this.rootFolder, 'client/test/integration/jsScripts/MarkLogic/test/jsInvoke-1.sjs')
    private module7 = Path.join(this.rootFolder, 'client/test/integration/jsScripts/MarkLogic/test/xqyInvoke-1.xqy')
    private module8 = Path.join(this.rootFolder, 'client/test/integration/jsScripts/MarkLogic/test/jsInvoke-2.sjs')

    private debugServerModules = [this.module1, this.module2, this.module3, this.module4, this.module5, this.module6]
    private taskServerModules = [this.module6, this.module7, this.module8]

    async beforeEverything(): Promise<void> {
        _connectServer('JSdebugTestServer')
        this.loadTestData()
    }

    async afterEverything(): Promise<void> {
        _disconnectServer('JSdebugTestServer')
        this.deleteTestData()
    }

    setupEachTest(): void {
        this.config = {
            program: this.hwPath,
            queryText: fs.readFileSync(this.hwPath).toString(),
            username: this.username, password: this.password,
            hostname: this.hostname, authType: 'DIGEST',
            ssl: this.ssl, pathToCa: this.pathToCa, rejectUnauthorized: this.rejectUnauthorized
        }
        this.debugClient = new DebugClient('node', this.exec, 'node')
        return this.debugClient.start()
    }

    teardownEachTest(): void {
        this.debugClient.stop()
    }

    private async loadTestData(): Promise<void> {
        const requests = []
        this.debugServerModules.forEach(async (fsModulePath) => {
            const fname = Path.basename(fsModulePath)
            const module = fs.readFileSync(fsModulePath)
            const qry = `declareUpdate(); let textNode = new NodeBuilder();
                    textNode.addText(\`${module}\`);
                    const options = {collections: '${this.collection}'};
                    xdmp.documentInsert("/MarkLogic/test/${fname}", textNode.toNode(), options);`
            requests.push(sendJSQuery(this.mlClient, qry))
        })
        this.taskServerModules.forEach(async (fsModulePath) => {
            const fname = Path.basename(fsModulePath)
            const module = fs.readFileSync(fsModulePath)
            const qry = `declareUpdate(); let textNode = new NodeBuilder();
                    textNode.addText(\`${module}\`);
                    const options = {collections: '${this.collection}'};
                    xdmp.documentInsert("Apps/MarkLogic/test/${fname}", textNode.toNode(), options);`
            requests.push(sendJSQuery(this.mlClient, qry))
        })
        try {
            try {
                const resp = await Promise.all(requests)
                console.debug(`response: ${JSON.stringify(resp)}`)
            } catch (err) {
                console.error(`Error uploading modules: ${JSON.stringify(err)}`)
            }
        } finally {
            vscode.window.showInformationMessage('SJS Debugger Tests starting...')
        }
    }

    private async deleteTestData(): Promise<void> {
        sendJSQuery(this.mlClient, `declareUpdate(); xdmp.collectionDelete('${this.collection}')`)
            .result(
                () => {
                    console.debug(`Removed ${this.collection} modules after SJS debugger tests.`)
                    return
                },
                (err) => {
                    console.error(`Error removing modules after tests: ${JSON.stringify(err)}`)
                })
            .then(() => {
                vscode.window.showInformationMessage('SJS Debugger tests done!')
            })
    }

    async getRid(client: MarklogicClient, qry: string): Promise<string[]> {
        const newParams: MlClientParameters = JSON.parse(JSON.stringify(client.params))
        newParams.port = 8002
        const newClient = new MarklogicClient(newParams)
        return sendJSQuery(newClient, qry)
            .result(
                (fulfill: Record<string, never>[]) => {
                    return fulfill.map(o => {
                        return o.value
                    })
                },
                (err) => {
                    throw err
                })
    }

    async getRequestStatuses(client: MarklogicClient, qry: string): Promise<{ requestId: string }[][]> {
        const newParams: MlClientParameters = JSON.parse(JSON.stringify(client.params))
        newParams.port = 8002
        const newClient = new MarklogicClient(newParams)
        return sendJSQuery(newClient, qry)
            .result(
                (fulfill) => {
                    return fulfill.map(o => {
                        return o.value
                    })
                },
                (err) => {
                    throw err
                })
    }

    async cancelRequest(client: MarklogicClient, qry: string): Promise<unknown> {
        const newParams: MlClientParameters = JSON.parse(JSON.stringify(client.params))
        newParams.port = 8002
        const newClient = new MarklogicClient(newParams)
        return sendJSQuery(newClient, qry)
            .result(
                () => {
                    return null
                },
                (err) => {
                    throw err
                })
    }

    async cancelAllRequests(): Promise<void> {
        const existingRequestStatuses: { requestId: string }[][] = await this.getRequestStatuses(this.mlClient, 'xdmp.serverStatus(xdmp.host(),xdmp.server("JSdebugTestServer")).toObject()[0].requestStatuses.toObject()')
        await existingRequestStatuses[0].forEach(async (requestStatus) => {
            const requestId = requestStatus.requestId
            const cancelRequestCommand = `declareUpdate(); xdmp.requestCancel(xdmp.host(),xdmp.server("JSdebugTestServer"), \`${requestId}\`)`
            await this.cancelRequest(this.mlClient, cancelRequestCommand)
        })
    }

    async runningRequestsExist(): Promise<boolean> {
        const existingRequestStatuses: { requestId: string }[][] = await this.getRequestStatuses(this.mlClient, 'xdmp.serverStatus(xdmp.host(),xdmp.server("JSdebugTestServer")).toObject()[0].requestStatuses.toObject()')
        return (existingRequestStatuses[0].length > 0)
    }

}

export function wait(ms: number): Promise<unknown> {
    return new Promise((resolve) => {
        setTimeout(resolve, ms)
    })
}