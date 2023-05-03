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

import { readFileSync } from 'fs';
import {
    DebugConfiguration, DebugConfigurationProvider, WorkspaceFolder, CancellationToken, ProviderResult,
    window, DebugAdapterDescriptorFactory, DebugAdapterExecutable, DebugAdapterDescriptor,
    DebugSession, QuickPickItem, QuickPickOptions, WorkspaceConfiguration, workspace
} from 'vscode';

import { ErrorReporter, MlxprsError } from '../errorReporter';
import { MlClientParameters } from '../marklogicClient';
import { XqyDebugManager, DebugStatusQueryResponse } from './xqyDebugManager';


export class XqyDebugConfiguration implements DebugConfiguration {
    [key: string]: any
    type: string;
    name: string;
    request: string;
    rid: string;

    path?: string;
    program: string;
    query: string;

    stopOnEntry: boolean;

    clientParams: MlClientParameters;
}

const placeholder: QuickPickOptions = {
    placeHolder: 'Select the request to attach'
};

export class XqyDebugConfigurationProvider implements DebugConfigurationProvider {

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    private async resolveRemainingDebugConfiguration(folder: WorkspaceFolder | undefined, config: XqyDebugConfiguration, token?: CancellationToken): Promise<DebugConfiguration> {
        const cfg: WorkspaceConfiguration = workspace.getConfiguration();
        const clientParams: MlClientParameters = new MlClientParameters({
            host: String(cfg.get('marklogic.host')),
            port: Number(cfg.get('marklogic.port')),
            managePort: Number(cfg.get('marklogic.managePort')),
            user: String(cfg.get('marklogic.username')),
            pwd: String(cfg.get('marklogic.password')),
            contentDb: String(cfg.get('marklogic.documentsDb')),
            modulesDb: String(cfg.get('marklogic.modulesDb')),
            authType: String(cfg.get('marklogic.authType')),
            ssl: Boolean(cfg.get('marklogic.ssl')),
            pathToCa: String(cfg.get('marklogic.pathToCa') || ''),
            rejectUnauthorized: Boolean(cfg.get('marklogic.rejectUnauthorized'))
        });
        config.clientParams = clientParams;

        if (clientParams.pathToCa) {
            try {
                const caFileContents = await readFileSync(clientParams.pathToCa);
                if (!caFileContents || caFileContents.length === 0) {
                    throw new Error('File specified by \'Path to certificate authority\' is empty');
                }
            } catch (error) {
                const mlxprsError: MlxprsError = {
                    reportedMessage: error.message,
                    stack: error.stack,
                    popupMessage: `Path to certificate authority is an unreadable file or the file is empty; path: ${clientParams.pathToCa}`
                };
                ErrorReporter.reportError(mlxprsError);
                return undefined;
            }
        }

        if (config.request === 'attach' && !config.rid) {
            const rid: string = await XqyDebugManager.getAvailableRequests(clientParams)
                .then((requests: Array<DebugStatusQueryResponse>) => {
                    if (requests.length) {
                        const qpRequests: QuickPickItem[] = requests.map((request: DebugStatusQueryResponse) => {
                            return {
                                label: request.rid,
                                description: `Request ${request.requestStatus} on ${request.serverName}`,
                                detail: request.debugStatus
                            } as QuickPickItem;
                        });
                        return window.showQuickPick(qpRequests, placeholder)
                            .then((pickedRequest: QuickPickItem) => {
                                config.rid = pickedRequest.label;
                                return config.rid;
                            });
                    } else {
                        window.showWarningMessage(`No requests found to debug on ${clientParams.host}`);
                        return '';
                    }
                });
            config.rid = rid;
        }
        return config;
    }

    /**
     * @override
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    resolveDebugConfiguration(folder: WorkspaceFolder | undefined, config: XqyDebugConfiguration, token?: CancellationToken): ProviderResult<DebugConfiguration> {
        if (!config.type && !config.request && !config.name) {
            const editor = window.activeTextEditor;
            if (editor && editor.document.languageId === 'xquery-ml') {
                config.type = 'xquery-ml';
                config.name = 'Launch XQY Debug Request';
                config.request = 'launch';
                config.program = '${file}';
                config.stopOnEntry = true;
            }
        }

        // Need to tell VSCode what parameters to use for "launching" a debug session based on a configuration in launch.json
        // Note that this information is unnecessary for "attaching" to a remote request for debugging.
        if (config.request === 'launch') {
            if (!config.program) {
                // If a program isn't specified by the launch configuration
                // Then need to set the parameters to values based on the current editor window
                config.program = window.activeTextEditor.document.fileName;
                config.query = window.activeTextEditor.document.getText();
            } else {
                config.query = readFileSync(config.program).toString();
            }
        }

        return this.resolveRemainingDebugConfiguration(folder, config);
    }
}

export class XqyDebugAdapterDescriptorFactory implements DebugAdapterDescriptorFactory {
    createDebugAdapterDescriptor(session: DebugSession, executable: DebugAdapterExecutable): ProviderResult<DebugAdapterDescriptor> {
        return executable;
    }
}
