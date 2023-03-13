/*
 * Copyright (c) 2020 MarkLogic Corporation
 */

import { EventEmitter } from 'events'
import { MarklogicClient, MlClientParameters } from '../marklogicClient'
import { ModuleContentGetter } from '../moduleContentGetter'
import * as request from 'request-promise'
import * as fs from 'fs'
import * as querystring from 'querystring'

const DEFAULT_MANAGE_PORT = 8002

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
    private _mlClient: MarklogicClient;
    private _mlModuleGetter: ModuleContentGetter;

    public getHostString(): string {
        return `${this._mlClient.params.host}:${this._mlClient.params.port}`
    }

    //Internal
    private _runTimeState: 'shutdown' | 'launched' | 'attached' | 'error' = 'shutdown';

    private buildUrl(uriPath: string): string {
        const url = `${this._scheme}://${this._hostName}:${this._dbgPort}${this._endpointRoot}${uriPath}`
        return url
    }

    constructor() {
        super()
    }

    public getRunTimeState(): 'shutdown' | 'launched' | 'attached' | 'error' {
        return this._runTimeState
    }

    public setRunTimeState(state: 'shutdown' | 'launched' | 'attached'): void {
        this._runTimeState = state
    }

    public launchWithDebugEval(queryText: string, database: string, txnId: string, modules: string, root: string): Promise<string> {
        return this._sendMLdebugEvalRequest(queryText, database, txnId, modules, root)
    }

    public initialize(args): void {
        //placeholder for now
        this._hostName = args.hostname
        this._username = args.username
        this._password = args.password
        this._dbgPort = args.managePort
        this._ssl = args.ssl
        this._scheme = this._ssl ? 'https' : 'http'
        this._rejectUnauthorized = args.rejectUnauthorized
        if (args.pathToCa) {
            this._ca = fs.readFileSync(args.pathToCa)
        }

        this._mlClient = new MarklogicClient(
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
        )
        this._mlModuleGetter = new ModuleContentGetter(this._mlClient)
    }

    public setRid(rid: string): void {
        this._rid = rid
    }

    public getRid(): string {
        return this._rid
    }

    // Added for testing purposes
    public getDbgPort(): number {
        return this._dbgPort
    }

    public pause(): Promise<string> {
        return this._sendMLdebugRequestPOST('pause')
    }

    public resume(): Promise<string> {
        return this._sendMLdebugRequestPOST('resume')
    }
    public stepOver(): Promise<string> {
        return this._sendMLdebugRequestPOST('step-over')
    }
    public stepInto(): Promise<string> {
        return this._sendMLdebugRequestPOST('step-into')
    }
    public stepOut(): Promise<string> {
        return this._sendMLdebugRequestPOST('step-out')
    }

    public getStackTrace(): Promise<string> {
        return this._sendMLdebugRequestGET('stack-trace')
    }

    public setBreakPoint(location: MLbreakPoint): Promise<string> {
        let body = `url=${location.url}&lno=${location.line}`
        if (location.column) {
            body = body.concat(`&cno=${location.column}`)
        }
        if (location.condition) {
            body = body.concat(`&condition=${location.condition}`)
        }
        return this._sendMLdebugRequestPOST('set-breakpoint', body)
    }

    public removeBreakPoint(location: MLbreakPoint): Promise<string> {
        let body = `url=${location.url}&lno=${location.line}`
        if (location.column) {
            body = body.concat(`&cno=${location.column}`)
        }
        return this._sendMLdebugRequestPOST('remove-breakpoint', body)
    }

    public wait(): Promise<string> {
        const body = 'time-out=5'
        return this._sendMLdebugRequestPOST('wait', body)
    }

    public evaluateOnCallFrame(expr: string, cid?: string): Promise<string> {
        const qs: Record<string, unknown> = { expr: expr }
        if (cid !== '') { qs['call-frame'] = cid }
        return this._sendMLdebugRequestGET('eval-on-call-frame', qs)
    }

    public getProperties(objectId: string): Promise<string> {
        const queryString = {
            'object-id': objectId
        }
        return this._sendMLdebugRequestGET('properties', queryString)
    }

    public disable(): Promise<string> {
        return this._sendMLdebugRequestPOST('disable')
    }

    public terminate(): Promise<string> {
        const data = 'server-name=TaskServer'
        return this._sendMLdebugRequestPOST('request-cancel', data)
    }

    public async waitTillPaused(): Promise<string> {
        try {
            const result = await this.wait()
            if (result === '') { return this.waitTillPaused() }
            else { return result }
        } catch (e) {
            throw e
        }
    }

    public async getModuleContent(modulePath: string): Promise<string> {
        return this._mlModuleGetter.provideTextDocumentContent(modulePath)
    }

    //---- helpers

    private _sendMLdebugRequestPOST(module: string, body?: string): Promise<string> {
        const url = this.buildUrl(`/${module}/${this._rid}`)
        const options: Record<string, unknown> = {
            headers: {
                'Content-type': 'application/x-www-form-urlencoded',
                'X-Error-Accept': 'application/json'
            },
            auth: {
                user: this._username,
                pass: this._password,
                'sendImmediately': false
            }
        }
        if (body) { options['body'] = body }
        if (this._ca) options['agentOptions'] = { ca: this._ca }
        options['rejectUnauthorized'] = this._rejectUnauthorized
        return request.post(url, options)
    }

    private _sendMLdebugRequestGET(module: string, queryString?: Record<string, unknown>): Promise<string> {
        const url = this.buildUrl(`/${module}/${this._rid}`)
        const options: Record<string, unknown> = {
            headers: {
                'X-Error-Accept': 'application/json'
            },
            auth: {
                user: this._username,
                pass: this._password,
                'sendImmediately': false
            }
        }
        if (queryString) { options['qs'] = queryString }
        if (this._ca) options['agentOptions'] = { ca: this._ca }
        options['rejectUnauthorized'] = this._rejectUnauthorized
        return request.get(url, options)
    }

    private _sendMLdebugEvalRequest(script: string, database: string,
        txnId: string, modules: string, root: string): Promise<string> {
        const url = this.buildUrl('/eval')
        const options = {
            headers: {
                'Content-type': 'application/x-www-form-urlencoded',
                'X-Error-Accept': 'application/json'
            },
            auth: {
                user: this._username,
                pass: this._password,
                'sendImmediately': false
            },
            body: `javascript=${querystring.escape(script)}`
        }
        if (this._ca) options['agentOptions'] = { ca: this._ca }
        options['rejectUnauthorized'] = this._rejectUnauthorized
        const evalOptions = {
            database: database,
            modules: modules
        }
        if (txnId) evalOptions['txnId'] = txnId
        if (root) evalOptions['root'] = root
        options['qs'] = evalOptions
        return request.post(url, options)
    }
}
