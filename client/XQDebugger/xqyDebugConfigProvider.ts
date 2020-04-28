import { DebugConfiguration, DebugConfigurationProvider, WorkspaceFolder, CancellationToken, ProviderResult,
    window,
    DebugAdapterDescriptorFactory,
    DebugAdapterExecutable,
    DebugAdapterDescriptor,
    DebugSession,
    WorkspaceConfiguration, workspace, Memento } from 'vscode'
import { MarklogicClient, MlClientParameters, sendXQuery } from '../marklogicClient'
import { cascadeOverrideClient } from '../vscQueryParameterTools'

const XQY = 'xqy'

export class XqyDebugConfiguration implements DebugConfiguration {
    [key: string]: any
    type: string
    name: string
    request: string

    path?: string
    program: string
    stopOnEntry: boolean

    clientParams: MlClientParameters
}

export class XqyDebugConfigurationProvider implements DebugConfigurationProvider {
    private async getAvailableRequests(params: MlClientParameters): Promise<any> {
        const client: MarklogicClient = new MarklogicClient(params)
        const resp = await sendXQuery(client, 'dbg:stopped()')
            .result(
                (fulfill: Record<string, any>[]) => {
                    console.info(JSON.stringify(fulfill))
                },
                (error: Record<string, any>[]) => {
                    console.error(JSON.stringify(error))
                }
            )
        return resp
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
        config.clientParams = clientParams

        // TODO: for attaching to existing requests
        if (config.request === 'attach')
            this.getAvailableRequests(clientParams)
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

