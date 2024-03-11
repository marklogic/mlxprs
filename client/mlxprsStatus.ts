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

import { ClientContext } from './marklogicClient';
import { buildClientFactoryFromWorkspaceConfig } from './vscodeClientFactory';

export class MlxprsStatus {
    private dbClientContext: ClientContext;
    private statusBarItem: vscode.StatusBarItem;
    private commandId = 'mlxprs.showConnectedServers';
    private command: vscode.Disposable;
    private connectedServers = null;
    private managePort: number;
    private manageBasePath: string;

    constructor() {
        this.configure();

        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        this.command = vscode.commands.registerCommand(this.commandId, () => {
            this.handleStatusBarCommand();
        });
        this.statusBarItem.command = this.commandId;
    }

    onConfigurationChanged(event: vscode.ConfigurationChangeEvent) {
        if (event.affectsConfiguration('marklogic')) {
            if (this.dbClientContext.databaseClient) {
                this.dbClientContext.databaseClient.release();
            }
            this.configure();
        }
    }

    private configure() {
        const clientFactory = buildClientFactoryFromWorkspaceConfig(vscode.workspace.getConfiguration());
        this.dbClientContext = clientFactory.newMarklogicRestClient();
        this.managePort = clientFactory.managePort;
        this.manageBasePath = clientFactory.manageBasePath;
    }

    getCommand(): vscode.Disposable {
        return this.command;
    }

    getStatusBarItem(): vscode.StatusBarItem {
        return this.statusBarItem;
    }

    requestUpdate(): void {
        this.dbClientContext.getConnectedServers(this, this.managePort, this.manageBasePath, this.updateStatusBarItem);
    }

    updateStatusBarItem(connectedServers: string[]): void {
        if (connectedServers.length > 0) {
            this.connectedServers = connectedServers;
            this.statusBarItem.text = 'Server connected';
        } else {
            this.connectedServers = null;
            this.statusBarItem.text = 'No servers connected';
        }
        this.statusBarItem.show();
    }

    handleStatusBarCommand(): void {
        if (this.connectedServers) {
            vscode.window.showInformationMessage(JSON.stringify(this.connectedServers));
        } else {
            vscode.window.showInformationMessage('Use a "MarkLogic: Connect" command to connect to a debug server');
        }
    }
}