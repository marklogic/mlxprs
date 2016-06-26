'use strict';
import * as vscode from 'vscode';
import * as ml from 'marklogic';

export function activate(context: vscode.ExtensionContext) {

    const mldbClient = 'mldbClient';
    context.globalState.update(mldbClient, <ml.DatabaseClient>null);

    /**
     * marklogicVSClient
     */
    class marklogicVSClient {
        dbName : string;
        docsDbNumber : string;
        mldbClient : ml.DatabaseClient;
        constructor(host : string, port : number, user : string, pwd : string, dbName : string) {
            this.dbName = dbName;
            this.docsDbNumber = "0";
            this.mldbClient = ml.createDatabaseClient({
                host: host, port: port, user: user, password: pwd,
                authType: 'DIGEST'});
            this.mldbClient.eval("xdmp.database('"+ dbName +"')")
                .result(null,null).then((response) => {
                    this.docsDbNumber = response[0]['value'];
                });
        };
    }

    function getDbClient() : marklogicVSClient {
        var cfg = vscode.workspace.getConfiguration();

        var host = String(cfg.get("marklogic.host"));
        var user = String(cfg.get("marklogic.username"));
        var pwd = String(cfg.get("marklogic.password"));
        var port = Number(cfg.get("marklogic.port"));
        var dbName = String(cfg.get("marklogic.documentsDb"));

        if (context.globalState.get(mldbClient) === null) {
            var newClient = new marklogicVSClient(host, port, user, pwd, dbName);
            try {
                context.globalState.update(mldbClient, newClient);
            } catch(e) {
                console.log(JSON.stringify(e));
            }
        };
        return context.globalState.get<marklogicVSClient>("mldbClient");
    };

    /**
     * QueryResultsContentProvider implements vscode.TextDocumentContentProvider
     */
    class QueryResultsContentProvider implements vscode.TextDocumentContentProvider {
        public provideTextDocumentContent(uri: vscode.Uri): string {
            return "12";
        }

    };

    function _sendXQuery() : Object {
        let actualQuery = vscode.window.activeTextEditor.document.getText();
        let db = getDbClient();

        let cfg = vscode.workspace.getConfiguration();
        let docdb = db.docsDbNumber;

        let query =
            'xquery version "1.0-ml";' +
            'declare variable $actualQuery as xs:string external;' +
            'declare variable $documentsDb as xs:string external;' +
            'let $options := ' +
            '<options xmlns="xdmp:eval">' +
            '   <database>{xdmp:database($documentsDb)}</database>' +
            '</options>' +
            'return xdmp:eval($actualQuery, (), $options)';
        let extVars = <ml.Variables>{'actualQuery': actualQuery, 'documentsDb': db.dbName};

        var responsePayload;
        db.mldbClient.xqueryEval(query, extVars).result(
            function(response) {
                vscode.window.showInformationMessage(JSON.stringify(response));
                responsePayload = response;
            },
            function (error) {
                vscode.window.showErrorMessage(JSON.stringify(error.body.errorResponse.message));
                console.error(JSON.stringify(error));
            });
            return responsePayload;
    };

    function _sendJSQuery() : Object {
        var actualQuery = vscode.window.activeTextEditor.document.getText();
        var db = getDbClient();
        var responsePayload;
        db.mldbClient.eval(actualQuery).result(
            function(response) {
                vscode.window.showInformationMessage(JSON.stringify(response));
                responsePayload = response;
            },
            function (error) {
                vscode.window.showErrorMessage(JSON.stringify(error.body.errorResponse.message));
                console.error(JSON.stringify(error));
            });
        return responsePayload;
    };

    let sendXQuery = vscode.commands.registerCommand('extension.sendXQuery', () => {_sendXQuery()});

    let sendJSQuery = vscode.commands.registerCommand('extension.sendJSQuery', () => {_sendJSQuery()});

    context.subscriptions.push(sendXQuery);
    context.subscriptions.push(sendJSQuery);
}

// this method is called when your extension is deactivated
export function deactivate(context: vscode.ExtensionContext) {
    context.globalState.get<ml.DatabaseClient>("mldbClient").release();
    context.globalState.update("mldbClient", null);
}