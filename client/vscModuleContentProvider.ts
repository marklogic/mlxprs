'use strict';

import {
    Event, EventEmitter, TextDocument, TextDocumentContentProvider, Uri,
    window, workspace
} from 'vscode';
import { ClientContext } from './marklogicClient';
import { ModuleContentGetter } from './moduleContentGetter';

const scheme = 'mlmodule';

function encodeLocation(host: string, port: number, path: string): Uri {
    const newUri = Uri.parse(`${scheme}://${host}:${port}${path}`);
    return newUri;
}


export class ModuleContentProvider implements TextDocumentContentProvider {
    static scheme = scheme;
    private _onDidChange = new EventEmitter<Uri>();
    private _mlModuleGetter: ModuleContentGetter;

    public initialize(client: ClientContext): void {
        this._mlModuleGetter = new ModuleContentGetter(client);
    }

    async provideTextDocumentContent(uri: Uri): Promise<string> {
        return this._mlModuleGetter.provideTextDocumentContent(uri.path);
    }

    get onDidChange(): Event<Uri> {
        return this._onDidChange.event;
    }

    public async listModules(): Promise<string[]> {
        return this._mlModuleGetter.listModules();
    }
}

export async function pickAndShowModule(mprovider: ModuleContentProvider, client: ClientContext): Promise<void> {
    mprovider.initialize(client);
    mprovider.listModules()
        .then((moduleUris: string[]) => {
            return window.showQuickPick(moduleUris);
        })
        .then((URIstring: string) => {
            const uri: Uri = encodeLocation(client.params.host, client.params.port, URIstring);
            return uri;
        })
        .then((uri: Uri) => {
            return workspace.openTextDocument(uri);
        })
        .then((doc: TextDocument) => {
            window.showTextDocument(doc);
        });
}
