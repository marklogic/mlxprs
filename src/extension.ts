'use strict';
import * as vscode from 'vscode';
import * as ml from 'marklogic';

export function activate(context: vscode.ExtensionContext) {

    function getDbClient() : ml.DatabaseClient {
        // TODO: keep a single client open
        // release and create a new one only if there are changes
        var cfg = vscode.workspace.getConfiguration();

        var host = String(cfg.get("marklogic.host"));
        var user = String(cfg.get("marklogic.username"));
        var pwd = String(cfg.get("marklogic.password"));
        var port = Number(cfg.get("marklogic.port"));

        return ml.createDatabaseClient({
            host: host, port: port, user: user, password: pwd,
            authType: 'DIGEST'
        })
    };

    let sendXQuery = vscode.commands.registerCommand('extension.sendXQuery', () => {
        var query = vscode.window.activeTextEditor.document.getText();
        var db = getDbClient();
        db.xqueryEval(query).result(
            function(response) {
                vscode.window.showInformationMessage(JSON.stringify(response));
                db.release();
            },
            function (error) {
                vscode.window.showErrorMessage(JSON.stringify(error.body.errorResponse.message));
                console.error(JSON.stringify(error));
                db.release();
            });
    });

    let sendJSQuery = vscode.commands.registerCommand('extension.sendJSQuery', () => {
        var query = vscode.window.activeTextEditor.document.getText();
        var db = getDbClient();
        db.eval(query).result(
            function(response) {
                vscode.window.showInformationMessage(JSON.stringify(response));
                db.release();
            },
            function (error) {
                vscode.window.showErrorMessage(JSON.stringify(error.body.errorResponse.message));
                console.error(JSON.stringify(error));
                db.release();
            });
    });

    context.subscriptions.push(sendXQuery);
    context.subscriptions.push(sendJSQuery);
}

// this method is called when your extension is deactivated
export function deactivate() {
}