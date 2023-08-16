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

'use strict';

import * as ml from 'marklogic';
import * as path from 'path';
import * as vscode from 'vscode';
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient/node';

import { ClientResponseProvider } from './clientResponseProvider';
import { ConfigurationManager } from './configurationManager';
import { EditorQueryType, EditorQueryEvaluator } from './editorQueryEvaluator';
import { JsDebugConfigurationProvider, DebugAdapterExecutableFactory } from './JSDebugger/jsDebugConfigProvider';
import { JsDebugManager } from './JSDebugger/jsDebugManager';
import { ClientContext, MlClientParameters, newClientParams } from './marklogicClient';
import { MarkLogicUnitTestClient } from './marklogicUnitTestClient';
import { MarkLogicTdeValidateClient } from './marklogicTdeValidateClient';
import { MlxprsStatus } from './mlxprsStatus';
import { MlxprsWebViewProvider } from './mlxprsWebViewProvider';
import { ModuleContentProvider, pickAndShowModule } from './vscModuleContentProvider';
import { getDbClientWithoutOverrides } from './vscQueryParameterTools';
import { XmlFormattingEditProvider } from './xmlFormatting/Formatting';
import { XqyDebugConfigurationProvider, XqyDebugAdapterDescriptorFactory } from './XQDebugger/xqyDebugConfigProvider';
import { XqyDebugManager, handleDebugSessionCustomEvent } from './XQDebugger/xqyDebugManager';


const MLDBCLIENT = 'mldbClient';

