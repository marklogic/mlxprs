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

import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import {
    CancellationToken, SnippetString, Uri, Webview, WebviewView,
    WebviewViewProvider, WebviewViewResolveContext, window
} from 'vscode';

export class MlxprsWebViewProvider implements WebviewViewProvider {

    public static readonly viewType = 'mlxprs.ResultsView';

    private _view?: WebviewView;
    private content: string = null;

    constructor(
        private readonly _extensionUri: Uri,
    ) { }

    public resolveWebviewView(
        webviewView: WebviewView,
        context: WebviewViewResolveContext,
        _token: CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            // Allow scripts in the webview
            enableScripts: true,

            localResourceRoots: [
                this._extensionUri
            ]
        };
        if (this.content) {
            this.updateViewContent(this.content);
        } else {
            this.updateViewContent('');
        }

        webviewView.webview.onDidReceiveMessage(data => {
            switch (data.type) {
            case 'colorSelected':
            {
                window.activeTextEditor?.insertSnippet(new SnippetString(`#${data.value}`));
                break;
            }
            }
        });
    }

    public updateViewContent(newContent: string) {
        this.content = newContent;
        if (this._view) {
            this._view.webview.html = this.getWebviewContent(this._view.webview, newContent);
        }
    }

    private getWebviewContent(webview: Webview, content: string) {
        return `<!DOCTYPE html>
      <html lang="en">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Example Webview</title>
      </head>
      <body>
        ${content}
      </body>
      </html>`;
    }

    public static convertXmlResponseToHtml(rawXml: string): string {
        const options = {
            ignoreAttributes: false,
            attributeNamePrefix: '@_',
            format: true
        };
        const parser = new XMLParser(options);
        const jObj = parser.parse(rawXml);
        const builder = new XMLBuilder(options);
        const formattedXml = builder.build(jObj);

        const lineCount = (formattedXml.match(/\n/g) || []).length + 1;
        return `<textarea white-space: pre; rows="${lineCount}" cols="40" style="width: 100%; color: #fff;background: transparent;border:none;">` + formattedXml + '</textarea>';
    }

    public static convertTextResponseToHtml(text: string): string {
        return '<pre>' + text + '</pre>';
    }

}
