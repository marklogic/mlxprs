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

import * as vscode from 'vscode';
import * as fs from 'fs';
import { JsDebugManager } from './jsDebugManager';

export class JsDebugConfigurationProvider implements vscode.DebugConfigurationProvider {

    resolveDebugConfiguration(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        folder: vscode.WorkspaceFolder | undefined, config: vscode.DebugConfiguration, _token?: vscode.CancellationToken
    ): vscode.ProviderResult<vscode.DebugConfiguration> {

        // if launch.json is missing or empty
        if (!config.type && !config.request && !config.name) {
            const editor = vscode.window.activeTextEditor;
            if (editor && editor.document.languageId === 'javascript') {
                config.type = 'ml-jsdebugger';
                config.name = 'Launch Debug Request';
                config.request = 'launch';
                config.program = '${file}';
            }
        }

        // Need to tell VSCode what parameters to use for "launching" a debug session based on a configuration in launch.json
        // Note that this information is unnecessary for "attaching" to a remote request for debugging.
        if (config.request === 'launch') {
            config.program = config.program || config.path;
            if (!config.program) {
                // If a program isn't specified by the launch configuration
                // Then need to set the parameters to values based on the current editor window
                const doc: vscode.TextDocument = vscode.window.activeTextEditor.document;
                config.program = doc.fileName;
                config.scheme = doc.uri.scheme;
                config.queryText = doc.getText();
            }
        }

        // deprecation warnings
        if (config.path && config.request === 'launch') {
            vscode.window.showWarningMessage('Use of \'path\' is deprecated in launch configurations. Please use \'program\'');
        }
        if (config.path && config.request === 'attach') {
            vscode.window.showWarningMessage('Use of \'path\' is deprecated in launch configurations. Please use \'root\'');
            config.root = config.root || config.path;
        }

        return this.resolveRemainingDebugConfiguration(folder, config);
    }

    /* helper function to resolve config parameters */
    private async resolveRemainingDebugConfiguration(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        folder: vscode.WorkspaceFolder | undefined, config: vscode.DebugConfiguration, _token?: vscode.CancellationToken
    ): Promise<vscode.DebugConfiguration> {
        // acquire extension settings
        const wcfg: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration();
        config.hostname = String(wcfg.get('marklogic.host'));
        config.username = String(wcfg.get('marklogic.username'));
        config.password = String(wcfg.get('marklogic.password'));
        config.managePort = Number(wcfg.get('marklogic.managePort'));
        config.database = String(wcfg.get('marklogic.documentsDb'));
        config.modules = String(wcfg.get('marklogic.modulesDb'));
        config.mlModulesRoot = String(wcfg.get('marklogic.modulesRoot'));
        config.ssl = Boolean(wcfg.get('marklogic.ssl'));
        config.authType = String(wcfg.get('marklogic.authType'));
        config.rejectUnauthorized = Boolean(wcfg.get('marklogic.rejectUnauthorized'));

        if (config.ssl) config.pathToCa = String(wcfg.get('marklogic.pathToCa') || '');
        let ca: Buffer;
        if (config.pathToCa) {
            ca = fs.readFileSync(config.pathToCa);
        }

        if (!config.hostname) {
            return vscode.window.showErrorMessage('Hostname is not provided').then(() => {
                return undefined;
            });
        }
        if (!config.username) {
            return vscode.window.showErrorMessage('Username is not provided').then(() => {
                return undefined;
            });
        }
        if (!config.password) {
            return vscode.window.showErrorMessage('Password is not provided').then(() => {
                return undefined;
            });
        }
        if (config.request === 'attach' && !config.debugServerName) {
            return vscode.window.showErrorMessage('Debug server name is not provided').then(() => {
                return undefined;
            });
        }
        if (config.request === 'launch' && !config.database.match(/^\d+$/)) {
            await JsDebugManager.resolveDatabasetoId(config.username, config.password, config.database, config.hostname,
                config.ssl, ca, config.rejectUnauthorized, config.managePort)
                .then(resp => {
                    config.database = resp.match('\r\n\r\n(.*[0-9])\r\n')[1]; //better way of parsing?
                }).catch(err => {
                    console.debug(`Error attempting to retrieve database id for database name, '${config.database}': ${err}`);
                    vscode.window.showErrorMessage(`Error getting database id for database name, '${config.database}'`);
                    return null;
                });
        }
        if (config.request === 'launch' && !config.modules.match(/^\d+$/)) {
            await JsDebugManager.resolveDatabasetoId(config.username, config.password, config.modules, config.hostname,
                config.ssl, ca, config.rejectUnauthorized, config.managePort)
                .then(resp => {
                    config.modules = resp.match('\r\n\r\n(.*[0-9])\r\n')[1]; //better way of parsing?
                }).catch(() => {
                    return vscode.window.showErrorMessage('Error getting modules database setting').then(() => {
                        return undefined;
                    });
                });
        }

        //query for paused requests
        if (config.request === 'attach' && config.username && config.password) {
            const resp = await JsDebugManager.getAvailableRequests(config.username, config.password, config.debugServerName,
                config.hostname, config.ssl, ca, config.rejectUnauthorized, config.managePort);
            const requests: string[] = JSON.parse(resp).requestIds;
            const pausedRequests = [];
            for (let i = 0; i < requests.length; i++) {
                try {
                    let resp = await JsDebugManager.getRequestInfo(
                        config.username, config.password, requests[i] as string, config.debugServerName,
                        config.hostname, config.ssl, ca, config.managePort);
                    resp = resp.match('\r\n\r\n(.*)\r\n')[1];
                    const requestText = JSON.parse(resp)['requestText'];
                    const startTime = JSON.parse(resp)['startTime'];

                    pausedRequests.push({
                        label: requests[i],
                        description: 'module: ' + String(requestText),
                        detail: 'startTime: ' + String(startTime)
                    } as vscode.QuickPickItem);
                } catch (e) {
                    pausedRequests.push({
                        label: requests[i]
                    });
                }
            }
            if (pausedRequests.length > 0) {
                const item = await vscode.window.showQuickPick(pausedRequests, { placeHolder: 'Select the request to attach to' });
                if (!item) {
                    return vscode.window.showErrorMessage('Request not selected').then(() => {
                        return undefined;	// abort
                    });
                }
                config.rid = item.label;
            } else {
                vscode.window.showErrorMessage('No paused requests found on server');
                return undefined;
            }
        }

        return config;
    }
}

export class DebugAdapterExecutableFactory implements vscode.DebugAdapterDescriptorFactory {
    createDebugAdapterDescriptor(_session: vscode.DebugSession, executable: vscode.DebugAdapterExecutable | undefined): vscode.ProviderResult<vscode.DebugAdapterDescriptor> {
        return executable;
    }
}
