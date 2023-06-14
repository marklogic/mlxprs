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
import * as querystring from 'querystring';
import * as request from 'request-promise';
import { QuickPickItem, window, workspace } from 'vscode';

import { ClientContext, sendXQuery, ServerQueryResponse } from '../marklogicClient';
import { MlxprsErrorReporter } from '../mlxprsErrorReporter';
import { MlxprsError } from '../mlxprsErrorBuilder';
import { MlxprsStatus } from '../mlxprsStatus';


export class JsDebugManager {
    static mlxprsStatus: MlxprsStatus = null;

    public static async getAvailableRequests(
        username: string, password: string, debugServerName: string, hostname: string, ssl?: boolean,
        ca?: Buffer, rejectUnauthorized = true, managePort = ClientContext.DEFAULT_MANAGE_PORT
    ): Promise<string> {

        const url = ClientContext.buildUrl(hostname, `/jsdbg/v1/paused-requests/${debugServerName}`, ssl, managePort);
        const options = {
            headers: {
                'X-Error-Accept': ' application/json'
            },
            auth: {
                user: username,
                pass: password,
                'sendImmediately': false
            }
        };
        if (ca) options['agentOptions'] = { ca: ca };
        options['rejectUnauthorized'] = rejectUnauthorized;
        return request.get(url, options);
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
        const cfg = workspace.getConfiguration('marklogic');
        const username: string = cfg.get('username');
        const password: string = cfg.get('password');
        const hostname: string = cfg.get('host');
        const managePort: number = cfg.get('managePort');
        const ssl = Boolean(cfg.get('ssl'));
        const pathToCa = String(cfg.get('pathToCa') || '');
        const rejectUnauthorized = Boolean(cfg.get('rejectUnauthorized'));
        const requests = [];
        const filteredChoices: QuickPickItem[] = [];
        let mlxprsError: MlxprsError = null;
        choices.forEach(async (choice) => {
            const url = ClientContext.buildUrl(hostname, `/jsdbg/v1/connected/${choice.label}`, ssl, managePort);
            const options = {
                headers: {
                    'Content-type': 'application/x-www-form-urlencoded',
                    'X-Error-Accept': 'application/json'
                },
                auth: {
                    user: username,
                    pass: password,
                    'sendImmediately': false
                }
            };
            if (pathToCa !== '') {
                options['agentOptions'] = { ca: fs.readFileSync(pathToCa) };
            }
            options['rejectUnauthorized'] = rejectUnauthorized;
            const connectedRequest = request.get(url, options)
                .then((response) => {
                    if (response === requiredResponse) {
                        filteredChoices.push(choice);
                    }
                }).catch((error: Error) => {
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
        const cfg = workspace.getConfiguration('marklogic');
        const username: string = cfg.get('username');
        const password: string = cfg.get('password');
        const hostname: string = cfg.get('host');
        const managePort: number = cfg.get('managePort');
        const ssl = Boolean(cfg.get('ssl'));
        const pathToCa = String(cfg.get('pathToCa') || '');
        const rejectUnauthorized = Boolean(cfg.get('rejectUnauthorized'));

        if (!hostname) {
            window.showInformationMessage('Hostname is not provided');
            return;
        }
        if (!username) {
            window.showInformationMessage('Username is not provided');
            return;
        }
        if (!password) {
            window.showInformationMessage('Password is not provided');
            return;
        }
        const url = ClientContext.buildUrl(hostname, `/jsdbg/v1/connect/${servername}`, ssl, managePort);
        const options = {
            headers: {
                'Content-type': 'application/x-www-form-urlencoded',
                'X-Error-Accept': 'application/json'
            },
            auth: {
                user: username,
                pass: password,
                'sendImmediately': false
            }
        };
        if (pathToCa !== '') {
            options['agentOptions'] = { ca: fs.readFileSync(pathToCa) };
        }
        options['rejectUnauthorized'] = rejectUnauthorized;

        return request.post(url, options)
            .then(() => {
                window.showInformationMessage('Debug server connected');
            }).catch((error: Error) => {
                const mlxprsError: MlxprsError = {
                    reportedMessage: error.message,
                    stack: error.stack,
                    popupMessage: `Debug server connect failed: ${JSON.stringify(error)}`
                };
                MlxprsErrorReporter.reportError(mlxprsError);
            });
    }

    public static async disconnectFromNamedJsDebugServer(servername: string): Promise<void> {
        const cfg = workspace.getConfiguration('marklogic');
        const username: string = cfg.get('username');
        const password: string = cfg.get('password');
        const hostname: string = cfg.get('host');
        const managePort: number = cfg.get('managePort');
        const ssl = Boolean(cfg.get('ssl'));
        const pathToCa = String(cfg.get('pathToCa') || '');
        const rejectUnauthorized = Boolean(cfg.get('rejectUnauthorized'));

        if (!hostname) {
            window.showInformationMessage('Hostname is not provided');
            return;
        }
        if (!username) {
            window.showInformationMessage('Username is not provided');
            return;
        }
        if (!password) {
            window.showInformationMessage('Password is not provided');
            return;
        }
        const url = ClientContext.buildUrl(hostname, `/jsdbg/v1/disconnect/${servername}`, ssl, managePort);
        const options = {
            headers: {
                'Content-type': 'application/x-www-form-urlencoded',
                'X-Error-Accept': 'application/json'
            },
            auth: {
                user: username,
                pass: password,
                'sendImmediately': false
            }
        };
        if (pathToCa !== '') {
            options['agentOptions'] = { ca: fs.readFileSync(pathToCa) };
        }
        options['rejectUnauthorized'] = rejectUnauthorized;

        request.post(url, options).then(() => {
            window.showInformationMessage('Debug server disconnected');
        }).catch((error: Error) => {
            const mlxprsError: MlxprsError = {
                reportedMessage: error.message,
                stack: error.stack,
                popupMessage: `Debug server disconnect failed: ${JSON.stringify(error)}`
            };
            MlxprsErrorReporter.reportError(mlxprsError);
        });
    }

    public static async resolveDatabasetoId(username: string, password: string, database: string, hostname: string,
        ssl?: boolean, ca?: Buffer, rejectUnauthorized = true, managePort = ClientContext.DEFAULT_MANAGE_PORT
    ): Promise<string> {

        const url = ClientContext.buildUrl(hostname, '/v1/eval', ssl, managePort);
        const script = `xdmp.database("${database}")`;
        const options: Record<string, unknown> = {
            headers: {
                'Content-type': 'application/x-www-form-urlencoded',
                'Accept': 'multipart/mixed',
                'X-Error-Accept': ' application/json'
            },
            auth: {
                user: username,
                pass: password,
                'sendImmediately': false
            },
            body: `javascript=${querystring.escape(script)}`
        };
        if (ca) options['agentOptions'] = { ca: ca };
        options['rejectUnauthorized'] = rejectUnauthorized;
        return request.post(url, options);
    }

    public static async getRequestInfo(username: string, password: string, requestId: string, debugServerName: string, hostname: string,
        ssl?: boolean, ca?: Buffer, rejectUnauthorized = true, managePort = ClientContext.DEFAULT_MANAGE_PORT
    ): Promise<string> {

        const url = ClientContext.buildUrl(hostname, '/v1/eval', ssl, managePort);
        const script = `xdmp.requestStatus(xdmp.host(),xdmp.server("${debugServerName}"),"${requestId}")`;
        const options: Record<string, unknown> = {
            headers: {
                'Content-type': 'application/x-www-form-urlencoded',
                'Accept': 'multipart/mixed',
                'X-Error-Accept': ' application/json'
            },
            auth: {
                user: username,
                pass: password,
                'sendImmediately': false
            },
            body: `javascript=${querystring.escape(script)}`
        };
        if (ca) options['agentOptions'] = { ca: ca };
        options['rejectUnauthorized'] = rejectUnauthorized;
        return request.post(url, options);
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
