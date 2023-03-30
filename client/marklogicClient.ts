'use strict';

import * as ml from 'marklogic';
import * as fs from 'fs';
import { MlxprsStatus } from './mlxprsStatus';

export const MLDBCLIENT = 'mldbClient';
export const MLSETTINGSFLAG = /mlxprs:settings/;
export const XQY = 'xqy';

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
    rejectUnauthorized: boolean;
    /**
     * note: defaults not applied here. Properties can remain undefined so that
     *       per-query overrides don't clobber the existing config with default values.
     *       (using the spread operator in `getDbClient`)
     **/
    constructor(rawParams: Record<string, any>) {
        this.host = rawParams.host;
        this.port = Number(rawParams.port);
        this.user = rawParams.user;
        this.pwd = rawParams.pwd;
        this.contentDb = rawParams.contentDb || rawParams.documentsDb || '';
        this.modulesDb = rawParams.modulesDb || '';
        this.authType = rawParams.authType;
        this.ssl = Boolean(rawParams.ssl);
        this.pathToCa = rawParams.pathToCa || '';
        this.rejectUnauthorized = Boolean(rawParams.rejectUnauthorized);

        // This check was previously done in the MarklogicClient constructor, but doing so causes the sameAs
        // function in this class to not behave properly
        if (this.authType !== 'DIGEST' && this.authType !== 'BASIC') {
            this.authType = 'DIGEST';
        }
    }

    toString(): string {
        const paramsArray = [this.host, this.port, this.user, this.pwd.replace(/./g, '*'), this.authType, this.contentDb, this.modulesDb];
        if (this.ssl) {
            paramsArray.push('ssl');
            if (!this.rejectUnauthorized) paramsArray.push('insecure');
            if (this.pathToCa) paramsArray.push('pathToCa:' || this.pathToCa);
        } else {
            paramsArray.push('plaintext');
        }
        return paramsArray.join(':');
    }

    sameAs(other: MlClientParameters): boolean {
        return (
            this.host === other.host &&
            ((isNaN(this.port) && isNaN(other.port)) || this.port === other.port) &&
            this.contentDb === other.contentDb &&
            this.modulesDb === other.modulesDb &&
            this.user === other.user &&
            this.pwd === other.pwd &&
            this.authType === other.authType &&
            this.ssl === other.ssl &&
            this.pathToCa === other.pathToCa &&
            this.rejectUnauthorized === other.rejectUnauthorized
        );
    }
}

export class MarklogicClient {
    params: MlClientParameters;
    ca: string;

    mldbClient: ml.DatabaseClient;
    constructor(params: MlClientParameters) {
        this.params = params;
        this.params.authType = params.authType.toUpperCase();

        if (params.pathToCa !== '') {
            try {
                this.ca = fs.readFileSync(this.params.pathToCa, 'utf8');
            } catch (e) {
                throw new Error('Error reading CA file: ' + e.message);
            }
        }
        if (!this.params.contentDb) {
            this.params.contentDb = null;
        }
        this.mldbClient = ml.createDatabaseClient({
            host: this.params.host, port: this.params.port,
            user: this.params.user, password: this.params.pwd,
            database: this.params.contentDb,
            authType: this.params.authType, ssl: this.params.ssl,
            ca: this.ca, rejectUnauthorized: this.params.rejectUnauthorized
        });
    }

    toString(): string {
        return this.params.toString();
    }

    hasSameParamsAs(newParams: MlClientParameters): boolean {
        return this.params.sameAs(newParams);
    }


    async getConnectedServers(requestingObject: MlxprsStatus, updateCallback: (connectedServers: string[]) => void): Promise<void> {
        return this.mldbClient.xqueryEval('xquery version "1.0-ml"; dbg:connected()')
            .result(
                (items: ml.Item[]) => {
                    const connectedServers: string[] = [];
                    items.forEach((item) => {
                        connectedServers.push(item.value);
                    });
                    // requestingObject['updateStatusBarItem'](connectedServers);
                    // requestingObject[updateCallback](connectedServers);
                    updateCallback.call(requestingObject, connectedServers);
                },
                (err) => {
                    throw err;
                });
    }

}

export function buildNewClient(params: MlClientParameters): MarklogicClient {
    let newClient: MarklogicClient;
    try {
        newClient = new MarklogicClient(params);
    } catch (e) {
        console.error('Error: ' + JSON.stringify(e));
        throw (e);
    }
    return newClient;
}

