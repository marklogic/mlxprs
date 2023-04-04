import { QuickPickItem, window } from 'vscode';
import { ClientContext, MlClientParameters, sendXQuery, ServerQueryResponse } from '../marklogicClient';
import { MlxprsStatus } from '../mlxprsStatus';

export interface DebugStatusQueryResponse {
    rid: string;
    serverName: string;
    debugStatus: string;
    requestStatus: string;
}

export class XqyDebugManager {
    static mlxprsStatus: MlxprsStatus = null;

    private static listStoppedRequests = `
    for $rid in dbg:stopped()
    let $status := dbg:status($rid)/*:request
    let $server := xdmp:server-name($status/*:server-id)
    let $rstatus := $status/*:request-status/fn:string()
    let $dstatus := $status/*:debugging-status/fn:string()
    return (json:object()
      => map:with('rid', $rid)
      => map:with('serverName', $server)
      => map:with('debugStatus', $dstatus)
      => map:with('requestStatus', $rstatus)
      )`;

    public static async getAvailableRequests(params: MlClientParameters): Promise<Array<DebugStatusQueryResponse>> {
        const dbClientContext: ClientContext = new ClientContext(params);
        const resp = await sendXQuery(dbClientContext, this.listStoppedRequests)
            .result(
                (fulfill: Record<string, any>[]) => {
                    return fulfill.map(f => f.value as DebugStatusQueryResponse);
                },
                (error: Record<string, any>[]) => {
                    console.error(JSON.stringify(error));
                    return [];
                });
        return resp;
    }

    public static async connectToXqyDebugServer(dbClientContext: ClientContext): Promise<void> {
        const listServersForConnectQuery = dbClientContext.buildListServersForConnectQuery();
        const choices: QuickPickItem[] = await this.getAppServerListForXqy(dbClientContext, listServersForConnectQuery);
        if (choices.length) {
            return window.showQuickPick(choices)
                .then((choice: QuickPickItem) => {
                    return sendXQuery(dbClientContext, `dbg:connect(${choice.description})`)
                        .result(
                            () => {
                                window.showInformationMessage(`Successfully connected ${choice.label} on ${dbClientContext.params.host}`);
                                this.requestStatusBarItemUpdate();
                            },
                            (err) => {
                                window.showErrorMessage(`Failed to connect to ${choice.label}: ${JSON.stringify(err.body.errorResponse.message)}`);
                                this.requestStatusBarItemUpdate();
                            });
                });
        } else {
            return null;
        }
    }

    public static async disconnectFromXqyDebugServer(dbClientContext: ClientContext): Promise<void> {
        const choices: QuickPickItem[] = await this.getAppServerListForXqy(dbClientContext, dbClientContext.listServersForDisconnectQuery);
        if (choices.length) {
            return window.showQuickPick(choices)
                .then((choice: QuickPickItem) => {
                    return sendXQuery(dbClientContext, `dbg:disconnect(${choice.description})`)
                        .result(
                            () => {
                                window.showInformationMessage(`Successfully disconnected ${choice.label} on ${dbClientContext.params.host}`);
                                this.requestStatusBarItemUpdate();
                            },
                            (err) => {
                                window.showErrorMessage(`Failed to connect to ${choice.label}: ${JSON.stringify(err.body.errorResponse.message)}`);
                                this.requestStatusBarItemUpdate();
                            });
                });
        } else {
            window.showWarningMessage(`No stopped servers found on ${dbClientContext.params.host}`);
            this.requestStatusBarItemUpdate();
            return null;
        }
    }

    private static requestStatusBarItemUpdate() {
        if (this.mlxprsStatus) {
            this.mlxprsStatus.requestUpdate();
        }
    }

    public static registerMlxprsStatusBarItem(mlxprsStatus: MlxprsStatus) {
        this.mlxprsStatus = mlxprsStatus;
    }

    public static async getAppServerListForXqy(dbClientContext: ClientContext, serverListQuery: string): Promise<QuickPickItem[]> {
        return sendXQuery(dbClientContext, serverListQuery)
            .result(
                (appServers: Record<string, ServerQueryResponse>) => {
                    return dbClientContext.buildAppServerChoicesFromServerList(appServers);
                },
                err => {
                    window.showErrorMessage(`couldn't get a list of servers: ${JSON.stringify(err)}`);
                    return [];
                });
    }
}