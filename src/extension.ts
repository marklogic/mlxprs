'use strict';
import * as vscode from 'vscode';
import * as ml from 'marklogic';

export function activate(context: vscode.ExtensionContext) {

    context.globalState.update("mldbClient", null);

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

        if (context.globalState.get("mldbClient") === null) {
            context.globalState.update(
                "mldbClient",
                new marklogicVSClient(host, port, user, pwd, dbName));
        };
        return context.globalState.get<marklogicVSClient>("mldbClient");
    };

    let sendXQuery = vscode.commands.registerCommand('extension.sendXQuery', () => {
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

        db.mldbClient.xqueryEval(query, extVars).result(
            function(response) {
                vscode.window.showInformationMessage(JSON.stringify(response));
            },
            function (error) {
                vscode.window.showErrorMessage(JSON.stringify(error.body.errorResponse.message));
                console.error(JSON.stringify(error));
            });
    });

    let sendJSQuery = vscode.commands.registerCommand('extension.sendJSQuery', () => {
        var query = vscode.window.activeTextEditor.document.getText();
        var db = getDbClient();
        db.mldbClient.eval(query).result(
            function(response) {
                vscode.window.showInformationMessage(JSON.stringify(response));
            },
            function (error) {
                vscode.window.showErrorMessage(JSON.stringify(error.body.errorResponse.message));
                console.error(JSON.stringify(error));
            });
    });

    context.subscriptions.push(sendXQuery);
    context.subscriptions.push(sendJSQuery);
}

// this method is called when your extension is deactivated
export function deactivate(context: vscode.ExtensionContext) {
    context.globalState.get<ml.DatabaseClient>("mldbClient").release();
    context.globalState.update("mldbClient", null);
}