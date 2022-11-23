import * as mlLogs from 'marklogicLogs'
import * as vscode from 'vscode'
import { MarklogicClient, sendJSQuery } from '../marklogicClient'
import { cascadeOverrideClient } from '../vscQueryParameterTools'
import { unwrap } from '../queryResultsContentProvider'
import endent from 'endent'

export default class {
    private _context: vscode.ExtensionContext

    constructor(context: vscode.ExtensionContext) {
        this._context = context
    }

    private async runQuery(connectionSettings: mlLogs.ConnectionSettings, query: string): Promise<string> {

        const cfg: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration()
        const overrides: Record<string, any> = {}
        if (connectionSettings.overrideHost) {
            overrides.host = connectionSettings.overrideHost
        }
        if (connectionSettings.overridePort) {
            overrides.port = connectionSettings.overridePort
        }

        const client: MarklogicClient = cascadeOverrideClient(query, 'sjs', cfg, this._context.globalState, overrides)

        console.debug(query)

        return sendJSQuery(client, query)
            .result(
                (fulfill: Array<Record<string, any>>) => {
                    return fulfill.map(o => unwrap(o)).join(('\n'))
                },
                (error: Array<Record<string, any>>) => {
                    throw error
                }
            )
    }

    public async getHosts(connectionSettings: mlLogs.ConnectionSettings): Promise<string> {
        const query = endent`
            const hosts = xdmp.hosts();
            const hostArray = hosts[Symbol.iterator] ? [...hosts] : [hosts];
            hostArray.map(host => xdmp.hostName(host));
            `

        return await this.runQuery(connectionSettings, query)
    }

    public async getLogs(connectionSettings: mlLogs.ConnectionSettings, host: string, start = 1): Promise<string> {
        const settingsCopy = { ...connectionSettings }

        if (!connectionSettings.hostIsLoadbalancer) {
            settingsCopy.overrideHost = host

            const query = endent`
                const regex = /^(?:(?<port>\\d+)_)?(?<type>\\w+Log)_?(?<order>\\d+)?\\.txt$/
                const directory = xdmp.dataDirectory(xdmp.host()) + '/Logs/';
                const files = xdmp.filesystemDirectory(directory).filter(file => regex.test(file.filename)).map(file => {
                    const filenameParse = file.filename.match(regex);
                    file.port = parseInt(filenameParse.groups['port'] || '0');
                    file.type = filenameParse.groups['type'];
                    file.order = parseInt(filenameParse.groups['order'] || '0');
                    return file;
                });

                const logData = [];

                const filesToProcess = files.filter(file => file.port === ${connectionSettings.logPort} && file.type === '${connectionSettings.logType}' && file.order === 0);
                for (let file of filesToProcess) {
                    const start = ${start};
                    const length = file.contentLength - ${start - 1};
                    const fileData = xdmp.binaryDecode(xdmp.externalBinary(file.pathname, start, length), 'UTF-8')
                    logData.push({order: file.order, size: file.contentLength, data: fileData});
                }

                logData
                `

            return await this.runQuery(connectionSettings, query)

        } else {
            throw new Error('Not Implemented')
        }
    }
}
