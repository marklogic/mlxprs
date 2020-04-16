'use strict'

import * as ml from 'marklogic'
import * as fs from 'fs'
import * as esprima from 'esprima'
import { Memento, WorkspaceConfiguration, window } from 'vscode'

const MLDBCLIENT = 'mldbClient'
const MLSETTINGSFLAG = /mlxprs:settings/
const SJS = 'sjs'
const XQY = 'xqy'

export class MlClientParameters {
    contentDb: string;
    modulesDb: string;

    host: string;
    port: number;
    user: string;
    pwd: string;
    authType: string;
    ssl: boolean;
    pathToCa: string;

    /**
     * note: defaults not applied here. Properties can remain undefined so that
     *       per-query overrides don't clobber the existing config with default values.
     *       (using the spread operator in `getDbClient`)
     **/
    constructor(rawParams: Record<string, any>) {
        this.host = rawParams.host
        this.port = Number(rawParams.port)
        this.user = rawParams.user
        this.pwd = rawParams.pwd
        this.contentDb = rawParams.contentDb || rawParams.documentsDb
        this.modulesDb = rawParams.modulesDb
        this.authType = rawParams.authType
        this.ssl = Boolean(rawParams.ssl)
        this.pathToCa = rawParams.pathToCa
    }

    toString(): string {
        return [this.host, this.port, this.user,
            this.pwd.replace(/./g, '*'),
            this.authType,
            this.contentDb, this.modulesDb,
            this.ssl, this.pathToCa].join(':')
    }

    sameAs(other: MlClientParameters): boolean {
        return (
            this.host === other.host &&
            this.port === other.port &&
            this.contentDb === other.contentDb &&
            this.modulesDb === other.modulesDb &&
            this.user === other.user &&
            this.pwd === other.pwd &&
            this.authType === other.authType &&
            this.ssl === other.ssl &&
            this.pathToCa === other.pathToCa
        )
    }
}

export class MarklogicVSClient {
    params: MlClientParameters;
    ca: string;

    mldbClient: ml.DatabaseClient;
    constructor(params: MlClientParameters) {
        this.params = params
        this.params.authType = params.authType.toUpperCase()

        if (params.pathToCa !== '') {
            try {
                this.ca = fs.readFileSync(this.params.pathToCa, 'utf8')
            } catch (e) {
                throw new Error('Error reading CA file: ' + e.message)
            }
        }
        if (this.params.authType !== 'DIGEST' && this.params.authType !== 'BASIC') {
            this.params.authType = 'DIGEST'
        }
        this.mldbClient = ml.createDatabaseClient({
            host: this.params.host, port: this.params.port,
            user: this.params.user, password: this.params.pwd,
            authType: this.params.authType, ssl: this.params.ssl,
            ca: this.ca
        })
    }

    toString(): string {
        return this.params.toString()
    }

    hasSameParamsAs(newParams: MlClientParameters): boolean {
        return this.params.sameAs(newParams)
    }
}

function buildNewClient(params: MlClientParameters): MarklogicVSClient {
    let newClient: MarklogicVSClient
    try {
        newClient = new MarklogicVSClient(params)
    } catch (e) {
        console.error('Error: ' + JSON.stringify(e))
        throw (e)
    }
    return newClient
}

