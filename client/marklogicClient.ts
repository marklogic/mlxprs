'use strict'

import * as ml from 'marklogic'
import * as fs from 'fs'
import { Memento, WorkspaceConfiguration } from 'vscode'

const MLDBCLIENT = 'mldbClient'

export class MarklogicVSClient {
    contentDb: string;
    modulesDb: string;

    host: string;
    port: number;
    user: string;
    pwd: string;
    authType: string;
    ssl: boolean;
    pathToCa: string;
    ca: string;

    docsDbNumber: string;
    mldbClient: ml.DatabaseClient;
    constructor(host: string, port: number,
        user: string, pwd: string, authType: string,
        contentDb: string, modulesDb: string,
        ssl: boolean, pathToCa: string) {
        this.contentDb = contentDb
        this.modulesDb = modulesDb
        this.host = host
        this.port = port
        this.user = user
        this.pwd = pwd
        this.authType = authType.toUpperCase()
        this.ssl = ssl
        this.pathToCa = pathToCa

        this.docsDbNumber = '0'
        if (pathToCa !== '') {
            try {
                this.ca = fs.readFileSync(this.pathToCa, 'utf8')
            } catch (e) {
                throw new Error('Error reading CA file: ' + e.message)
            }
        }
        if (authType !== 'DIGEST' && authType !== 'BASIC') {
            this.authType = 'DIGEST'
        }
        this.mldbClient = ml.createDatabaseClient({
            host: host, port: port, user: user, password: pwd,
            authType: authType, ssl: ssl, ca: this.ca
        })
        this.mldbClient.eval('xdmp.database("' + contentDb + '")')
            .result(null, null).then((response) => {
                this.docsDbNumber = response[0]['value']
            })
    }

    toString(): string {
        return [this.host, this.port, this.user,
            this.pwd, this.authType,
            this.contentDb, this.modulesDb,
            this.ssl, this.pathToCa].join(':')
    }

    compareTo(host: string, port: number, user: string,
        pwd: string, authType: string,
        contentDb: string, modulesDb: string,
        ssl: boolean, pathToCa: string): boolean {
        const newParams =
            [host, port, user, pwd, authType, contentDb, modulesDb, ssl, pathToCa].join(':')
        return (this.toString() === newParams)
    }
}

function buildNewClient(host: string, port: number, user: string,
    pwd: string, authType: string, contentDb: string,
    modulesDb: string, ssl: boolean, pathToCa: string): MarklogicVSClient {
    let newClient: MarklogicVSClient
    try {
        newClient = new MarklogicVSClient(host, port, user, pwd, authType, contentDb, modulesDb, ssl, pathToCa)
    } catch (e) {
        console.error('Error: ' + JSON.stringify(e))
        throw (e)
    }
    return newClient
};

/**
 * Caching mechanism for the ML Client in the extension's state. Checks the configuration for
 * changes against the client in the state (i.e. extension's global state)
 *
 * If the configuration wants a different client than the one in the state, replace the state's
 * client with a new one based on the config details.
 *
 * @param cfg ('config') most likely from `vscode.workspace.getConfiguration()`
 * @param state most likely the extension's injected `context.globalState`
 *
 * @returns a MarkLogicVSClient based on the contents of `cfg`
 */
export function getDbClient(cfg: WorkspaceConfiguration, state: Memento): MarklogicVSClient {
    const host = String(cfg.get('marklogic.host'))
    const user = String(cfg.get('marklogic.username'))
    const pwd = String(cfg.get('marklogic.password'))
    const port = Number(cfg.get('marklogic.port'))
    const contentDb = String(cfg.get('marklogic.documentsDb'))
    const modulesDb = String(cfg.get('marklogic.modulesDb'))
    const authType = String(cfg.get('marklogic.authType')).toUpperCase()
    const ssl = Boolean(cfg.get('marklogic.ssl'))
    const pathToCa = String(cfg.get('marklogic.pathToCa'))

    // if settings have changed, release and clear the client
    const mlc = state.get(MLDBCLIENT) as MarklogicVSClient
    if (mlc !== null && !mlc.compareTo(host, port, user, pwd, authType, contentDb, modulesDb, ssl, pathToCa)) {
        mlc.mldbClient.release()
        state.update(MLDBCLIENT, null)
        console.info('Cleared MarkLogicVSClient for new settings.')
    }

    // if there's no existing client in the globalState, instantiate a new one
    if (state.get(MLDBCLIENT) === null) {
        const newClient: MarklogicVSClient =
            buildNewClient(host, port, user, pwd, authType, contentDb, modulesDb, ssl, pathToCa)
        try {
            state.update(MLDBCLIENT, newClient)
            console.info('New MarkLogicVSClient: ' + state.get(MLDBCLIENT))
        } catch (e) {
            console.error('Error: ' + JSON.stringify(e))
            e.message ? console.error(e.message) : null
        }
    }
    return state.get(MLDBCLIENT) as MarklogicVSClient
}
