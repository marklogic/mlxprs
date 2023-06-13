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

import { EventEmitter } from 'events';
import * as fs from 'fs';
import * as ml from 'marklogic';

import { ClientContext, MlClientParameters } from '../marklogicClient';
import { ModuleContentGetter } from '../moduleContentGetter';

const DEFAULT_MANAGE_PORT = 8002;

/**Interfaces defined for Debugger Response*/

export interface V8Frame {
    callFrameId: string;
    functionName?: string;
    functionLocation?: Record<string, unknown>;
    location: {
        scriptId: string;
        lineNumber: number;
        columnNumber: number;
    };
    url: string;
    scopeChain: ScopeObject[];
    this: V8PropertyValue;
}

export interface ScopeObject {
    type: string;
    object: V8PropertyValue;
}

export interface V8PropertyObject {
    name: string;
    value: V8PropertyValue;
    writable?: boolean;
    configurable?: boolean;
    enumerable?: boolean;
    isOwn?: boolean;
}

export interface V8PropertyValue {
    type: string;
    value?;
    classname?: string;
    description?: string;
    objectId?: string;
}

export interface MLbreakPoint {
    url: string;
    line: number;
    column?: number;
    condition?: string;
}

export class MLRuntime extends EventEmitter {
    //Config
    private _hostName = '';
    // private _serverName;
    private _username = '';
    private _password = '';
    private _rid = '';
    private _timeout = 1;
    private _ssl = false;
    private _scheme = '';
    private _dbgPort = DEFAULT_MANAGE_PORT;
    private _endpointRoot = '/jsdbg/v1';
    private _ca: undefined | Buffer;
    private _rejectUnauthorized = true;
    private dbClientContext: ClientContext;
    private _mlModuleGetter: ModuleContentGetter;
    private managePort = null;

    public getHostString(): string {
        return `${this.dbClientContext.params.host}:${this.dbClientContext.params.port}`;
    }

    //Internal
    private _runTimeState: 'shutdown' | 'launched' | 'attached' | 'error' = 'shutdown';

    private buildUrl(uriPath: string): string {
        const url = `${this._scheme}://${this._hostName}:${this._dbgPort}${this._endpointRoot}${uriPath}`;
        return url;
    }

    constructor() {
        super();
    }

    public getRunTimeState(): 'shutdown' | 'launched' | 'attached' | 'error' {
        return this._runTimeState;
    }

    public setRunTimeState(state: 'shutdown' | 'launched' | 'attached'): void {
        this._runTimeState = state;
    }

    public launchWithDebugEval(queryText: string, database: string, txnId: string, modules: string, root: string): Promise<string> {
        return this._sendMLdebugEvalRequest(queryText, database, txnId, modules, root);
    }

    public initialize(args): void {
        //placeholder for now
        this._hostName = args.hostname;
        this._username = args.username;
        this._password = args.password;
        this._dbgPort = args.managePort;
        this.managePort = args.managePort;
        this._ssl = args.ssl;
        this._scheme = this._ssl ? 'https' : 'http';
        this._rejectUnauthorized = args.rejectUnauthorized;
        if (args.pathToCa) {
            this._ca = fs.readFileSync(args.pathToCa);
        }

        this.dbClientContext = new ClientContext(
            new MlClientParameters({
                host: this._hostName,
                port: this._dbgPort,
                user: this._username,
                pwd: this._password,
                contentDb: args.database,
                ssl: this._ssl,
                authType: args.authType,
                modulesDb: args.modules,
                pathToCa: args.pathToCa ? args.pathToCa : '',
                rejectUnauthorized: args.rejectUnauthorized
            })
        );
        this._mlModuleGetter = new ModuleContentGetter(this.dbClientContext);
    }

    public setRid(rid: string): void {
        this._rid = rid;
    }

    public getRid(): string {
        return this._rid;
    }

    // Added for testing purposes
    public getDbgPort(): number {
        return this._dbgPort;
    }

    public pause(): Promise<string> {
        return this._sendMLdebugRequestPOST('pause');
    }

    public resume(): Promise<string> {
        return this._sendMLdebugRequestPOST('resume');
    }
    public stepOver(): Promise<string> {
        return this._sendMLdebugRequestPOST('step-over');
    }
    public stepInto(): Promise<string> {
        return this._sendMLdebugRequestPOST('step-into');
    }
    public stepOut(): Promise<string> {
        return this._sendMLdebugRequestPOST('step-out');
    }

    public getStackTrace(): Promise<string> {
        return this._sendMLdebugRequestGET('stack-trace');
    }

    public setBreakPoint(location: MLbreakPoint): Promise<string> {
        let body = `url=${location.url}&lno=${location.line}`;
        if (location.column) {
            body = body.concat(`&cno=${location.column}`);
        }
        if (location.condition) {
            body = body.concat(`&condition=${location.condition}`);
        }
        return this._sendMLdebugRequestPOST('set-breakpoint', body);
    }

