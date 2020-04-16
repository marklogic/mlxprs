import { DebugConfiguration, DebugConfigurationProvider, WorkspaceFolder, CancellationToken, ProviderResult,
    window,
    DebugAdapterDescriptorFactory,
    DebugAdapterExecutable,
    DebugAdapterDescriptor, DebugAdapterInlineImplementation,
    DebugSession,
    WorkspaceConfiguration, workspace, Memento } from 'vscode'
import { createServer, Server, AddressInfo } from 'net'
import { XqyDebugSession } from './xqyDebug'
import { MarklogicClient } from '../client/marklogicClient'
import { cascadeOverrideClient } from '../client/vscQueryParameterTools'

const XQY = 'xqy'

export class XqyDebugConfiguration implements DebugConfiguration {
    [key: string]: any
    type: string
    name: string
    request: string

    program: string
    stopOnEntry: boolean
    username: string
    password: string
}

export class XqyDebugConfigurationProvider implements DebugConfigurationProvider {
    // TODO: use ML Node.js eval here
    private async getAvailableRequests(db: MarklogicClient): Promise<any> {
        // getStoppedXQueryRequests(db)
        return null
    }

    private async resolveRemainingDebugConfiguration(folder: WorkspaceFolder | undefined, config: XqyDebugConfiguration, state: Memento, token?: CancellationToken): Promise<DebugConfiguration> {
        const cfg: WorkspaceConfiguration = workspace.getConfiguration()
        const client: MarklogicClient = cascadeOverrideClient('', XQY, cfg, state)

        config.username = client.params.user
        config.password = client.params.pwd

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

        return config
    }
}

export class XqyDebugAdapterDescriptorFactory implements DebugAdapterDescriptorFactory {
    createDebugAdapterDescriptor(session: DebugSession, executable: DebugAdapterExecutable): ProviderResult<DebugAdapterDescriptor> {
        return executable
    }
}

// export class XqyInlineDebugAdatperFactory implements DebugAdapterDescriptorFactory {
//     private state: Memento
//     private cfg: WorkspaceConfiguration

//     public setUpMlClientContext(state: Memento, cfg: WorkspaceConfiguration): void {
//         this.state = state
//         this.cfg = cfg
//     }

//     createDebugAdapterDescriptor(_session: DebugSession): ProviderResult<DebugAdapterDescriptor> {
//         const xqyDebugSession = new XqyDebugSession()
//         // xqyDebugSession.setMlClientContext(this.state, this.cfg)
//         return new DebugAdapterInlineImplementation(xqyDebugSession)
//     }
// }
