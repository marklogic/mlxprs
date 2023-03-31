'use strict';

import * as request from 'request-promise';
import * as ml from 'marklogic';
import * as fs from 'fs';
import { MlxprsStatus } from './mlxprsStatus';

export const MLDBCLIENT = 'mldbClient';
export const MLSETTINGSFLAG = /mlxprs:settings/;
export const XQY = 'xqy';

export interface ServerQueryResponse {
    name: string;
    id: string;
    port?: number;
}

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

export class ClientContext {
    public static DEFAULT_MANAGE_PORT = 8002;
    params: MlClientParameters;
    ca: string;

    databaseClient: ml.DatabaseClient;
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
        this.databaseClient = ml.createDatabaseClient({
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


    async getConnectedServers(requestingObject: MlxprsStatus, managePort: number, updateCallback: (connectedServers: string[]) => void): Promise<void> {
        const connectedJsServers: MlxprsQuickPickItem[] = await getFilteredListOfJsAppServers(this, managePort, 'true');
        return this.databaseClient.xqueryEval('xquery version "1.0-ml"; dbg:connected()')
            .result(
                async (items: ml.Item[]) => {
                    const connectedServers: string[] = [];
                    const requests = [];
                    items.forEach(async (item) => {
                        requests.push(
                            sendXQuery(this, `xdmp:server-name(${item.value})`)
                                .result(
                                    (result: ml.Item[]) => {
                                        connectedServers.push('XQY:' + result[0].value);
                                    },
                                    err => {
                                        return [];
                                    })
                        );
                    });
                    await Promise.all(requests);

                    connectedJsServers.forEach((quickPickItem) => {
                        connectedServers.push('JS:' + quickPickItem.label);
                    });
                    updateCallback.call(requestingObject, connectedServers);
                },
                (err) => {
                    throw err;
                }
            );
    }

    public listServersForDisconnectQuery = `
    let $connected-app-servers := dbg:connected()
    let $json-servers := $connected-app-servers ! (map:new()
      => map:with("id", .)
      => map:with("name", xdmp:server-name(.))
      => map:with("port", xdmp:server-port(.)))
    => xdmp:to-json()
    return $json-servers
    `;

    public buildListServersForConnectQuery() {
        return `
let $all-app-servers := xdmp:servers()
let $connected-app-servers := dbg:connected()
let $not-connected-app-servers :=
  for $app-server in $all-app-servers
  return
    if ($app-server = $connected-app-servers) then
      ()
    else
      if (xdmp:server-name($app-server) = ('Admin', 'Manage', 'HealthCheck', 'App-Services')) then
        ()
      else
        if (xdmp:server-port($app-server) = ${this.params.port}) then
            ()
        else
            $app-server
let $json-servers := $not-connected-app-servers ! (map:new()
  => map:with("id", .)
  => map:with("name", xdmp:server-name(.))
  => map:with("port", xdmp:server-port(.)))
=> xdmp:to-json()
return $json-servers
`;
    }

    public buildAppServerChoicesFromServerList(appServers: Record<string, ServerQueryResponse>) {
        const servers: ServerQueryResponse[] = [].concat(appServers[0]['value'] || []);
        return servers
            .map((server: ServerQueryResponse) => {
                return {
                    label: server.name,
                    description: server.id,
                    detail: `${server.name} on ${this.params.host}:${server.port || '(none)'}`,
                } as any;
            });
    }

    public static buildUrl(hostname: string, endpointPath: string, ssl = true, managePort = ClientContext.DEFAULT_MANAGE_PORT): string {
        const scheme: string = ssl ? 'https' : 'http';
        const url = `${scheme}://${hostname}:${managePort}${endpointPath}`;
        return url;
    }

}

export function buildNewClient(params: MlClientParameters): ClientContext {
    let dbClientContext: ClientContext;
    try {
        dbClientContext = new ClientContext(params);
    } catch (e) {
        console.error('Error: ' + JSON.stringify(e));
        throw (e);
    }
    return dbClientContext;
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
    dbClientContext: ClientContext,
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
        'contentDb': dbClientContext.params.contentDb,
        'modulesDb': dbClientContext.params.modulesDb,
        'sqlQuery': sqlQuery,
        'sqlOptions': sqlOptions
    } as ml.Variables;

    return dbClientContext.databaseClient.eval(query, extVars);
}


export function sendXQuery(
    dbClientContext: ClientContext,
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
        (dbClientContext.params.contentDb ? '<database>{xdmp:database($contentDb)}</database>' : '') +
        (dbClientContext.params.modulesDb ? '<modules>{xdmp:database($modulesDb)}</modules>' : '') +
        '</options>' +
        `return ${prefix}:eval($actualQuery, (), $options)`;
    const extVars = {
        'actualQuery': actualQuery,
        'contentDb': dbClientContext.params.contentDb,
        'modulesDb': dbClientContext.params.modulesDb
    } as ml.Variables;

    return dbClientContext.databaseClient.xqueryEval(query, extVars);
}

export function sendSparql(dbClientContext: ClientContext, sparqlQuery: string, contentType: ml.contentType = 'application/json'): ml.ResultProvider<Record<string, unknown>> {
    return dbClientContext.databaseClient.graphs.sparql({
        contentType: contentType,
        query: sparqlQuery
    });
}


export function sendRows(dbClientContext: ClientContext, actualQuery: string, resultFormat: ml.RowsResponseFormat): Promise<ml.RowsResponse> {
    if (actualQuery.startsWith('{')) {
        return sendRowsSerialized(dbClientContext, actualQuery, resultFormat);
    } else {
        const queryOptions: ml.RowsOptions = { 'queryType': 'dsl', 'format': resultFormat };
        return dbClientContext.databaseClient.rows.query(actualQuery, queryOptions);
    }
}

function sendRowsSerialized(dbClientContext: ClientContext, actualQuery: string, resultFormat: ml.RowsResponseFormat): Promise<ml.RowsResponse> {
    let jsonQuery = null;
    let errObject = null;
    try {
        jsonQuery = JSON.parse(actualQuery);
    } catch (err) {
        errObject = err;
    }

    if (jsonQuery) {
        const queryOptions: ml.RowsOptions = { 'queryType': 'json', 'format': resultFormat };
        return dbClientContext.databaseClient.rows.query(jsonQuery, queryOptions);
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

export interface MlxprsQuickPickItem {
    label: string;
    description: string;
    detail: string;
}

export async function getFilteredListOfJsAppServers(
    dbClientContext: ClientContext, managePort: number, requiredResponse: string
): Promise<MlxprsQuickPickItem[]> {
    const listServersForConnectQuery = dbClientContext.buildListServersForConnectQuery();
    const allPossibleJsServers: MlxprsQuickPickItem[] = await getAppServerListForJs(dbClientContext, listServersForConnectQuery) as MlxprsQuickPickItem[];
    return await filterJsServerByConnectedStatus(dbClientContext, managePort, allPossibleJsServers, requiredResponse);
}

export async function getAppServerListForJs(dbClientContext: ClientContext, serverListQuery: string): Promise<MlxprsQuickPickItem[]> {
    return sendXQuery(dbClientContext, serverListQuery)
        .result(
            (appServers: Record<string, ServerQueryResponse>) => {
                return dbClientContext.buildAppServerChoicesFromServerList(appServers);
            },
            err => {
                return [];
            });
}

export async function filterJsServerByConnectedStatus(
    dbClientContext: ClientContext, managePort: number, choices: MlxprsQuickPickItem[], requiredResponse: string
): Promise<MlxprsQuickPickItem[]> {
    const requests = [];
    const filteredChoices: MlxprsQuickPickItem[] = [];
    choices.forEach(async (choice) => {
        const url = ClientContext.buildUrl(dbClientContext.params.host, `/jsdbg/v1/connected/${choice.label}`, dbClientContext.params.ssl, managePort);
        const options = {
            headers: {
                'Content-type': 'application/x-www-form-urlencoded',
                'X-Error-Accept': 'application/json'
            },
            auth: {
                user: dbClientContext.params.user,
                pass: dbClientContext.params.pwd,
                'sendImmediately': false
            }
        };
        if (dbClientContext.params.pathToCa !== '') {
            options['agentOptions'] = { ca: fs.readFileSync(dbClientContext.params.pathToCa) };
        }
        options['rejectUnauthorized'] = dbClientContext.params.rejectUnauthorized;
        const connectedRequest = request.get(url, options)
            .then((response) => {
                if (response === requiredResponse) {
                    filteredChoices.push(choice);
                }
            }).catch(err => {
                console.debug(`"Connected" request failed: ${err}`);
            });
        requests.push(connectedRequest);
    });
    await Promise.all(requests);
    return filteredChoices;
}
