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

import * as ml from 'marklogic';
import { QuickPickItem, window, workspace } from 'vscode';

import { ClientContext, MlClientParameters, sendXQuery, ServerQueryResponse } from '../marklogicClient';
import { MlxprsError } from '../mlxprsErrorBuilder';
import { MlxprsErrorReporter } from '../mlxprsErrorReporter';
import { MlxprsStatus } from '../mlxprsStatus';


export class JsDebugManager {
    static mlxprsStatus: MlxprsStatus = null;

    public static async getAvailableRequests(
        debugServerName: string
    ): Promise<string> {
        const manageClient = newManageClient();
        const endpoint = `/jsdbg/v1/paused-requests/${debugServerName}`;
        return new Promise((resolve, reject) => {
            manageClient.databaseClient.internal.sendRequest(
                endpoint,
                (requestOptions: ml.RequestOptions) => {
                    requestOptions.method = 'GET';
                    requestOptions.headers = {
                        'X-Error-Accept': ' application/json'
                    };
                })
                .result((result: object) => {
                    let response = '';
                    if (result) {
                        response = JSON.stringify(result);
                    }
                    resolve(response);
                })
                .catch(error => {
                    reject(error);
                });
        });
    }


    public static async getFilteredListOfJsAppServers(dbClientContext: ClientContext, requiredResponse: string): Promise<QuickPickItem[]> {
        const listServersForConnectQuery = dbClientContext.buildListServersForConnectQuery();
        const choices: QuickPickItem[] = await this.getAppServerListForJs(dbClientContext, listServersForConnectQuery) as QuickPickItem[];
        if (choices) {
            try {
                const filteredChoices: QuickPickItem[] = await this.filterServers(choices, requiredResponse);
                const sortedFilteredChoices: QuickPickItem[] = filteredChoices.sort(appServerSorter);
                return sortedFilteredChoices;
            } catch (error) {
                MlxprsErrorReporter.reportError(error);
                return null;
            }
        } else {
            return null;
        }
    }

    public static async connectToJsDebugServer(dbClientContext: ClientContext): Promise<void> {
        const filteredServerItems: QuickPickItem[] = await this.getFilteredListOfJsAppServers(dbClientContext, 'false');
        if (filteredServerItems && filteredServerItems.length) {
            return window.showQuickPick(filteredServerItems)
                .then((serverChoice: QuickPickItem) => {
                    return this.connectToNamedJsDebugServer(serverChoice.label)
                        .then(
                            () => {
                                window.showInformationMessage(`Successfully connected ${serverChoice.label} on ${dbClientContext.params.host}`);
                                this.requestStatusBarItemUpdate();
                            },
                            (error) => {
                                const mlxprsError: MlxprsError = {
                                    reportedMessage: error.message,
                                    stack: error.stack,
                                    popupMessage: `Failed to connect to ${serverChoice.label}: ${JSON.stringify(error.body.errorResponse.message)}`
                                };
                                MlxprsErrorReporter.reportError(mlxprsError);
                                this.requestStatusBarItemUpdate();
                            });
                });
        } else {
            return null;
        }
    }

    private static async filterServers(choices: QuickPickItem[], requiredResponse: string): Promise<QuickPickItem[]> {
        const requests = [];
        const filteredChoices: QuickPickItem[] = [];
        let mlxprsError: MlxprsError = null;

        choices.forEach(async (choice) => {
            const manageClient = newManageClient();
            const endpoint = `/jsdbg/v1/connected/${choice.label}`;
            const connectedRequest = manageClient.databaseClient.internal.sendRequest(
                endpoint,
                (requestOptions: ml.RequestOptions) => {
                    requestOptions.method = 'GET';
                    requestOptions.headers = {
                        'Content-type': 'application/x-www-form-urlencoded',
                        'X-Error-Accept': 'application/json'
                    };
                })
                .result((response: unknown) => {
                    if (response === requiredResponse) {
                        filteredChoices.push(choice);
                    }
                })
                .catch(error => {
                    mlxprsError = {
                        reportedMessage: error.message,
                        stack: error.stack,
                        popupMessage: `Unable to connect to the MarkLogic Manage App Server: ${error.message}`
                    };
                });
            requests.push(connectedRequest);
        });
        await Promise.all(requests);
        if (mlxprsError) {
            throw mlxprsError;
        }
        return filteredChoices;
    }

