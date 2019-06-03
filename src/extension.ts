'use strict';
import * as path from 'path';
import * as vscode from 'vscode';
import * as ml from 'marklogic';
import MarklogicVSClient from './marklogicClient';
import { XmlFormattingEditProvider } from './xmlFormatting/Formatting';
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient';

export function activate(context: vscode.ExtensionContext) {

    const MLDBCLIENT = 'mldbClient';
    context.globalState.update(MLDBCLIENT, <ml.DatabaseClient>null);

    /**
     * Caching mechanism for the ML Client in the VSCode global state.
     */
    function getDbClient(): MarklogicVSClient {
        var cfg = vscode.workspace.getConfiguration();

        var host = String(cfg.get("marklogic.host"));
        var user = String(cfg.get("marklogic.username"));
        var pwd = String(cfg.get("marklogic.password"));
        var port = Number(cfg.get("marklogic.port"));
        var contentDb = String(cfg.get("marklogic.documentsDb"));
        var modulesDb = String(cfg.get("marklogic.modulesDb"));
        var authType = String(cfg.get("marklogic.authType")).toUpperCase();
        var ssl = Boolean(cfg.get("marklogic.ssl"));
        var pathToCa = String(cfg.get("marklogic.pathToCa"));

        // if settings have changed, release and clear the client
        let mlc = <MarklogicVSClient>context.globalState.get(MLDBCLIENT);
        if (mlc !== null && !mlc.compareTo(host, port, user, pwd, authType, contentDb, modulesDb, ssl, pathToCa)) {
            mlc.mldbClient.release();
            context.globalState.update(MLDBCLIENT, null);
            console.info("Cleared MarkLogicVSClient for new settings.");
        }

        // if there's no existing client in the globalState, instantiate a new one
        if (context.globalState.get(MLDBCLIENT) === null) {
            let newClient: MarklogicVSClient =
                buildNewClient(host, port, user, pwd, authType, contentDb, modulesDb, ssl, pathToCa);
            try {
                context.globalState.update(MLDBCLIENT, newClient);
                console.info("New MarkLogicVSClient: " + context.globalState.get(MLDBCLIENT));
            } catch (e) {
                console.error("Error: " + JSON.stringify(e));
                e.message ? console.error(e.message) : null;
            }
        };
        return context.globalState.get<MarklogicVSClient>(MLDBCLIENT);
    };

    function buildNewClient(host: string, port: number, user: string,
                            pwd: string, authType: string, contentDb: string,
                            modulesDb: string, ssl: boolean, pathToCa: string): MarklogicVSClient {
        let newClient: MarklogicVSClient;
        try {
            newClient = new MarklogicVSClient(host, port, user, pwd, authType, contentDb, modulesDb, ssl, pathToCa)
        } catch (e) {
            vscode.window.showErrorMessage(e.toString())
        }
        return newClient;
    };

    function encodeLocation(uri: vscode.Uri, host: string, port: number): vscode.Uri {
        let query = JSON.stringify([uri.toString()]);
        let newUri = vscode.Uri.parse(`${QueryResultsContentProvider.scheme}://${host}:${port}/${uri.path}?${query}`);
        let newUriString = newUri.toString();
        return newUri;
    }

    function myFormattingOptions(): vscode.FormattingOptions {
        return { tabSize: 2, insertSpaces: true }
    }

    /**
     * QueryResultsContentProvider implements vscode.TextDocumentContentProvider
     */
    class QueryResultsContentProvider implements vscode.TextDocumentContentProvider {
        private _onDidChange = new vscode.EventEmitter<vscode.Uri>();
        public _cache = new Map<string, Object>();

        static scheme = 'mlquery';
        /**
         * Expose an event to signal changes of _virtual_ documents
         * to the editor
         */
        get onDidChange() { return this._onDidChange.event; };
        public update(uri: vscode.Uri) { this._onDidChange.fire(uri); };

        public updateResultsForUri(uri: vscode.Uri, val: Object) {
            this._cache.set(uri.toString(), val);
        };

        private unwrap(o: Object): string {
            if (o['format'] === 'xml') {
                return JSON.parse(JSON.stringify(o['value']));
            }
            if (o['format'] === 'text' && o['datatype'] === 'node()') {
                return this.decodeBinaryText(o['value']);
            }
            if (o['format'] === 'text' && o['datatype'] === 'other') {
                return o['value'];
            }
            return JSON.stringify(o['value']);
        };

        private decodeBinaryText(arr: Uint8Array): string {
            if ((typeof arr[0]) === "string") {
                return arr.toString();
            }
            let str = '';
            for (let i = 0; i < arr.length; i++) {
                str += '%' + ('0' + arr[i].toString(16)).slice(-2);
            }
            str = decodeURIComponent(str);
            return str;
        }

        public provideTextDocumentContent(uri: vscode.Uri): string {
            let results = this._cache.get(uri.toString());
            if (results) {
                let r = <Array<Object>>results;
                return r.map(o => this.unwrap(o)).join("\n");
            }
            return "pending..."
        }
    };

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
            .then(
                (e: vscode.TextEditor) => {
                    vscode.commands.executeCommand('vscode.executeFormatDocumentProvider', doc.uri, myFormattingOptions())
                        .then(
                            (edits: vscode.TextEdit[]) => applyEdits(edits, doc),
                            error => console.error(error))
                })
    };

    function applyEdits(edits: vscode.TextEdit[], doc: vscode.TextDocument): void {
        if (edits !== undefined) {
            let formatEdit = new vscode.WorkspaceEdit();
            formatEdit.set(doc.uri, edits);
            vscode.workspace.applyEdit(formatEdit);
        }
    }

    function _sendXQuery(actualQuery: string, uri: vscode.Uri, editor: vscode.TextEditor): void {
        let db = getDbClient();
        let cfg = vscode.workspace.getConfiguration();

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
        let db = getDbClient();
        let cfg = vscode.workspace.getConfiguration();

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
        let host = getDbClient().host; let port = getDbClient().port;
        let qUri = encodeLocation(editor.document.uri, host, port);
        _sendXQuery(actualQuery, qUri, editor)
    });
    let sendJSQuery = vscode.commands.registerTextEditorCommand('extension.sendJSQuery', editor => {
        let actualQuery = editor.document.getText();
        let host = getDbClient().host; let port = getDbClient().port;
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
