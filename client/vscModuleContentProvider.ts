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

    public initialize(dbClientContext: ClientContext): void {
        this._mlModuleGetter = new ModuleContentGetter(dbClientContext);
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

export async function pickAndShowModule(mprovider: ModuleContentProvider, dbClientContext: ClientContext): Promise<void> {
    mprovider.initialize(dbClientContext);
    mprovider.listModules()
        .then((moduleUris: string[]) => {
            return window.showQuickPick(moduleUris);
        })
        .then((URIstring: string) => {
            const uri: Uri = encodeLocation(dbClientContext.params.host, dbClientContext.params.port, URIstring);
            return uri;
        })
        .then((uri: Uri) => {
            return workspace.openTextDocument(uri);
        })
        .then((doc: TextDocument) => {
            window.showTextDocument(doc);
        });
}