    public static async disconnectFromJsDebugServer(dbClientContext: ClientContext) {
        const filteredServerItems: QuickPickItem[] = await this.getFilteredListOfJsAppServers(dbClientContext, 'true');
        if (filteredServerItems) {
            const sortedFilteredChoices: QuickPickItem[] = filteredServerItems.sort(appServerSorter);
            if (sortedFilteredChoices.length) {
                return window.showQuickPick(sortedFilteredChoices)
                    .then((serverChoice: QuickPickItem) => {
                        return this.disconnectFromNamedJsDebugServer(serverChoice.label)
                            .then(
                                () => {
                                    window.showInformationMessage(`Successfully disconnected ${serverChoice.label} on ${dbClientContext.params.host}`);
                                    this.requestStatusBarItemUpdate();
                                },
                                (error) => {
                                    const mlxprsError: MlxprsError = {
                                        reportedMessage: error.message,
                                        stack: error.stack,
                                        popupMessage: `Failed to disconnect from ${serverChoice.label}: ${JSON.stringify(error.body.errorResponse.message)}`
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

    public static async connectToNamedJsDebugServer(servername: string): Promise<void> {
        const manageClient = newManageClient();
        const endpoint = `/jsdbg/v1/connect/${servername}`;

        return new Promise((resolve, reject) => {
            manageClient.databaseClient.internal.sendRequest(
                endpoint,
                (requestOptions: ml.RequestOptions) => {
                    requestOptions.method = 'POST';
                    requestOptions.headers = {
                        'Content-type': 'application/x-www-form-urlencoded',
                        'X-Error-Accept': 'application/json'
                    };
                })
                .result(() => {
                    window.showInformationMessage('Debug server connected');
                    resolve();
                })
                .catch(error => {
                    const mlxprsError: MlxprsError = {
                        reportedMessage: error.message,
                        stack: error.stack,
                        popupMessage: `Debug server connect failed: ${JSON.stringify(error)}`
                    };
                    MlxprsErrorReporter.reportError(mlxprsError);
                    reject(mlxprsError);
                });
        });
    }

    public static async disconnectFromNamedJsDebugServer(servername: string): Promise<void> {
        const manageClient = newManageClient();
        const endpoint = `/jsdbg/v1/disconnect/${servername}`;

        return new Promise((resolve, reject) => {
            manageClient.databaseClient.internal.sendRequest(
                endpoint,
                (requestOptions: ml.RequestOptions) => {
                    requestOptions.method = 'POST';
                    requestOptions.headers = {
                        'Content-type': 'application/x-www-form-urlencoded',
                        'X-Error-Accept': 'application/json'
                    };
                })
                .result(() => {
                    window.showInformationMessage('Debug server disconnected');
                    resolve();
                })
                .catch(error => {
                    const mlxprsError: MlxprsError = {
                        reportedMessage: error.message,
                        stack: error.stack,
                        popupMessage: `Debug server disconnect failed: ${JSON.stringify(error)}`
                    };
                    MlxprsErrorReporter.reportError(mlxprsError);
                    reject(mlxprsError);
                });
        });
    }

    public static async resolveDatabasetoId(database: string): Promise<string> {
        const manageClient = newManageClient();

        return new Promise((resolve, reject) => {
            manageClient.databaseClient.internal.sendRequest(
                '/v1/eval',
                (requestOptions: ml.RequestOptions) => {
                    requestOptions.method = 'POST';
                    requestOptions.headers = {
                        'Content-type': 'application/x-www-form-urlencoded',
                        'Accept': 'multipart/mixed',
                        'X-Error-Accept': ' application/json'
                    };
                },
                (operation: ml.RequestOperation) => {
                    operation.requestBody = `javascript=xdmp.database("${database}")`;
                })
                .result((result: object) => {
                    const serverArray = JSON.parse(JSON.stringify(result));
                    if (serverArray.length > 0) {
                        resolve(serverArray[0].content);
                    } else {
                        resolve(null);
                    }
                })
                .catch(() => {
                    resolve(null);
                });
        });
    }

    public static async getRequestInfo(requestId: string, debugServerName: string): Promise<string> {
        const manageClient = newManageClient();

        return new Promise((resolve, reject) => {
            manageClient.databaseClient.internal.sendRequest(
                '/v1/eval',
                (requestOptions: ml.RequestOptions) => {
                    requestOptions.method = 'POST';
                    requestOptions.headers = {
                        'Content-type': 'application/x-www-form-urlencoded',
                        'Accept': 'multipart/mixed',
                        'X-Error-Accept': ' application/json'
                    };
                },
                (operation: ml.RequestOperation) => {
                    operation.requestBody = `javascript=xdmp.requestStatus(xdmp.host(),xdmp.server("${debugServerName}"),"${requestId}")`;
                })
                .result((result: object) => {
                    const infoArray = JSON.parse(JSON.stringify(result));
                    if (infoArray.length > 0) {
                        resolve(infoArray[0].content);
                    } else {
                        resolve(null);
                    }
                })
                .catch(() => {
                    resolve(null);
                });
        });
    }

    private static requestStatusBarItemUpdate() {
        if (this.mlxprsStatus) {
            this.mlxprsStatus.requestUpdate();
        }
    }

    public static registerMlxprsStatusBarItem(mlxprsStatus: MlxprsStatus) {
        this.mlxprsStatus = mlxprsStatus;
    }

    public static async getAppServerListForJs(dbClientContext: ClientContext, serverListQuery: string): Promise<QuickPickItem[]> {
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

export function newManageClient() {
    const mlManageClientParameters = newManageConfig();
    return new ClientContext(mlManageClientParameters);
}

function newManageConfig() {
    const cfg = workspace.getConfiguration('marklogic');
    if (!cfg.get('host')) {
        const mlxprsError: MlxprsError = {
            reportedMessage: 'Hostname is not provided',
            popupMessage: 'Hostname is not provided',
            stack: ''
        };
        window.showInformationMessage(mlxprsError.reportedMessage);
        throw mlxprsError;
    }
    if (!cfg.get('username')) {
        const mlxprsError: MlxprsError = {
            reportedMessage: 'Username is not provided',
            popupMessage: 'Username is not provided',
            stack: ''
        };
        window.showInformationMessage(mlxprsError.reportedMessage);
        throw mlxprsError;
    }
    if (!cfg.get('password')) {
        const mlxprsError: MlxprsError = {
            reportedMessage: 'Password is not provided',
            popupMessage: 'Password is not provided',
            stack: ''
        };
        window.showInformationMessage(mlxprsError.reportedMessage);
        throw mlxprsError;
    }
    return new MlClientParameters({
        host: cfg.get('host'),
        port: cfg.get('managePort'),
        restBasePath: cfg.get('manageBasePath'),
        user: cfg.get('username'),
        pwd: cfg.get('password'),
        authType: cfg.get('authType'),
        contentDb: null,
        modulesDb: null,
        pathToCa: String(cfg.get('pathToCa') || ''),
        ssl: Boolean(cfg.get('ssl')),
        rejectUnauthorized: Boolean(cfg.get('rejectUnauthorized'))
    });
}