export function activate(context: vscode.ExtensionContext): void {
    context.globalState.update(MLDBCLIENT, null as ml.DatabaseClient);
    const provider = new ClientResponseProvider();
    const mprovider = new ModuleContentProvider();

    vscode.workspace.registerTextDocumentContentProvider(
        ClientResponseProvider.scheme, provider);
    vscode.workspace.registerTextDocumentContentProvider(
        ModuleContentProvider.scheme, mprovider);

    vscode.workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration('marklogic')) {
            ConfigurationManager.handleUpdateConfigurationEvent();
        }
    });

    const editorQueryEvaluator = new EditorQueryEvaluator(context, provider);
    const markLogicUnitTestClient = new MarkLogicUnitTestClient(context);
    const markLogicTdeValidateClient = new MarkLogicTdeValidateClient(context);
    const sendXQuery = vscode.commands.registerTextEditorCommand(
        'extension.sendXQuery',
        (editor: vscode.TextEditor) => editorQueryEvaluator.editorQuery(EditorQueryType.XQY, editor)
    );
    const sendJSQuery = vscode.commands.registerTextEditorCommand(
        'extension.sendJSQuery',
        (editor: vscode.TextEditor) => editorQueryEvaluator.editorQuery(EditorQueryType.JS, editor)
    );
    const sendSqlQuery = vscode.commands.registerTextEditorCommand(
        'extension.sendSqlQuery',
        (editor: vscode.TextEditor) => editorQueryEvaluator.editorQuery(EditorQueryType.SQL, editor)
    );
    const sendSparqlQuery = vscode.commands.registerTextEditorCommand(
        'extension.sendSparqlQuery',
        (editor: vscode.TextEditor) => editorQueryEvaluator.editorQuery(EditorQueryType.SPARQL, editor)
    );
    const sendGraphQlQuery = vscode.commands.registerTextEditorCommand(
        'extension.sendGraphQlQuery',
        (editor: vscode.TextEditor) => editorQueryEvaluator.editorQuery(EditorQueryType.GRAPHQL, editor)
    );
    function sendEditorRowsQuery(editor: vscode.TextEditor, rowsResponseFormat: ml.RowsResponseFormat) {
        editorQueryEvaluator.editorQuery(EditorQueryType.ROWS, editor, rowsResponseFormat);
    }
    const sendRowsJsonQuery = vscode.commands.registerTextEditorCommand(
        'extension.sendRowsJsonQuery', (editor: vscode.TextEditor) => sendEditorRowsQuery(editor, 'json'));
    const sendRowsCsvQuery = vscode.commands.registerTextEditorCommand(
        'extension.sendRowsCsvQuery', (editor: vscode.TextEditor) => sendEditorRowsQuery(editor, 'csv'));
    const sendRowsXmlQuery = vscode.commands.registerTextEditorCommand(
        'extension.sendRowsXmlQuery', (editor: vscode.TextEditor) => sendEditorRowsQuery(editor, 'xml'));
    const runTestModule = vscode.commands.registerTextEditorCommand(
        'extension.runTestModule',
        (editor: vscode.TextEditor) => {
            const cfg: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration();
            markLogicUnitTestClient.runTestModule(cfg, editor);
        }
    );
    const validateTdeTemplate = vscode.commands.registerTextEditorCommand(
        'extension.validateTdeTemplate',
        (editor: vscode.TextEditor) => {
            const clientParams: MlClientParameters = newClientParams(vscode.workspace.getConfiguration());
            const dbClientContext: ClientContext = new ClientContext(clientParams);
            const tdeText = editor.document.getText();
            markLogicTdeValidateClient.validateTdeTemplate(dbClientContext, tdeText);
        }
    );
    const tdeExtractNodes = vscode.commands.registerTextEditorCommand(
        'extension.tdeExtractNodes',
        (editor: vscode.TextEditor) => {
            const clientParams: MlClientParameters = newClientParams(vscode.workspace.getConfiguration());
            const dbClientContext: ClientContext = new ClientContext(clientParams);
            const tdeText = editor.document.getText();
            markLogicTdeValidateClient.tdeExtractNodes(dbClientContext, tdeText);
        }
    );


    const connectJsServer = vscode.commands.registerCommand('extension.connectJsServer', () => {
        const cfg: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration();
        const dbClientContext: ClientContext = getDbClientWithoutOverrides(cfg, context.globalState);
        if (dbClientContext) {
            JsDebugManager.connectToJsDebugServer(dbClientContext);
        }
    });
    const disconnectJsServer = vscode.commands.registerCommand('extension.disconnectJsServer', () => {
        const cfg: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration();
        const dbClientContext: ClientContext = getDbClientWithoutOverrides(cfg, context.globalState);
        if (dbClientContext) {
            JsDebugManager.disconnectFromJsDebugServer(dbClientContext);
        }
    });
    const connectXqyServer = vscode.commands.registerCommand('extension.connectXqyServer', () => {
        const cfg: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration();
        const dbClientContext: ClientContext = getDbClientWithoutOverrides(cfg, context.globalState);
        if (dbClientContext) {
            XqyDebugManager.connectToXqyDebugServer(dbClientContext);
        }
    });
    const disconnectXqyServer = vscode.commands.registerCommand('extension.disconnectXqyServer', () => {
        const cfg: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration();
        const dbClientContext: ClientContext = getDbClientWithoutOverrides(cfg, context.globalState);
        if (dbClientContext) {
            XqyDebugManager.disconnectFromXqyDebugServer(dbClientContext);
        }
    });


    const showModule = vscode.commands.registerCommand('extension.showModule', () => {
        const cfg: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration();
        const dbClientContext: ClientContext = getDbClientWithoutOverrides(cfg, context.globalState);
        if (dbClientContext) {
            pickAndShowModule(mprovider, dbClientContext);
        }
    });

    handleUnload(context, [
        connectJsServer, disconnectJsServer, connectXqyServer, disconnectXqyServer,
        sendXQuery, sendJSQuery, sendSqlQuery, sendSparqlQuery, sendGraphQlQuery,
        sendRowsJsonQuery, sendRowsCsvQuery, sendRowsXmlQuery,
        runTestModule, validateTdeTemplate, tdeExtractNodes, showModule
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
        vscode.debug.registerDebugAdapterTrackerFactory('xquery-ml', {
            createDebugAdapterTracker() {
                return {
                    onWillReceiveMessage: message => {
                        console.debug(`Receive Message: ${JSON.stringify(message)}`);
                    },
                    onDidSendMessage: message => {
                        console.debug(`Send Message: ${JSON.stringify(message)}`);
                    }
                };
            }
        }),
        vscode.debug.onDidReceiveDebugSessionCustomEvent(event => handleDebugSessionCustomEvent(event)),
        xqyDebugFactory as never
    ]);


    const mlxprsStatus: MlxprsStatus = new MlxprsStatus(context);
    handleUnload(context, [mlxprsStatus.getStatusBarItem(), mlxprsStatus.getCommand()]);
    XqyDebugManager.registerMlxprsStatusBarItem(mlxprsStatus);
    JsDebugManager.registerMlxprsStatusBarItem(mlxprsStatus);
    mlxprsStatus.requestUpdate();


    const mlxprsWebViewProvider = new MlxprsWebViewProvider(context.extensionUri);
    const mlxprsWebView = vscode.window.registerWebviewViewProvider(MlxprsWebViewProvider.viewType, mlxprsWebViewProvider);
    EditorQueryEvaluator.registerMlxprsResultsViewProvider(mlxprsWebViewProvider);
    MarkLogicUnitTestClient.registerMlxprsResultsViewProvider(mlxprsWebViewProvider);
    MarkLogicTdeValidateClient.registerMlxprsResultsViewProvider(mlxprsWebViewProvider);
    context.subscriptions.push(mlxprsWebView);
    handleUnload(context, [mlxprsWebView]);
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