    public removeBreakPoint(location: MLbreakPoint): Promise<string> {
        let body = `url=${location.url}&lno=${location.line}`;
        if (location.column) {
            body = body.concat(`&cno=${location.column}`);
        }
        return this._sendMLdebugRequestPOST('remove-breakpoint', body);
    }

    public wait(): Promise<string> {
        const body = 'time-out=5';
        return this._sendMLdebugRequestPOST('wait', body);
    }

    public evaluateOnCallFrame(expr: string, cid?: string): Promise<string> {
        const qs: Record<string, unknown> = { expr: expr };
        if (cid !== '') {
            qs['call-frame'] = cid;
        }
        return this._sendMLdebugRequestGET('eval-on-call-frame', qs);
    }

    public getProperties(objectId: string): Promise<string> {
        const queryString = {
            'object-id': objectId
        };
        return this._sendMLdebugRequestGET('properties', queryString);
    }

    public disable(): Promise<string> {
        return this._sendMLdebugRequestPOST('disable');
    }

    public terminate(): Promise<string> {
        const data = 'server-name=TaskServer';
        return this._sendMLdebugRequestPOST('request-cancel', data);
    }

    public async waitTillPaused(): Promise<string> {
        try {
            const result = await this.wait();
            if (result === '') {
                return this.waitTillPaused();
            } else {
                return result;
            }
        } catch (e) {
            throw e;
        }
    }

    public async getModuleContent(modulePath: string): Promise<string> {
        return this._mlModuleGetter.provideTextDocumentContent(modulePath);
    }

    //---- helpers

    private newMarklogicManageClient(): ClientContext {
        const manageClientParams: MlClientParameters = JSON.parse(JSON.stringify(this.dbClientContext.params));
        manageClientParams.port = this.managePort;
        manageClientParams.contentDb = null;
        manageClientParams.modulesDb = null;
        return new ClientContext(manageClientParams);
    }

    private _sendMLdebugRequestPOST(module: string, body?: string): Promise<string> {
        const manageClient = this.newMarklogicManageClient();

        return new Promise((resolve, reject) => {
            manageClient.databaseClient.internal.sendRequest(
                `/jsdbg/v1/${module}/${this._rid}`,
                (requestOptions: ml.RequestOptions) => {
                    requestOptions.method = 'POST';
                    requestOptions.headers = { 'X-Error-Accept': 'application/json' };
                },
                (operation: ml.RequestOperation) => {
                    operation.requestBody = body;
                })
                .result((result: object) => {
                    let response = '';
                    if (result) {
                        response = JSON.stringify(result);
                    }
                    resolve(response);
                })
                .catch(error => {
                    reject(error.body.errorResponse);
                });
        });
    }

    private _sendMLdebugRequestGET(module: string, queryStringObject?: Record<string, unknown>): Promise<string> {
        const manageClient = this.newMarklogicManageClient();

        let endpoint = `/jsdbg/v1/${module}/${this._rid}`;
        const urlParameters = new global.URLSearchParams(queryStringObject);
        if (urlParameters.toString().length > 0) {
            endpoint = `${endpoint}?${urlParameters.toString()}`;
        }

        return new Promise((resolve, reject) => {
            return manageClient.databaseClient.internal.sendRequest(
                endpoint,
                (requestOptions: ml.RequestOptions) => {
                    requestOptions.method = 'GET';
                    requestOptions.headers = { 'X-Error-Accept': 'application/json' };
                })
                .result((result: object) => {
                    resolve(JSON.stringify(result));
                })
                .catch(error => {
                    reject(error.body.errorResponse);
                });
        });
    }

    private _sendMLdebugEvalRequest(
        script: string, database: string, txnId: string, modules: string, root: string
    ): Promise<string> {
        const manageClient = this.newMarklogicManageClient();

        const evalOptions = {};
        if (database) evalOptions['database'] = database;
        if (modules) evalOptions['modules'] = modules;
        if (txnId) evalOptions['txnId'] = txnId;
        if (root) evalOptions['root'] = root;
        const urlParameters = new global.URLSearchParams(evalOptions);
        let endpoint = '/jsdbg/v1/eval';
        if (urlParameters.toString().length > 0) {
            endpoint = `${endpoint}?${urlParameters.toString()}`;
        }

        return new Promise((resolve, reject) => {
            manageClient.databaseClient.internal.sendRequest(
                endpoint,
                (requestOptions: ml.RequestOptions) => {
                    requestOptions.method = 'POST';
                    requestOptions.headers = {
                        'Content-type': 'application/x-www-form-urlencoded',
                        'X-Error-Accept': 'application/json'
                    };
                },
                (operation: ml.RequestOperation) => {
                    operation.requestBody = `javascript=${encodeURIComponent(script)}`;
                })
                .result((result: object) => {
                    let response = '';
                    if (result) {
                        response = JSON.stringify(result);
                    }
                    resolve(response);
                })
                .catch(error => {
                    reject(error);
                });
        });
    }
}
