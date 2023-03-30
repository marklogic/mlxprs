import { QuickPickItem, window, workspace } from 'vscode';
import * as request from 'request-promise';
import * as querystring from 'querystring';
import * as fs from 'fs';
import { MarklogicClient, sendXQuery, ServerQueryResponse } from '../marklogicClient';
import { MlxprsStatus } from '../mlxprsStatus';


export class JsDebugManager {
    static mlxprsStatus: MlxprsStatus = null;

    public static async getAvailableRequests(
        username: string, password: string, debugServerName: string, hostname: string, ssl?: boolean,
        ca?: Buffer, rejectUnauthorized = true, managePort = MarklogicClient.DEFAULT_MANAGE_PORT
    ): Promise<string> {

        const url = MarklogicClient.buildUrl(hostname, `/jsdbg/v1/paused-requests/${debugServerName}`, ssl, managePort);
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

    public static async getFilteredListOfJsAppServers(mlClient: MarklogicClient, requiredResponse: string): Promise<QuickPickItem[]> {
        const listServersForConnectQuery = mlClient.buildListServersForConnectQuery();
        const choices: QuickPickItem[] = await this.getAppServerListForJs(mlClient, listServersForConnectQuery) as QuickPickItem[];
        return await this.filterServers(choices, requiredResponse);
    }

    public static async connectToJsDebugServer(mlClient: MarklogicClient): Promise<void> {
        const filteredServerItems: QuickPickItem[] = await this.getFilteredListOfJsAppServers(mlClient, 'false');
        if (filteredServerItems.length) {
            return window.showQuickPick(filteredServerItems)
                .then((serverChoice: QuickPickItem) => {
                    return this.connectToNamedJsDebugServer(serverChoice.label)
                        .then(
                            () => {
                                window.showInformationMessage(`Successfully connected ${serverChoice.label} on ${mlClient.params.host}`);
                                this.requestStatusBarItemUpdate();
                            },
                            (err) => {
                                window.showErrorMessage(`Failed to connect to ${serverChoice.label}: ${JSON.stringify(err.body.errorResponse.message)}`);
                                this.requestStatusBarItemUpdate();
                            });
                });
        } else {
            return null;
        }
    }

    private static async filterServers(choices: QuickPickItem[], requiredResponse: string): Promise<QuickPickItem[]> {
        const cfg = workspace.getConfiguration('marklogic');
        console.log(JSON.stringify(cfg));
        const username: string = cfg.get('username');
        const password: string = cfg.get('password');
        const hostname: string = cfg.get('host');
        const managePort: number = cfg.get('managePort');
        const ssl = Boolean(cfg.get('ssl'));
        const pathToCa = String(cfg.get('pathToCa') || '');
        const rejectUnauthorized = Boolean(cfg.get('rejectUnauthorized'));
        const requests = [];
        const filteredChoices: QuickPickItem[] = [];
        choices.forEach(async (choice) => {
            const url = MarklogicClient.buildUrl(hostname, `/jsdbg/v1/connected/${choice.label}`, ssl, managePort);
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
                }).catch(err => {
                    window.showErrorMessage(`"Connected" request failed: ${err}`);
                });
            requests.push(connectedRequest);
        });
        await Promise.all(requests);
        return filteredChoices;
    }

    public static async disconnectFromJsDebugServer(mlClient: MarklogicClient) {
        const filteredServerItems: QuickPickItem[] = await this.getFilteredListOfJsAppServers(mlClient, 'true');
        if (filteredServerItems.length) {
            return window.showQuickPick(filteredServerItems)
                .then((serverChoice: QuickPickItem) => {
                    return this.disconnectFromNamedJsDebugServer(serverChoice.label)
                        .then(
                            () => {
                                window.showInformationMessage(`Successfully disconnected ${serverChoice.label} on ${mlClient.params.host}`);
                                this.requestStatusBarItemUpdate();
                            },
                            (err) => {
                                window.showErrorMessage(`Failed to connect to ${serverChoice.label}: ${JSON.stringify(err.body.errorResponse.message)}`);
                                this.requestStatusBarItemUpdate();
                            });
                });
        } else {
            window.showWarningMessage(`No stopped servers found on ${mlClient.params.host}`);
            this.requestStatusBarItemUpdate();
            return null;
        }
    }

    public static async connectToNamedJsDebugServer(servername: string): Promise<void> {
        const cfg = workspace.getConfiguration('marklogic');
        console.log(JSON.stringify(cfg));
        const username: string = cfg.get('username');
        const password: string = cfg.get('password');
        const hostname: string = cfg.get('host');
        const managePort: number = cfg.get('managePort');
        const ssl = Boolean(cfg.get('ssl'));
        const pathToCa = String(cfg.get('pathToCa') || '');
        const rejectUnauthorized = Boolean(cfg.get('rejectUnauthorized'));

        if (!hostname) {
            window.showErrorMessage('Hostname is not provided');
            return;
        }
        if (!username) {
            window.showErrorMessage('Username is not provided');
            return;
        }
        if (!password) {
            window.showErrorMessage('Password is not provided');
            return;
        }
        const url = MarklogicClient.buildUrl(hostname, `/jsdbg/v1/connect/${servername}`, ssl, managePort);
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

        request.post(url, options)
            .then(() => {
                window.showInformationMessage('Debug server connected');
            }).catch(err => {
                window.showErrorMessage('Debug server connect failed: ' + JSON.stringify(err));
            });
    }

    public static async disconnectFromNamedJsDebugServer(servername: string, reportDisconnectError = true): Promise<void> {
        const cfg = workspace.getConfiguration('marklogic');
        const username: string = cfg.get('username');
        const password: string = cfg.get('password');
        const hostname: string = cfg.get('host');
        const managePort: number = cfg.get('managePort');
        const ssl = Boolean(cfg.get('ssl'));
        const pathToCa = String(cfg.get('pathToCa') || '');
        const rejectUnauthorized = Boolean(cfg.get('rejectUnauthorized'));

        if (!hostname) {
            window.showErrorMessage('Hostname is not provided');
            return;
        }
        if (!username) {
            window.showErrorMessage('Username is not provided');
            return;
        }
        if (!password) {
            window.showErrorMessage('Password is not provided');
            return;
        }
        const url = MarklogicClient.buildUrl(hostname, `/jsdbg/v1/disconnect/${servername}`, ssl, managePort);
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
        }).catch(() => {
            if (reportDisconnectError) {
                window.showErrorMessage('Debug server disconnect failed');
            }
        });
    }

    public static async resolveDatabasetoId(username: string, password: string, database: string, hostname: string,
        ssl?: boolean, ca?: Buffer, rejectUnauthorized = true, managePort = MarklogicClient.DEFAULT_MANAGE_PORT
    ): Promise<string> {

        const url = MarklogicClient.buildUrl(hostname, '/v1/eval', ssl, managePort);
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
        ssl?: boolean, ca?: Buffer, rejectUnauthorized = true, managePort = MarklogicClient.DEFAULT_MANAGE_PORT
    ): Promise<string> {

        const url = MarklogicClient.buildUrl(hostname, '/v1/eval', ssl, managePort);
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

    public static async getAppServerListForJs(mlClient: MarklogicClient, serverListQuery: string): Promise<QuickPickItem[]> {
        return sendXQuery(mlClient, serverListQuery)
            .result(
                (appServers: Record<string, ServerQueryResponse>) => {
                    return mlClient.buildAppServerChoicesFromServerList(appServers);
                },
                err => {
                    window.showErrorMessage(`couldn't get a list of servers: ${JSON.stringify(err)}`);
                    return [];
                });
    }
}