export function parseXQueryForOverrides(queryText: string): Record<string, any> {
    let overrides: Record<string, any> = {};
    const firstContentLine: string = queryText.trim().split(/[\r\n]+/)[0];
    const startsWithComment: RegExpMatchArray = firstContentLine.match(/^\(:[\s\t]*/);
    const overridesFlagPresent: RegExpMatchArray = firstContentLine.match(MLSETTINGSFLAG);

    if (startsWithComment && overridesFlagPresent) {
        const overridePayload: string = queryText.trim()
            .match(/\(:.+:\)/sg)[0]       // take the first comment (greedy, multiline)
            .split(/:\)/)[0]              // end at the comment close (un-greedy the match)
            .replace(MLSETTINGSFLAG, '')  // get rid of the flag
            .replace(/^\(:/, '')          // get rid of the comment opener
            .trim();
        overrides = JSON.parse(overridePayload);
    }
    return overrides;
}


export function sendJSQuery(
    db: MarklogicClient,
    actualQuery: string,
    sqlQuery = '',
    sqlOptions = []): ml.ResultProvider<Record<string, any>> {
    const query = `
    const options = {};
    if (modulesDb) { options.modules = xdmp.database(modulesDb) };
    if (contentDb) { options.database = xdmp.database(contentDb) };
    xdmp.eval(actualQuery,
        {actualQuery: actualQuery, sqlQuery: sqlQuery, sqlOptions: sqlOptions},
        options
        );`;

    const extVars = {
        'actualQuery': actualQuery,
        'contentDb': db.params.contentDb,
        'modulesDb': db.params.modulesDb,
        'sqlQuery': sqlQuery,
        'sqlOptions': sqlOptions
    } as ml.Variables;

    return db.mldbClient.eval(query, extVars);
}


export function sendXQuery(
    db: MarklogicClient,
    actualQuery: string,
    prefix: 'xdmp' | 'dbg' = 'xdmp')
    : ml.ResultProvider<Record<string, any>> {
    const query =
        'xquery version "1.0-ml";' +
        'declare variable $actualQuery as xs:string external;' +
        'declare variable $contentDb as xs:string external;' +
        'declare variable $modulesDb as xs:string external;' +
        'let $options := ' +
        '<options xmlns="xdmp:eval">' +
        (db.params.contentDb ? '<database>{xdmp:database($contentDb)}</database>' : '') +
        (db.params.modulesDb ? '<modules>{xdmp:database($modulesDb)}</modules>' : '') +
        '</options>' +
        `return ${prefix}:eval($actualQuery, (), $options)`;
    const extVars = {
        'actualQuery': actualQuery,
        'contentDb': db.params.contentDb,
        'modulesDb': db.params.modulesDb
    } as ml.Variables;

    return db.mldbClient.xqueryEval(query, extVars);
}

export function sendSparql(db: MarklogicClient, sparqlQuery: string, contentType: ml.contentType = 'application/json'): ml.ResultProvider<Record<string, unknown>> {
    return db.mldbClient.graphs.sparql({
        contentType: contentType,
        query: sparqlQuery
    });
}


export function sendRows(db: MarklogicClient, actualQuery: string, resultFormat: ml.RowsResponseFormat): Promise<ml.RowsResponse> {
    if (actualQuery.startsWith('{')) {
        return sendRowsSerialized(db, actualQuery, resultFormat);
    } else {
        const queryOptions: ml.RowsOptions = { 'queryType': 'dsl', 'format': resultFormat };
        return db.mldbClient.rows.query(actualQuery, queryOptions);
    }
}

function sendRowsSerialized(db: MarklogicClient, actualQuery: string, resultFormat: ml.RowsResponseFormat): Promise<ml.RowsResponse> {
    let jsonQuery = null;
    let errObject = null;
    try {
        jsonQuery = JSON.parse(actualQuery);
    } catch (err) {
        errObject = err;
    }

    if (jsonQuery) {
        const queryOptions: ml.RowsOptions = { 'queryType': 'json', 'format': resultFormat };
        return db.mldbClient.rows.query(jsonQuery, queryOptions);
    } else {
        return Promise.resolve(
            {
                columns: [],
                rows: [],
                preRequestError: errObject.message
            }
        );
    }
}
