import { DebugConfiguration, DebugConfigurationProvider, WorkspaceFolder, CancellationToken, ProviderResult,
    window,
    DebugAdapterDescriptorFactory,
    DebugAdapterExecutable,
    DebugAdapterDescriptor,
    DebugSession,
    WorkspaceConfiguration, workspace, Memento } from 'vscode'
import { MarklogicClient, MlClientParameters } from '../client/marklogicClient'
import { cascadeOverrideClient } from '../client/vscQueryParameterTools'

const XQY = 'xqy'

export class XqyDebugConfiguration implements DebugConfiguration {
    [key: string]: any
    type: string
    name: string
    request: string

    program: string
    stopOnEntry: boolean

    client: MarklogicClient
}

export class XqyDebugConfigurationProvider implements DebugConfigurationProvider {
    // TODO: use ML Node.js eval here
    private async getAvailableRequests(db: MarklogicClient): Promise<any> {
        return null
    }

    private async resolveRemainingDebugConfiguration(folder: WorkspaceFolder | undefined, config: XqyDebugConfiguration, token?: CancellationToken): Promise<DebugConfiguration> {
        const cfg: WorkspaceConfiguration = workspace.getConfiguration()
        const clientParams: MlClientParameters = new MlClientParameters({
            host: String(cfg.get('marklogic.host')),
            port: Number(cfg.get('marklogic.port')),
            user: String(cfg.get('marklogic.username')),
            pwd: String(cfg.get('marklogic.password')),
            contentDb: String(cfg.get('marklogic.documentsDb')),
            modulesDb: String(cfg.get('marklogic.modulesDb')),
            authType: String(cfg.get('marklogic.authType')),
            ssl: Boolean(cfg.get('marklogic.ssl')),
            pathToCa: String(cfg.get('marklogic.pathToCa'))
        })
        const client: MarklogicClient = new MarklogicClient(clientParams)
        config.client = client

        if (config.username && config.password) {
            this.getAvailableRequests(client)
            console.info('we should get the open requests here')
        }
        return config
    }

    /**
     * @override
     */
    resolveDebugConfiguration(folder: WorkspaceFolder | undefined, config: XqyDebugConfiguration, token?: CancellationToken): ProviderResult<DebugConfiguration> {
        if (!config.type && !config.request && !config.name) {
            const editor = window.activeTextEditor
            if (editor && editor.document.languageId === 'xquery-ml') {
                config.type = 'xquery-ml'
                config.name = 'Launch XQY Debug Request'
                config.request = 'launch'
                config.program = '${file}'
                config.stopOnEntry = true
            }
        }
        if (config.request === 'launch') {
            config.path = '${file}'
        }

        if (!config.program) {
            config.program = window.activeTextEditor.document.getText()
        }

        return this.resolveRemainingDebugConfiguration(folder, config)
    }
}

export class XqyDebugAdapterDescriptorFactory implements DebugAdapterDescriptorFactory {
    createDebugAdapterDescriptor(session: DebugSession, executable: DebugAdapterExecutable): ProviderResult<DebugAdapterDescriptor> {
        return executable
    }
}

