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

import { DebugSessionCustomEvent, QuickPickItem, window } from 'vscode';

import { MlxprsErrorReporter } from '../mlxprsErrorReporter';
import { ClientContext, MlClientParameters, sendXQuery, ServerQueryResponse } from '../marklogicClient';
import { MlxprsError } from '../mlxprsErrorBuilder';
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
        if (choices) {
            const sortedChoices: QuickPickItem[] = choices.sort(appServerSorter);
            if (sortedChoices.length) {
                return window.showQuickPick(sortedChoices)
                    .then((choice: QuickPickItem) => {
                        return sendXQuery(dbClientContext, `dbg:connect(${choice.description})`)
                            .result(
                                () => {
                                    window.showInformationMessage(`Successfully connected ${choice.label} on ${dbClientContext.params.host}`);
                                    this.requestStatusBarItemUpdate();
                                },
                                (error) => {
                                    const mlxprsError: MlxprsError = {
                                        reportedMessage: error.message,
                                        stack: error.stack,
                                        popupMessage: `Failed to connect to ${choice.label}: ${JSON.stringify(error.body.errorResponse.message)}`
                                    };
                                    MlxprsErrorReporter.reportError(mlxprsError);
                                    this.requestStatusBarItemUpdate();
                                });
                    });
            } else {
                return null;
            }
        } else {
            return null;
        }
    }

    public static async disconnectFromXqyDebugServer(dbClientContext: ClientContext): Promise<void> {
        const choices: QuickPickItem[] = await this.getAppServerListForXqy(dbClientContext, dbClientContext.listServersForDisconnectQuery);
        if (choices) {
            const sortedChoices: QuickPickItem[] = choices.sort(appServerSorter);
            if (sortedChoices.length) {
                return window.showQuickPick(sortedChoices)
                    .then((choice: QuickPickItem) => {
                        return sendXQuery(dbClientContext, `dbg:disconnect(${choice.description})`)
                            .result(
                                () => {
                                    window.showInformationMessage(`Successfully disconnected ${choice.label} on ${dbClientContext.params.host}`);
                                    this.requestStatusBarItemUpdate();
                                },
                                (error) => {
                                    const mlxprsError: MlxprsError = {
                                        reportedMessage: error.message,
                                        stack: error.stack,
                                        popupMessage: `Failed to disconnect from ${choice.label}: ${JSON.stringify(error.body.errorResponse.message)}`
                                    };
                                    MlxprsErrorReporter.reportError(mlxprsError);
                                    this.requestStatusBarItemUpdate();
                                });
                    });
            } else {
                window.showWarningMessage(`No stopped servers found on ${dbClientContext.params.host}`);
                this.requestStatusBarItemUpdate();
                return null;
            }
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
                error => {
                    const mlxprsError: MlxprsError = {
                        reportedMessage: error.message,
                        stack: error.stack,
                        popupMessage: `Could not get list of app servers; ${error}`
                    };
                    MlxprsErrorReporter.reportError(mlxprsError);
                    return null;
                });
    }
}

function appServerSorter(a: QuickPickItem, b: QuickPickItem): number {
    return (a.label.toUpperCase() > b.label.toUpperCase()) ? 1 : ((b.label.toUpperCase() > a.label.toUpperCase()) ? -1 : 0);
}

export function handleDebugSessionCustomEvent(event: DebugSessionCustomEvent) {
    console.debug(`Received Debug Session Custom Event: ${JSON.stringify(event)}`);
    if (event.event === 'MlxprsDebugAdapterError') {
        MlxprsErrorReporter.reportError(event.body['mlxprsError'] as MlxprsError);
    }
}
