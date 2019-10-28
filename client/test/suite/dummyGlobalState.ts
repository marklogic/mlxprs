'use strict'

import { Memento } from 'vscode'
import { MarklogicVSClient, MlClientParameters } from '../../marklogicClient'

/**
 *
 */
export class DummyGlobalState implements Memento {
    dummyClient: MarklogicVSClient;
    get<T>(key: string): T
    get<T>(key: string, defaultValue: T): T

    get(key: any, defaultValue?: any): MarklogicVSClient {
        return this.dummyClient
    }
    update(key: string, value: any): Thenable<void> {
        return new Promise(() => {
            this.dummyClient = value as MarklogicVSClient
        })
    }

    constructor(params: MlClientParameters) {
        this.dummyClient = new MarklogicVSClient(params)
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
