'use strict';
import * as path from 'path';
import * as vscode from 'vscode';
import * as ml from 'marklogic';
import { getDbClient } from './marklogicClient';
import { QueryResultsContentProvider } from './queryResultsContentProvider'
import { XmlFormattingEditProvider } from './xmlFormatting/Formatting';
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient';

const MLDBCLIENT = 'mldbClient';

export function activate(context: vscode.ExtensionContext) {
    context.globalState.update(MLDBCLIENT, <ml.DatabaseClient>null);

    function encodeLocation(uri: vscode.Uri, host: string, port: number): vscode.Uri {
        let query = JSON.stringify([uri.toString()]);
        let newUri = vscode.Uri.parse(`${QueryResultsContentProvider.scheme}://${host}:${port}/${uri.path}?${query}`);
        let newUriString = newUri.toString();
        return newUri;
    }

    function myFormattingOptions(): vscode.FormattingOptions {
        return { tabSize: 2, insertSpaces: true }
    }

    function _handleResponseToUri(uri: vscode.Uri, response: Array<Object>): vscode.Uri {
        let fmt = 'nothing'
        if (response.length > 0) {
            fmt = response[0]['format'];
        } else {
            vscode.window.showInformationMessage(`Query in ${uri.query} got an empty response from ${uri.authority}`)
        }
        let responseUri = vscode.Uri.parse(`${QueryResultsContentProvider.scheme}://${uri.authority}${uri.path}.${fmt}?${uri.query}`);
        provider.updateResultsForUri(responseUri, response);
        provider.update(responseUri);
        return responseUri;
    };
    function _handleError(uri: vscode.Uri, error: any): vscode.Uri {
        let errorMessage = "";
        let errorResultsObject = { datatype: "node()", format: "json", value: error };
        if (error.body === undefined) {
            // problem reaching MarkLogic
            errorMessage = error.message;
        } else {
            // MarkLogic error: useful message in body.errorResponse
            errorMessage = error.body.errorResponse.message;
            errorResultsObject.value = error.body;
        }
        let responseUri = vscode.Uri.parse(`${QueryResultsContentProvider.scheme}://${uri.authority}${uri.path}-error.json?${uri.query}`);
        vscode.window.showErrorMessage(JSON.stringify(errorMessage));
        provider.updateResultsForUri(responseUri, [errorResultsObject]);
        provider.update(responseUri);
        return responseUri;
    };

    /**
     * Show the results of incoming query results (doc) in the (editor).
     * Try to format the results for readability.
     */
    function receiveDocument(doc: vscode.TextDocument, editor: vscode.TextEditor): void {
        vscode.window.showTextDocument(doc, editor.viewColumn + 1, true)
            .then((e: vscode.TextEditor) => {
                formatResults(doc)
            })
    }

    async function formatResults(doc: vscode.TextDocument) {
        const fOptions: vscode.FormattingOptions = myFormattingOptions()
        const edits: vscode.TextEdit[] = await vscode.commands.executeCommand('vscode.executeFormatDocumentProvider', doc.uri, fOptions);
        applyEdits(edits, doc);
    }

    function applyEdits(edits: vscode.TextEdit[], doc: vscode.TextDocument): void {
        if (edits !== undefined) {
            let formatEdit = new vscode.WorkspaceEdit();
            formatEdit.set(doc.uri, edits);
            vscode.workspace.applyEdit(formatEdit);
        }
    }

    function _sendXQuery(actualQuery: string, uri: vscode.Uri, editor: vscode.TextEditor): void {
        let cfg = vscode.workspace.getConfiguration();
        let db = getDbClient(cfg, context);

        let query =
            'xquery version "1.0-ml";' +
            'declare variable $actualQuery as xs:string external;' +
            'declare variable $documentsDb as xs:string external;' +
            'declare variable $modulesDb as xs:string external;' +
            'let $options := ' +
            '<options xmlns="xdmp:eval">' +
            '   <database>{xdmp:database($documentsDb)}</database>' +
            '   <modules>{xdmp:database($modulesDb)}</modules>' +
            '</options>' +
            'return xdmp:eval($actualQuery, (), $options)';
        let extVars = <ml.Variables>{
            'actualQuery': actualQuery,
            'documentsDb': db.contentDb,
            'modulesDb': db.modulesDb
        };

        let response = db.mldbClient.xqueryEval(query, extVars).result(
            (fulfill: Object[]) => {
                let responseUri = _handleResponseToUri(uri, fulfill);
                vscode.workspace.openTextDocument(responseUri)
                    .then(doc => receiveDocument(doc, editor))
            },
            (error: Object) => {
                let responseUri = _handleError(uri, error);
                vscode.workspace.openTextDocument(responseUri)
                    .then(doc => receiveDocument(doc, editor))
            });
    };

    function _sendJSQuery(actualQuery: string, uri: vscode.Uri, editor: vscode.TextEditor): void {
        let cfg = vscode.workspace.getConfiguration();
        let db = getDbClient(cfg, context);

        let query = "xdmp.eval(actualQuery, {actualQuery: actualQuery}," +
            `{database: xdmp.database(contentDb), modules: xdmp.database(modulesDb)});`;

        let extVars = <ml.Variables>{
            'actualQuery': actualQuery,
            'contentDb': db.contentDb,
            'modulesDb': db.modulesDb
        }

        db.mldbClient.eval(query, extVars).result(
            (response: Object[]) => {
                let responseUri = _handleResponseToUri(uri, response);
                vscode.workspace.openTextDocument(responseUri)
                    .then(doc => receiveDocument(doc, editor))
            },
            (error: Object[]) => {
                let responseUri = _handleError(uri, error);
                vscode.workspace.openTextDocument(responseUri)
                    .then(doc => receiveDocument(doc, editor))
            })
    };

    let provider = new QueryResultsContentProvider();
    let registration = vscode.workspace.registerTextDocumentContentProvider(
        QueryResultsContentProvider.scheme, provider);

    let sendXQuery = vscode.commands.registerTextEditorCommand('extension.sendXQuery', editor => {
        let actualQuery = editor.document.getText();
        let cfg = vscode.workspace.getConfiguration();
        let client = getDbClient(cfg, context);
        let host = client.host; let port = client.port;
        let qUri = encodeLocation(editor.document.uri, host, port);
        _sendXQuery(actualQuery, qUri, editor)
    });
    let sendJSQuery = vscode.commands.registerTextEditorCommand('extension.sendJSQuery', editor => {
        let actualQuery = editor.document.getText();
        let cfg = vscode.workspace.getConfiguration();
        let client = getDbClient(cfg, context);
        let host = client.host; let port = client.port;
        let uri = encodeLocation(editor.document.uri, host, port);
        _sendJSQuery(actualQuery, uri, editor);
    });



    context.subscriptions.push(sendXQuery);
    context.subscriptions.push(sendJSQuery);
    context.subscriptions.push(
        vscode.languages.registerDocumentFormattingEditProvider(
            { scheme: "mlquery", language: "xml" },
            new XmlFormattingEditProvider()
        )
    );
    context.subscriptions.push(
        vscode.languages.registerDocumentFormattingEditProvider(
            { scheme: "mlquery", language: "xsl" },
            new XmlFormattingEditProvider()
        )
    );

    // XQuery hinting client below
    let serverModule = context.asAbsolutePath(path.join('server', 'dist', 'server.js'));
    let debugOptions = { execArgv: ["--nolazy", "--inspect=6004"] };
    let serverOptions: ServerOptions = {
        run: { module: serverModule, transport: TransportKind.ipc },
        debug: { module: serverModule, transport: TransportKind.ipc, options: debugOptions }
    }
    let clientOptions: LanguageClientOptions = {
        documentSelector: [
            { language: "xquery-ml", scheme: "file" },
            { language: "xquery-ml", scheme: "untitled" },
            { language: "javascript", scheme: "file" },
            { language: "javascript", scheme: "untitled" }
        ],
        synchronize: {
            // Notify the server about file changes to '.clientrc files contain in the workspace
            fileEvents: vscode.workspace.createFileSystemWatcher('**/.clientrc')
        }
    }
    let disposable = new LanguageClient('xQueryLanguageServer', 'XQuery Language Server', serverOptions, clientOptions).start();
    context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate(context: vscode.ExtensionContext) {
    context.globalState.get<ml.DatabaseClient>("mldbClient").release();
    context.globalState.update("mldbClient", null);
}
