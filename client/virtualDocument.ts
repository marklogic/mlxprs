import * as vscode from 'vscode'

export class VirtualContentProvider<DocType extends Document> implements vscode.TextDocumentContentProvider, vscode.Disposable {

    // Document constructor function delegate
    //  This is necessary because JS doesn't maintain class information at runtime and we need to know what to construct.
    //  It works by pulling in the constructor from the type passed into the constructor of this class.
    //  Calling `new this.docConstructor()` actually calls the constructor of the referenced class.
    private docConstructor: (new (uri: vscode.Uri, ReloadFunc: () => void, DecorateFunc: () => void) => DocType);
    // Document formatter function delegate
    private decorateFunc: () => void;

    private _documents = new Map<string, DocType>();
    private _subscriptions: vscode.Disposable[] = [];
    //Calling `_onDidChangeEmitter.fire(uri)` tells VSCode that the document has updated content and to reload the page.
    private _onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();

    constructor(
        //This param should always match the type chosen for DocType. e.g., `new VirtualContentProvider<T>(T, ...)`
        docConstructor: { new (
            uri: vscode.Uri,
            reloadFunc: () => void,
            decorateFunc: () => void
        ): DocType },
        decorateFunc: () => void
    ) {
        this.docConstructor = docConstructor
        this.decorateFunc = decorateFunc

        //Keep track of disposables
        this._subscriptions.push(
            //Remove documents when they are closed to prevent leaks
            //NOTE: VSCode may take up to 3 minutes to fire this event
            vscode.workspace.onDidCloseTextDocument(doc => {
                console.debug(`Received onDidCloseTextDocument.  Uri: ${doc.uri}`)
                this.removeDocument(doc.uri)
            }),
            this._onDidChangeEmitter
        )
    }

    //Subscribe to this to be notified when the document is updated
    get onDidChange(): vscode.Event<vscode.Uri> {
        return this._onDidChangeEmitter.event
    }

    public getDocument(uri: vscode.Uri | string): DocType {
        return this._documents.get(uri.toString())
    }

    public getAvailableUri(filename: string, extension = ''): vscode.Uri {
        let uriString = filename + extension
        let i = 1
        while (this._documents.has(uriString)) {
            uriString = filename + '-' + i + extension
            i++
        }
        return vscode.Uri.parse(uriString, true)
    }

    //This gets called by VSCode whenever a new document is created or the onDidChange event fires
    public provideTextDocumentContent(uri: vscode.Uri): string {
        if (!this.getDocument(uri)) {
            this.addDocument(uri)
        }
        return this.getDocument(uri).text
    }

    public dispose(): void {
        Array.from(this._documents.values()).map(
            document => document?.dispose()
        )
        this._documents.clear()
        this._subscriptions.map(sub => sub.dispose())
    }

    private addDocument(uri: vscode.Uri): void {
        console.debug(`Adding document: ${uri}`)
        this._documents.set(uri.toString(), new this.docConstructor(uri, () => this.reloadDocument(uri), this.decorateFunc))
    }

    private removeDocument(uri: vscode.Uri): void {
        const uriString = uri.toString()
        console.debug(`Removing document: ${uriString}`)
        this._documents.get(uriString)?.dispose()
        this._documents.delete(uriString)
    }

    private reloadDocument(uri: vscode.Uri): void {
        console.debug(`Reloading document: ${uri}`)
        this._onDidChangeEmitter.fire(uri)
    }
}

export class Document implements vscode.Disposable {
    protected reload: () => void;
    protected decorate: () => void;
    protected _uri: vscode.Uri;
    protected _text: string;
    protected _subscriptions: vscode.Disposable[] = [];

    constructor(uri: vscode.Uri, reloadFunc: () => void, decorateFunc: () => void) {
        this.reload = reloadFunc
        this.decorate = decorateFunc
        this._uri = uri

        //Keep track of disposables
        this._subscriptions.push(
            vscode.workspace.onDidChangeTextDocument((e: vscode.TextDocumentChangeEvent) => {
                if (e.document.uri.toString() === this.uri.toString()) {
                    this.decorate()
                }
            })
        )
    }

    public get text(): string {
        return this._text
    }

    //Derived classes should use this setter to make sure onDidChange events are handled properly
    public set text(text: string) {
        this._text = text
        this.reload()
    }

    public get uri(): vscode.Uri {
        return this._uri
    }

    public dispose(): void {
        this._subscriptions.map(sub => sub.dispose())
    }
}
