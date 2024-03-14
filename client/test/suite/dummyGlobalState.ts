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

import { Memento } from 'vscode';
import { ClientContext } from '../../marklogicClient';
import { ClientFactory } from '../../clientFactory';

/**
 *
 */
export class DummyGlobalState implements Memento {
    dummyClient: ClientContext;
    get<T>(key: string): T
    get<T>(key: string, defaultValue: T): T

    get(key: any, defaultValue?: any): ClientContext {
        return this.dummyClient;
    }
    update(key: string, value: any): Thenable<void> {
        return new Promise(() => {
            this.dummyClient = value as ClientContext;
        });
    }

    constructor(dummyClient: ClientContext) {
        this.dummyClient = dummyClient;
    }
    keys(): readonly string[] {
        throw new Error('Method not implemented.');
    }
}

export function defaultDummyGlobalState(): DummyGlobalState {
    const dbClient = new ClientFactory({
        host: 'nohost', port: 0, user: 'user', password: 'pwd',
        authType: 'BASIC', contentDb: 'DOCS', modulesDb: 'MODS',
        ssl: true, pathToCa: ''
    }).newMarklogicRestClient();
    dbClient.params.sameAs = function (): boolean {
        return false;
    };
    return new DummyGlobalState(dbClient);
}
