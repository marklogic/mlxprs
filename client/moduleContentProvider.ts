'use strict'

import { Event, EventEmitter, TextDocumentContentProvider, Uri } from 'vscode'
import { MarklogicClient } from './marklogicClient'
import { ModuleContentGetter } from './moduleContentGetter'

const scheme = 'mlmodule'

export function encodeLocation(host: string, port: number, path: string): Uri {
    const newUri = Uri.parse(`${scheme}://${host}:${port}${path}`)
    return newUri
}


export class ModuleContentProvider implements TextDocumentContentProvider {
    static scheme = scheme
    private _onDidChange = new EventEmitter<Uri>()
    private _mlModuleGetter: ModuleContentGetter

    public initialize(client: MarklogicClient): void {
        this._mlModuleGetter = new ModuleContentGetter(client)
    }

    async provideTextDocumentContent(uri: Uri): Promise<string> {
        return this._mlModuleGetter.provideTextDocumentContent(uri.path)
    }

    get onDidChange(): Event<Uri> { return this._onDidChange.event }

    public async cacheModule(uri: Uri): Promise<Uri> {
        const modulePath = uri.path
        return this._mlModuleGetter.cacheModule(modulePath).then(() => {
            return uri
        })
    }

    public async listModules(): Promise<string[]> {
        return this._mlModuleGetter.listModules()
    }
}
