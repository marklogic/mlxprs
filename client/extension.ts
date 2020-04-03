'use strict'
import * as path from 'path'
import * as vscode from 'vscode'
import * as ml from 'marklogic'
import { _sendJSQuery, editorXQuery } from './queryDirector'
import { MarklogicVSClient, cascadeOverrideClient } from './marklogicClient'
import { QueryResultsContentProvider } from './queryResultsContentProvider'
import { XmlFormattingEditProvider } from './xmlFormatting/Formatting'
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient'
import { XqyDebugConfigurationProvider, XqyInlineDebugAdatperFactory } from '../serverXqyDbg/xqyDebugConfigProvider'
import { MLConfigurationProvider, DebugAdapterExecutableFactory } from './JSDebugger/configurationProvider'

const MLDBCLIENT = 'mldbClient'
const SJS = 'sjs'
const XQY = 'xqy'

export function activate(context: vscode.ExtensionContext): void {
    context.globalState.update(MLDBCLIENT, null as ml.DatabaseClient)
    const provider = new QueryResultsContentProvider()

    vscode.workspace.registerTextDocumentContentProvider(
        QueryResultsContentProvider.scheme, provider)

    const sendXQuery = vscode.commands.registerTextEditorCommand('extension.sendXQuery', editor => {
        const actualQuery: string = editor.document.getText()
        const cfg: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration()
        const client: MarklogicVSClient = cascadeOverrideClient(actualQuery, XQY, cfg, context.globalState)
        const host = client.params.host; const port = client.params.port
        const qUri = QueryResultsContentProvider.encodeLocation(editor.document.uri, host, port)
        editorXQuery(client, actualQuery, qUri, editor, provider)
    })
    const sendJSQuery = vscode.commands.registerTextEditorCommand('extension.sendJSQuery', editor => {
        const actualQuery: string = editor.document.getText()
        const cfg: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration()
        const client: MarklogicVSClient = cascadeOverrideClient(actualQuery, SJS, cfg, context.globalState)
        const host = client.params.host; const port = client.params.port
        const uri = QueryResultsContentProvider.encodeLocation(editor.document.uri, host, port)
        _sendJSQuery(client, actualQuery, uri, editor, provider)
    })



    context.subscriptions.push(sendXQuery)
    context.subscriptions.push(sendJSQuery)
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

    const xqyDebugFactory: XqyInlineDebugAdatperFactory = new XqyInlineDebugAdatperFactory()
    const sjsDebugFactory: DebugAdapterExecutableFactory = new DebugAdapterExecutableFactory()

    xqyDebugFactory.setUpMlClientContext(context.globalState, vscode.workspace.getConfiguration())

    // context.subscriptions.push(vscode.debug.registerDebugAdapterDescriptorFactory('xquery-ml', factory))
    // if ('dispose' in factory) {
    //     context.subscriptions.push(factory)
    // }

    const xqyDbgProvider: XqyDebugConfigurationProvider = new XqyDebugConfigurationProvider()
    context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('xquery-ml', xqyDbgProvider))

    const debugConfigProvider: MLConfigurationProvider = new MLConfigurationProvider()
    context.subscriptions.push(vscode.debug.registerDebugConfigurationProvider('ml-jsdebugger', debugConfigProvider))

    context.subscriptions.push(vscode.debug.registerDebugAdapterDescriptorFactory('ml-jsdebugger', sjsDebugFactory))
    context.subscriptions.push(sjsDebugFactory as any)

    context.subscriptions.push(vscode.debug.registerDebugAdapterDescriptorFactory('ml-xqdebugger', xqyDebugFactory))
}

// this method is called when your extension is deactivated
export function deactivate(context: vscode.ExtensionContext): void {
    context.globalState.get<ml.DatabaseClient>(MLDBCLIENT).release()
    context.globalState.update(MLDBCLIENT, null)
}
