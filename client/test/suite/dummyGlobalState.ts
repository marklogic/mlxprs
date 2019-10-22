'use strict'

import { Memento } from 'vscode'
import { MarklogicVSClient } from '../../marklogicClient'

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

    constructor(host: string, port: number, user: string, pwd: string, authType: string,
        contentDb: string, modulesDb: string, ssl: boolean, pathToCa: string) {

        this.dummyClient = new MarklogicVSClient(
            host, port, user, pwd, authType, contentDb, modulesDb, ssl, pathToCa)
    }
}

export function defaultDummyGlobalState(): DummyGlobalState {
    return new DummyGlobalState(
        'nohost', 0, 'user', 'pwd', 'BASIC', 'DOCS', 'MODS', true, '')
}
