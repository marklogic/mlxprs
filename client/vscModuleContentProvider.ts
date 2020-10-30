'use strict'

import { Event, EventEmitter, TextDocument, TextDocumentContentProvider, Uri,
    window, workspace } from 'vscode'
import { MarklogicClient } from './marklogicClient'
import { ModuleContentHandler } from './moduleContentHandler'

const scheme = 'mlmodule'

function encodeLocation(host: string, port: number, path: string): Uri {
    const newUri = Uri.parse(`${scheme}://${host}:${port}${path}`)
    return newUri
}


export class ModuleContentProvider implements TextDocumentContentProvider {
    static scheme = scheme
    private _onDidChange = new EventEmitter<Uri>()
    private _mlModuleGetter: ModuleContentHandler

    public initialize(client: MarklogicClient): void {
        this._mlModuleGetter = new ModuleContentHandler(client)
    }

    async provideTextDocumentContent(uri: Uri): Promise<string> {
        return this._mlModuleGetter.readTextDocumentContent(uri.path)
    }

    get onDidChange(): Event<Uri> { return this._onDidChange.event }

    public async listModules(): Promise<string[]> {
        return this._mlModuleGetter.listModules()
    }
}

export async function pickAndShowModule(mprovider: ModuleContentProvider, client: MarklogicClient): Promise<void> {
    mprovider.initialize(client)
    mprovider.listModules()
        .then((moduleUris: string[]) => {
            return window.showQuickPick(moduleUris)
        })
        .then((URIstring: string) => {
            const uri: Uri = encodeLocation(client.params.host, client.params.port, URIstring)
            return uri
        })
        .then((uri: Uri) => {
            return workspace.openTextDocument(uri)
        })
        .then((doc: TextDocument) => {
            window.showTextDocument(doc)
        })
}
