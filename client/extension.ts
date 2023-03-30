'use strict'
import * as path from 'path'
import * as vscode from 'vscode'
import * as ml from 'marklogic'
import { editorJSQuery, editorSparqlQuery, editorSqlQuery, editorXQuery, editorRowsQuery } from './vscQueryDirector'
import { MarklogicClient } from './marklogicClient'
import { cascadeOverrideClient } from './vscQueryParameterTools'
import { QueryResultsContentProvider } from './queryResultsContentProvider'
import { XmlFormattingEditProvider } from './xmlFormatting/Formatting'
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient/node'
import { XqyDebugConfigurationProvider, XqyDebugAdapterDescriptorFactory } from './XQDebugger/xqyDebugConfigProvider'
import { MLConfigurationProvider, DebugAdapterExecutableFactory, _connectServer, _disconnectServer } from './JSDebugger/configurationProvider'
import { ModuleContentProvider, pickAndShowModule } from './vscModuleContentProvider'

const MLDBCLIENT = 'mldbClient'
const SJS = 'sjs'
const XQY = 'xqy'

export function activate(context: vscode.ExtensionContext): void {
    context.globalState.update(MLDBCLIENT, null as ml.DatabaseClient)
    const provider = new QueryResultsContentProvider()
    const mprovider = new ModuleContentProvider()

    vscode.workspace.registerTextDocumentContentProvider(
        QueryResultsContentProvider.scheme, provider)
    vscode.workspace.registerTextDocumentContentProvider(
        ModuleContentProvider.scheme, mprovider)

    const sendXQuery = vscode.commands.registerTextEditorCommand('extension.sendXQuery', editor => {
        const actualQuery: string = editor.document.getText()
        const cfg: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration()
        const client: MarklogicClient = cascadeOverrideClient(actualQuery, XQY, cfg, context.globalState)
        const host = client.params.host; const port = client.params.port
        const qUri = QueryResultsContentProvider.encodeLocation(editor.document.uri, host, port)
        editorXQuery(client, actualQuery, qUri, editor, provider)
    })
    const sendJSQuery = vscode.commands.registerTextEditorCommand('extension.sendJSQuery', editor => {
        const actualQuery: string = editor.document.getText()
        const cfg: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration()
        const client: MarklogicClient = cascadeOverrideClient(actualQuery, SJS, cfg, context.globalState)
        const host = client.params.host; const port = client.params.port
        const uri = QueryResultsContentProvider.encodeLocation(editor.document.uri, host, port)
        editorJSQuery(client, actualQuery, uri, editor, provider)
    })
    const sendSqlQuery = vscode.commands.registerTextEditorCommand('extension.sendSqlQuery', editor => {
        const actualQuery: string = editor.document.getText()
        const cfg: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration()
        const client: MarklogicClient = cascadeOverrideClient('', SJS, cfg, context.globalState)
        const host = client.params.host; const port = client.params.port
        const uri = QueryResultsContentProvider.encodeLocation(editor.document.uri, host, port)
        editorSqlQuery(client, actualQuery, uri, editor, cfg, provider)
    })
    const sendSparqlQuery = vscode.commands.registerTextEditorCommand('extension.sendSparqlQuery', editor => {
        const actualQuery: string = editor.document.getText()
        const cfg: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration()
        const client: MarklogicClient = cascadeOverrideClient('', SJS, cfg, context.globalState)
        const host = client.params.host; const port = client.params.port
        const uri = QueryResultsContentProvider.encodeLocation(editor.document.uri, host, port)
        editorSparqlQuery(client, actualQuery, uri, editor, provider)
    })
    const sendRowsQuery = vscode.commands.registerTextEditorCommand('extension.sendRowsQuery', editor => {
        const actualQuery: string = editor.document.getText()
        const cfg: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration()
        const client: MarklogicClient = cascadeOverrideClient('', SJS, cfg, context.globalState)
        const host = client.params.host; const port = client.params.port
        const uri = QueryResultsContentProvider.encodeLocation(editor.document.uri, host, port)
        editorRowsQuery(client, actualQuery, uri, editor, provider)
    })
    const connectServer = vscode.commands.registerCommand('extension.connectServer', () => {
        vscode.window.showInputBox({
            placeHolder: 'Please enter server you want to connect',
            value: ''
        }).then(servername => {
            _connectServer(servername)
        })
    })
    const disconnectServer = vscode.commands.registerCommand('extension.disconnectServer', () => {
        vscode.window.showInputBox({
            placeHolder: 'Please enter server you want to disconnect',
            value: ''
        }).then(servername => {
            _disconnectServer(servername)
        })
    })
    const connectXqyServer = vscode.commands.registerCommand('extension.connectXqyServer', () => {
        const cfg: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration()
        const client: MarklogicClient = cascadeOverrideClient('', SJS, cfg, context.globalState)
        XqyDebugConfigurationProvider.chooseXqyServer(client, 'connect')
    })
    const disconnectXqyServer = vscode.commands.registerCommand('extension.disconnectXqyServer', () => {
        const cfg: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration()
        const client: MarklogicClient = cascadeOverrideClient('', SJS, cfg, context.globalState)
        XqyDebugConfigurationProvider.chooseXqyServer(client, 'disconnect')
    })
    const showModule = vscode.commands.registerCommand('extension.showModule', () => {
        const cfg: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration()
        const client: MarklogicClient = cascadeOverrideClient('', XQY, cfg, context.globalState)
        pickAndShowModule(mprovider, client)
    })
    context.subscriptions.push(showModule)

    context.subscriptions.push(connectServer)
    context.subscriptions.push(disconnectServer)
    context.subscriptions.push(connectXqyServer)
    context.subscriptions.push(disconnectXqyServer)

    context.subscriptions.push(sendXQuery)
    context.subscriptions.push(sendJSQuery)
    context.subscriptions.push(sendSqlQuery)
    context.subscriptions.push(sendSparqlQuery)
    context.subscriptions.push(sendRowsQuery)
    context.subscriptions.push(
        vscode.languages.registerDocumentFormattingEditProvider(
            { scheme: 'mlquery', language: 'xml' },
            new XmlFormattingEditProvider()
        )
    )
    context.subscriptions.push(
        vscode.languages.registerDocumentFormattingEditProvider(
            { scheme: 'mlquery', language: 'xsl' },
            new XmlFormattingEditProvider()
        )
    )

    // XQuery hinting client below
    const serverModule = context.asAbsolutePath(path.join('server', 'dist', 'server.js'))
    const debugOptions = { execArgv: ['--nolazy', '--inspect=6004'] }
    const serverOptions: ServerOptions = {
        run: { module: serverModule, transport: TransportKind.ipc },
        debug: { module: serverModule, transport: TransportKind.ipc, options: debugOptions }
    }
    const clientOptions: LanguageClientOptions = {
        documentSelector: [
            { language: 'xquery-ml', scheme: 'file' },
            { language: 'xquery-ml', scheme: 'untitled' },
            { language: 'javascript', scheme: 'file' },
            { language: 'javascript', scheme: 'untitled' }
        ],
        synchronize: {
            // Notify the server about file changes to '.clientrc files contain in the workspace
            fileEvents: vscode.workspace.createFileSystemWatcher('**/.clientrc')
        }
    }
    const disposable = new LanguageClient('xQueryLanguageServer', 'XQuery Language Server', serverOptions, clientOptions).start()
    context.subscriptions.push(disposable)

    const sjsDebugFactory: DebugAdapterExecutableFactory = new DebugAdapterExecutableFactory()
    const sjsDbgProvider: MLConfigurationProvider = new MLConfigurationProvider()
    context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('ml-jsdebugger', sjsDbgProvider))
    context.subscriptions.push(vscode.debug.registerDebugAdapterDescriptorFactory('ml-jsdebugger', sjsDebugFactory))
    context.subscriptions.push(sjsDebugFactory as never)

    const xqyDebugFactory: DebugAdapterExecutableFactory = new XqyDebugAdapterDescriptorFactory()
    const xqyDbgProvider: XqyDebugConfigurationProvider = new XqyDebugConfigurationProvider()
    context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('xquery-ml', xqyDbgProvider))
    context.subscriptions.push(vscode.debug.registerDebugAdapterDescriptorFactory('xquery-ml', xqyDebugFactory))
    context.subscriptions.push(xqyDebugFactory as never)
}

// this method is called when your extension is deactivated
export function deactivate(context: vscode.ExtensionContext): void {
    context.globalState.get<ml.DatabaseClient>(MLDBCLIENT).release()
    context.globalState.update(MLDBCLIENT, null)
}
