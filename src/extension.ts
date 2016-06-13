'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as ml from 'marklogic';

export function activate(context: vscode.ExtensionContext) {

    let sendXQuery = vscode.commands.registerCommand('extension.sendXQuery', () => {
        var cfg = vscode.workspace.getConfiguration();

        var host = String(cfg.get("marklogic.host"));
        var user = String(cfg.get("marklogic.username"));
        var pwd = String(cfg.get("marklogic.password"));
        var port = Number(cfg.get("marklogic.port"));

        var query = vscode.window.activeTextEditor.document.getText();

        var db = ml.createDatabaseClient({
          host: host, port: 8000, user: user, password: pwd,
          authType: 'DIGEST'
        });
        db.xqueryEval(query).result(
            function(response) {
                vscode.window.showInformationMessage(JSON.stringify(response));
            },
            function (error) {
                vscode.window.showErrorMessage(JSON.stringify(error.body.errorResponse.message));
                console.error(JSON.stringify(error));
            });
    });
    context.subscriptions.push(sendXQuery);
}

// this method is called when your extension is deactivated
export function deactivate() {
}