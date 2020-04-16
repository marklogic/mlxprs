'use strict'

import { Memento } from 'vscode'
import { MarklogicClient, MlClientParameters } from '../../marklogicClient'

/**
 *
 */
export class DummyGlobalState implements Memento {
    dummyClient: MarklogicClient;
    get<T>(key: string): T
    get<T>(key: string, defaultValue: T): T

    get(key: any, defaultValue?: any): MarklogicClient {
        return this.dummyClient
    }
    update(key: string, value: any): Thenable<void> {
        return new Promise(() => {
            this.dummyClient = value as MarklogicClient
        })
    }

    constructor(params: MlClientParameters) {
        this.dummyClient = new MarklogicClient(params)
    }
}

export function defaultDummyGlobalState(): DummyGlobalState {
    return new DummyGlobalState(
        new MlClientParameters({
            host: 'nohost', port: 0, user: 'user', pwd: 'pwd',
            authType: 'BASIC', contentDb: 'DOCS', modulesDb: 'MODS',
            ssl: true, pathToCa: ''
        })
    )
}
