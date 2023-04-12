import { CancellationToken, SnippetString, Uri, Webview, WebviewView, WebviewViewProvider, WebviewViewResolveContext, window } from 'vscode';

export class MlxprsWebViewProvider implements WebviewViewProvider {

    public static readonly viewType = 'mlxprs.ResultsView';

    private _view?: WebviewView;

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
        this.updateViewContent('');

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
        this._view.webview.html = this.getWebviewContent(this._view.webview, newContent);
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

}
