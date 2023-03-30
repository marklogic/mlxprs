'use strict';

import { Memento } from 'vscode';
import { ClientContext, MlClientParameters } from '../../marklogicClient';

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

    constructor(params: MlClientParameters) {
        this.dummyClient = new ClientContext(params);
    }
    keys(): readonly string[] {
        throw new Error('Method not implemented.');
    }
}

export function defaultDummyGlobalState(): DummyGlobalState {
    return new DummyGlobalState(
        new MlClientParameters({
            host: 'nohost', port: 0, user: 'user', pwd: 'pwd',
            authType: 'BASIC', contentDb: 'DOCS', modulesDb: 'MODS',
            ssl: true, pathToCa: ''
        })
    );
}
