'use strict';
import * as path from 'path';
import * as vscode from 'vscode';
import * as ml from 'marklogic';
import { editorJSQuery, editorSparqlQuery, editorSqlQuery, editorXQuery, editorRowsQuery } from './vscQueryDirector';
import { MarklogicClient } from './marklogicClient';
import { cascadeOverrideClient } from './vscQueryParameterTools';
import { ClientResponseProvider } from './clientResponseProvider';
import { XmlFormattingEditProvider } from './xmlFormatting/Formatting';
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient/node';
import { XqyDebugConfigurationProvider, XqyDebugAdapterDescriptorFactory } from './XQDebugger/xqyDebugConfigProvider';
import { XqyDebugManager } from './XQDebugger/xqyDebugManager';
import { JsDebugConfigurationProvider, DebugAdapterExecutableFactory } from './JSDebugger/jsDebugConfigProvider';
import { JsDebugManager } from './JSDebugger/jsDebugManager';
import { ModuleContentProvider, pickAndShowModule } from './vscModuleContentProvider';
import { MlxprsStatus } from './mlxprsStatus';

const MLDBCLIENT = 'mldbClient';
const SJS = 'sjs';
const XQY = 'xqy';

export function activate(context: vscode.ExtensionContext): void {
    context.globalState.update(MLDBCLIENT, null as ml.DatabaseClient);
    const provider = new ClientResponseProvider();
    const mprovider = new ModuleContentProvider();

    vscode.workspace.registerTextDocumentContentProvider(
        ClientResponseProvider.scheme, provider);
    vscode.workspace.registerTextDocumentContentProvider(
        ModuleContentProvider.scheme, mprovider);

    const sendXQuery = vscode.commands.registerTextEditorCommand('extension.sendXQuery', editor => {
        const actualQuery: string = editor.document.getText();
        const cfg: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration();
        const client: MarklogicClient = cascadeOverrideClient(actualQuery, XQY, cfg, context.globalState);
        const host = client.params.host; const port = client.params.port;
        const qUri = ClientResponseProvider.encodeLocation(editor.document.uri, host, port);
        editorXQuery(client, actualQuery, qUri, editor, provider);
    });
    const sendJSQuery = vscode.commands.registerTextEditorCommand('extension.sendJSQuery', editor => {
        const actualQuery: string = editor.document.getText();
        const cfg: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration();
        const client: MarklogicClient = cascadeOverrideClient(actualQuery, SJS, cfg, context.globalState);
        const host = client.params.host; const port = client.params.port;
        const uri = ClientResponseProvider.encodeLocation(editor.document.uri, host, port);
        editorJSQuery(client, actualQuery, uri, editor, provider);
    });
    const sendSqlQuery = vscode.commands.registerTextEditorCommand('extension.sendSqlQuery', editor => {
        const actualQuery: string = editor.document.getText();
        const cfg: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration();
        const client: MarklogicClient = cascadeOverrideClient('', SJS, cfg, context.globalState);
        const host = client.params.host; const port = client.params.port;
        const uri = ClientResponseProvider.encodeLocation(editor.document.uri, host, port);
        editorSqlQuery(client, actualQuery, uri, editor, cfg, provider);
    });
    const sendSparqlQuery = vscode.commands.registerTextEditorCommand('extension.sendSparqlQuery', editor => {
        const actualQuery: string = editor.document.getText();
        const cfg: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration();
        const client: MarklogicClient = cascadeOverrideClient('', SJS, cfg, context.globalState);
        const host = client.params.host; const port = client.params.port;
        const uri = ClientResponseProvider.encodeLocation(editor.document.uri, host, port);
        editorSparqlQuery(client, actualQuery, uri, editor, provider);
    });

    function sendEditorRowsQuery(editor, rowsResponseFormat: ml.RowsResponseFormat) {
        const actualQuery: string = editor.document.getText();
        const cfg: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration();
        const client: MarklogicClient = cascadeOverrideClient('', SJS, cfg, context.globalState);
        const host = client.params.host; const port = client.params.port;
        const uri = ClientResponseProvider.encodeLocation(editor.document.uri, host, port);
        editorRowsQuery(client, actualQuery, uri, editor, provider, rowsResponseFormat);
    }
    const sendRowsJsonQuery = vscode.commands.registerTextEditorCommand(
        'extension.sendRowsJsonQuery', editor => sendEditorRowsQuery(editor, 'json'));
    const sendRowsCsvQuery = vscode.commands.registerTextEditorCommand(
        'extension.sendRowsCsvQuery', editor => sendEditorRowsQuery(editor, 'csv'));
    const sendRowsXmlQuery = vscode.commands.registerTextEditorCommand(
        'extension.sendRowsXmlQuery', editor => sendEditorRowsQuery(editor, 'xml'));

    const connectJsServer = vscode.commands.registerCommand('extension.connectJsServer', () => {
        const cfg: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration();
        const client: MarklogicClient = cascadeOverrideClient('', SJS, cfg, context.globalState);
        JsDebugManager.connectToJsDebugServer(client);
    });
    const disconnectJsServer = vscode.commands.registerCommand('extension.disconnectJsServer', () => {
        const cfg: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration();
        const client: MarklogicClient = cascadeOverrideClient('', SJS, cfg, context.globalState);
        JsDebugManager.disconnectFromJsDebugServer(client);
    });
    const connectXqyServer = vscode.commands.registerCommand('extension.connectXqyServer', () => {
        const cfg: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration();
        const client: MarklogicClient = cascadeOverrideClient('', SJS, cfg, context.globalState);
        XqyDebugManager.connectToXqyDebugServer(client);
    });
    const disconnectXqyServer = vscode.commands.registerCommand('extension.disconnectXqyServer', () => {
        const cfg: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration();
        const client: MarklogicClient = cascadeOverrideClient('', SJS, cfg, context.globalState);
        XqyDebugManager.disconnectFromXqyDebugServer(client);
    });
    const showModule = vscode.commands.registerCommand('extension.showModule', () => {
        const cfg: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration();
        const client: MarklogicClient = cascadeOverrideClient('', XQY, cfg, context.globalState);
        pickAndShowModule(mprovider, client);
    });

    handleUnload(context, [
        showModule, connectJsServer, disconnectJsServer, connectXqyServer, disconnectXqyServer, sendXQuery,
        sendJSQuery, sendSqlQuery, sendSparqlQuery, sendRowsJsonQuery, sendRowsCsvQuery, sendRowsXmlQuery
    ]);
    handleUnload(context, [
        vscode.languages.registerDocumentFormattingEditProvider(
            { scheme: 'mlquery', language: 'xml' },
            new XmlFormattingEditProvider()
        )
    ]);
    handleUnload(context, [
        vscode.languages.registerDocumentFormattingEditProvider(
            { scheme: 'mlquery', language: 'xsl' },
            new XmlFormattingEditProvider()
        )
    ]);

    // XQuery hinting client below
    const serverModule = context.asAbsolutePath(path.join('server', 'dist', 'server.js'));
    const debugOptions = { execArgv: ['--nolazy', '--inspect=6004'] };
    const serverOptions: ServerOptions = {
        run: { module: serverModule, transport: TransportKind.ipc },
        debug: { module: serverModule, transport: TransportKind.ipc, options: debugOptions }
    };
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
    };
    const disposable = new LanguageClient('xQueryLanguageServer', 'XQuery Language Server', serverOptions, clientOptions).start();
    handleUnload(context, [disposable]);

    const sjsDebugFactory: DebugAdapterExecutableFactory = new DebugAdapterExecutableFactory();
    const sjsDbgProvider: JsDebugConfigurationProvider = new JsDebugConfigurationProvider();
    handleUnload(context, [
        vscode.debug.registerDebugConfigurationProvider('ml-jsdebugger', sjsDbgProvider),
        vscode.debug.registerDebugAdapterDescriptorFactory('ml-jsdebugger', sjsDebugFactory),
        sjsDebugFactory as never
    ]);

    const xqyDebugFactory: DebugAdapterExecutableFactory = new XqyDebugAdapterDescriptorFactory();
    const xqyDbgProvider: XqyDebugConfigurationProvider = new XqyDebugConfigurationProvider();
    handleUnload(context, [
        vscode.debug.registerDebugConfigurationProvider('xquery-ml', xqyDbgProvider),
        vscode.debug.registerDebugAdapterDescriptorFactory('xquery-ml', xqyDebugFactory),
        xqyDebugFactory as never
    ]);


    const mlxprsStatus: MlxprsStatus = new MlxprsStatus(context);
    handleUnload(context, [mlxprsStatus.getStatusBarItem(), mlxprsStatus.getCommand()]);
    XqyDebugManager.registerMlxprsStatusBarItem(mlxprsStatus);
    JsDebugManager.registerMlxprsStatusBarItem(mlxprsStatus);
    mlxprsStatus.requestUpdate();
}

// this method is called when your extension is deactivated
export function deactivate(context: vscode.ExtensionContext): void {
    context.globalState.get<ml.DatabaseClient>(MLDBCLIENT).release();
    context.globalState.update(MLDBCLIENT, null);
}

/**
* Per https://stackoverflow.com/questions/55554018/purpose-for-subscribing-a-command-in-vscode-extension , objects
* that can be unloaded - such as commands - should be associated with the context so that they can be
* properly deregistered when they are unloaded.
*
* @param context
* @param deregisterableObject
*/
function handleUnload(context: vscode.ExtensionContext, arrayOfUnloadableObject: vscode.Disposable[]) {
    arrayOfUnloadableObject.forEach(unloadableObject => context.subscriptions.push(unloadableObject as vscode.Disposable));
}