function parseXQueryForOverrides(queryText: string): Record<string, any> {
    let overrides: Record<string, any> = {}
    const firstContentLine: string = queryText.trim().split(/[\r\n]+/)[0]
    const startsWithComment: RegExpMatchArray = firstContentLine.match(/^\(:[\s\t]*/)
    const overridesFlagPresent: RegExpMatchArray = firstContentLine.match(MLSETTINGSFLAG)

    if (startsWithComment && overridesFlagPresent) {
        const overridePayload: string = queryText.trim()
            .match(/\(:.+:\)/sg)[0]       // take the first comment (greedy, multiline)
            .split(/:\)/)[0]              // end at the comment close (un-greedy the match)
            .replace(MLSETTINGSFLAG, '')  // get rid of the flag
            .replace(/^\(:/, '')          // get rid of the comment opener
            .trim()
        overrides = JSON.parse(overridePayload)
    }
    return overrides
}

/**
 * In SJS/XQuery queries, you can override the VS Code mxprs settings in a comment.
 * The comment must have the following requirements:
 *
 * - Block comment as the very first language element in the query
 * - the first line of the block comment must include the string 'mlxprs:settings'
 * - the rest of the comment must be a valid JSON object
 * - the keys of the JSON object are the client parameters you wish to override
 *
 * @param queryText the text that will be checked for overrides
 * @returns a parsed overrides object. Value defined here will be used to override
 * what is configured in VS Code
 */
export function parseQueryForOverrides(queryText: string, language: string): Record<string, any> {
    if (language === XQY) {
        return parseXQueryForOverrides(queryText)
    }
    let overrides: Record<string, any> = {}
    const tokens: esprima.Token[] = esprima.tokenize(queryText, {comment: true, tolerant: true})
    if (tokens.length > 0 && tokens[0].type === 'BlockComment') {
        const firstBlockComment: string = tokens[0].value
        const firstBlockCommentLine: string =
            firstBlockComment.split(/\n+/)[0]
                .replace(/\t+/g, '')
                .trim()
        if (firstBlockCommentLine.match(MLSETTINGSFLAG)) {
            const overridePayload: string = firstBlockComment
                .replace(MLSETTINGSFLAG, '')
                .trim()
            overrides = JSON.parse(overridePayload)
        }
    }
    return overrides
}

/**
 * Caching mechanism for the ML Client in the extension's state. Checks the configuration for
 * changes against the client in the state (i.e. extension's global state)
 *
 * If the configuration wants a different client than the one in the state, replace the state's
 * client with a new one based on the config details.
 *
 * @param cfg ('config') most likely from `vscode.workspace.getConfiguration()`
 * @param language: string SJS or XQY
 * @param state most likely the extension's injected `context.globalState`
 *
 * @returns a MarkLogicVSClient based on the contents of `cfg`
 */
export function getDbClient(queryText: string, language: string, cfg: WorkspaceConfiguration, state: Memento): MarklogicVSClient {
    const overrides: MlClientParameters = parseQueryForOverrides(queryText, language) as MlClientParameters

    const configParams: Record<string, any> = {
        host: String(cfg.get('marklogic.host')),
        user: String(cfg.get('marklogic.username')),
        pwd: String(cfg.get('marklogic.password')),
        port: Number(cfg.get('marklogic.port')),
        contentDb: String(cfg.get('marklogic.documentsDb')),
        modulesDb: String(cfg.get('marklogic.modulesDb')),
        authType: String(cfg.get('marklogic.authType')).toUpperCase(),
        ssl: Boolean(cfg.get('marklogic.ssl')),
        pathToCa: String(cfg.get('marklogic.pathToCa'))
    }

    // merge VS Code configuration and overrides
    const newParams = new MlClientParameters({...configParams, ...overrides})

    // if settings have changed, release and clear the client
    const mlc = state.get(MLDBCLIENT) as MarklogicVSClient
    if (mlc !== null && !mlc.hasSameParamsAs(newParams)) {
        mlc.mldbClient.release()
        state.update(MLDBCLIENT, null)
        console.debug('Cleared MarkLogicVSClient for new settings.')
    }

    // if there's no existing client in the globalState, instantiate a new one
    if (state.get(MLDBCLIENT) === null) {
        const newClient: MarklogicVSClient =
            buildNewClient(newParams)
        try {
            state.update(MLDBCLIENT, newClient)
            console.debug('New MarkLogicVSClient: ' + state.get(MLDBCLIENT))
        } catch (e) {
            console.error('Error: ' + JSON.stringify(e))
            e.message ? console.error(e.message) : null
        }
    }
    return state.get(MLDBCLIENT) as MarklogicVSClient
}

/**
 * Try to call `getDbClient()` with overrides. If we can't parse the
 * overrides, call `getDbClient()` with no overrides, and show the
 * user an error.
 */
export function cascadeOverrideClient(
    actualQuery: string,
    language: string,
    cfg: WorkspaceConfiguration,
    state: Memento): MarklogicVSClient
{
    let client: MarklogicVSClient = {} as MarklogicVSClient
    try {
        client = getDbClient(actualQuery, language, cfg, state)
    } catch (error) {
        window.showErrorMessage('could not parse JSON for overrides: ' + error.message)
        client = getDbClient('', language, cfg, state)
    }
    return client
}
