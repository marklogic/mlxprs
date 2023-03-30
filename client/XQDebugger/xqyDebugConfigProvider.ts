import {
    DebugConfiguration, DebugConfigurationProvider, WorkspaceFolder, CancellationToken, ProviderResult,
    window, DebugAdapterDescriptorFactory, DebugAdapterExecutable, DebugAdapterDescriptor,
    DebugSession, QuickPickItem, QuickPickOptions, WorkspaceConfiguration, workspace
} from 'vscode';
import { readFileSync } from 'fs';
import { XqyDebugManager, DebugStatusQueryResponse } from './xqyDebugManager';
import { MlClientParameters } from '../marklogicClient';


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

        if (!config.program) {
            config.program = window.activeTextEditor.document.fileName;
            config.query = window.activeTextEditor.document.getText();
        } else {
            config.query = readFileSync(config.program).toString();
        }

        return this.resolveRemainingDebugConfiguration(folder, config);
    }
}

export class XqyDebugAdapterDescriptorFactory implements DebugAdapterDescriptorFactory {
    createDebugAdapterDescriptor(session: DebugSession, executable: DebugAdapterExecutable): ProviderResult<DebugAdapterDescriptor> {
        return executable;
    }
}

