/* eslint-disable @typescript-eslint/no-unused-vars */
/*
 * Copyright (c) 2020 MarkLogic Corporation
 */

import {
    LoggingDebugSession, Breakpoint, OutputEvent,
    InitializedEvent, TerminatedEvent, StoppedEvent,
    Thread, StackFrame, Scope, Source, Handles, Logger, logger
} from 'vscode-debugadapter'
import { DebugProtocol } from 'vscode-debugprotocol'
import { basename } from 'path'
import { MLRuntime, MLbreakPoint, V8Frame, ScopeObject, V8PropertyObject, V8PropertyValue } from './mlRuntime'
import { Subject } from 'await-notify'
import { existsSync } from 'fs'

interface LaunchRequestArguments extends DebugProtocol.LaunchRequestArguments {
    program: string;
    queryText: string;
    hostname: string;
    username: string;
    password: string;
    rid: string;
    database?: string;
    txnId?: string;
    modules?: string;
    root?: string;
    mlModulesRoot?: string;
    ssl?: boolean;
    pathToCa?: Buffer;
    scheme?: string;
}

interface AttachRequestArguments extends DebugProtocol.AttachRequestArguments {
    root: string;
    hostname: string;
    debugServerName: string;
    username: string;
    password: string;
    rid: string;
    ssl?: boolean;
    pathToCa?: Buffer;
}

export class MLDebugSession extends LoggingDebugSession {

    // we don't support multiple threads, so we can use a hardcoded ID for the default thread
    private static THREAD_ID = 1;

    // ML debug runtime
    private _runtime: MLRuntime;
    private _configurationDone = new Subject();
    private _variableHandles = new Handles<string>();
    private _frameHandles = new Handles<V8Frame>();
    private _bpCache: Record<string, Set<string>> = {};
    private _stackRespString = '';
    private _queryPath = '';
    private _workDir = '';
    private _scheme = '';

    // private _traceLevel: "none" | "info" | "detailed" | "all" = "all"

    public constructor() {
        super('ml-debug.txt')
        // this debugger uses zero-based lines and columns
        this.setDebuggerLinesStartAt1(false)
        this.setDebuggerColumnsStartAt1(false)

        this._runtime = new MLRuntime()
    }

    /**
     * The 'initialize' request is the first request called by the frontend
     * to interrogate the features the debug adapter provides.
     */
    protected initializeRequest(response: DebugProtocol.InitializeResponse, args: DebugProtocol.InitializeRequestArguments): void {

        // build and return the capabilities of this debug adapter:
        logger.setup(Logger.LogLevel.Stop, false)

        response.body = response.body || {}

        // the adapter implements the configurationDoneRequest.
        response.body.supportsConfigurationDoneRequest = true

        // This debug adapter supports function breakpoints.
        response.body.supportsFunctionBreakpoints = false

        // This debug adapter supports conditional breakpoints.
        response.body.supportsConditionalBreakpoints = true

        // make VS Code to support completion in REPL
        response.body.supportsCompletionsRequest = true

        // This debug adapter supports delayed loading of stackframes
        response.body.supportsDelayedStackTraceLoading = false

        response.body.supportsTerminateRequest = false

        // response.body.supportsRestartRequest = true;

        response.body.supportsSetVariable = false

        response.body.supportsRestartFrame = false

        this.sendResponse(response)

        // since this debug adapter can accept configuration requests like 'setBreakpoint' at any time,
        // we request them early by sending an 'initializeRequest' to the frontend.
        // The frontend will end the configuration sequence by calling 'configurationDone' request.
        this.sendEvent(new InitializedEvent())
    }

    /**
     * Called at the end of the configuration sequence.
     * Indicates that all breakpoints etc. have been sent to the DA and that the 'launch' can start.
     */
    protected configurationDoneRequest(response: DebugProtocol.ConfigurationDoneResponse, args: DebugProtocol.ConfigurationDoneArguments): void {
        super.configurationDoneRequest(response, args)

        // notify the launchRequest that configuration has finished
        this._configurationDone.notify()
    }

    protected async launchRequest(response: DebugProtocol.LaunchResponse, args: LaunchRequestArguments): Promise<void> {
        // temporary
        // started the request in jsdbg.eval()
        logger.setup(Logger.LogLevel.Stop, false)
        await this._configurationDone.wait(1000)
        this._runtime.initialize(args)
        try {
            this._queryPath = args.program
            this._workDir = args.root
            this._scheme = args.scheme

            const result = await this._runtime.launchWithDebugEval(
                args.queryText, args.database, args.txnId, args.modules, args.mlModulesRoot)
            const rid = JSON.parse(result).requestId
            this._runtime.setRid(rid)
            // runtime set up

            this._runtime.setRunTimeState('launched')
            this._stackRespString = await this._runtime.waitTillPaused()
            await this._setBufferedBreakPoints()
            this._trace('Launched Request with id: ' + rid)
            this.sendResponse(response)
            this.sendEvent(new StoppedEvent('entry', MLDebugSession.THREAD_ID))
        } catch (err) {
            this._handleError(err, 'Failed to start JS debugging', true, 'launchRequest')
            this._runtime.setRunTimeState('shutdown')
            this.sendResponse(response)
            //error launching request
            this.sendEvent(new TerminatedEvent())

        }
    }

    protected async attachRequest(response: DebugProtocol.AttachResponse, args: AttachRequestArguments): Promise<void> {
        logger.setup(Logger.LogLevel.Stop, false)
        await this._configurationDone.wait(1000)
        this._runtime.initialize(args)
        this._runtime.setRid(args.rid)
        this._workDir = args.root
        this._runtime.setRunTimeState('attached')
        try {
            this._stackRespString = await this._runtime.waitTillPaused()
        } catch (e) {
            this._runtime.setRunTimeState('shutdown')
            this.sendResponse(response)
            this.sendEvent(new TerminatedEvent())
            return
        }
        await this._setBufferedBreakPoints()
        this.sendResponse(response)
        this.sendEvent(new StoppedEvent('entry', MLDebugSession.THREAD_ID))
    }

    protected setBreakPointsRequest(response: DebugProtocol.SetBreakpointsResponse, args: DebugProtocol.SetBreakpointsArguments): void {

        const path = args.source.path as string
        const mlrequests: Promise<string>[] = []
        if (args.breakpoints) {
            //for response only
            const actualBreakpoints = args.breakpoints.map(b => {
                const bp = new Breakpoint(true, b.line, b.column) as DebugProtocol.Breakpoint
                return bp
            })

            const newBp: Set<string> = new Set()
            args.breakpoints.forEach(breakpoint => {
                newBp.add(JSON.stringify({
                    line: breakpoint.line,
                    column: breakpoint.column,
                    condition: breakpoint.condition
                })) //construct the set of new breakpoints, better ways?
            })

            const toDelete = (path in this._bpCache) ? new Set([...this._bpCache[path]].filter(x => !newBp.has(x))) : new Set()
            const toAdd = (path in this._bpCache) ? new Set([...newBp].filter(x => !this._bpCache[path].has(x))) : newBp
            this._bpCache[path] = newBp
            if (this._runtime.getRunTimeState() !== 'shutdown') {
                toDelete.forEach(bp => {
                    const breakpoint = JSON.parse(String(bp))
                    const url = this._mapLocalFiletoUrl(path)
                    mlrequests.push(this._runtime.removeBreakPoint({
                        url: url.startsWith('untitled') ? '' : url,
                        line: this.convertClientLineToDebugger(breakpoint.line),
                        column: this.convertClientLineToDebugger(breakpoint.column),
                    } as MLbreakPoint))
                })

                toAdd.forEach(bp => {
                    const breakpoint = JSON.parse(String(bp))
                    const url = this._mapLocalFiletoUrl(path)
                    mlrequests.push(this._runtime.setBreakPoint({
                        url: url.startsWith('untitled') ? '' : url,
                        line: this.convertClientLineToDebugger(breakpoint.line),
                        column: this.convertClientLineToDebugger(breakpoint.column),
                        condition: breakpoint.condition
                    } as MLbreakPoint))
                })

                response.body = {
                    breakpoints: actualBreakpoints
                }

                Promise.all(mlrequests).then(() => {
                    this.sendResponse(response)
                }).catch(err => {
                    this._handleError(err, 'Error setting breakpoints', false, 'setBreakPointsRequest')
                    this.sendResponse(response)
                })
            } else {
                response.body = {
                    breakpoints: actualBreakpoints
                }
                this.sendResponse(response)
            }
        }
    }

    protected threadsRequest(response: DebugProtocol.ThreadsResponse): void {

        // Return dummy thread
        response.body = {
            threads: [
                new Thread(MLDebugSession.THREAD_ID, 'ML Request Thread')
            ]
        }
        this.sendResponse(response)
    }

    protected stackTraceRequest(response: DebugProtocol.StackTraceResponse, args: DebugProtocol.StackTraceArguments): void {
        try {
            const body = this._stackRespString
            const stacks = JSON.parse(body) as V8Frame[]

            const frames: StackFrame[] = []
            for (let i = 0; i < stacks.length; i++) {
                const stk = stacks[i]
                const url = stk.url
                frames.push(new StackFrame(
                    this._frameHandles.create(stk),
                    (stk.functionName) ? stk.functionName : '<anonymous>',
                    this.createSource(this._mapUrlToLocalFile(url)),
                    this.convertDebuggerLineToClient(stk.location.lineNumber),
                    this.convertDebuggerLineToClient(stk.location.columnNumber)
                ))
            }
            response.body = {
                stackFrames: frames,
                totalFrames: stacks.length
            }
            this.sendResponse(response)
        } catch (e) {
            this._handleError(e, 'Error reading stack trace', true, 'stackTraceRequest')
            this.sendResponse(response)
        }
    }

    protected scopesRequest(response: DebugProtocol.ScopesResponse, args: DebugProtocol.ScopesArguments): void {
        try {
            const scopes: Scope[] = []
            const v8frame = this._frameHandles.get(args.frameId)
            const scopesMl = v8frame.scopeChain as ScopeObject[]

            scopesMl.forEach((scope: ScopeObject) => {
                const expensive = scope.type === 'global' ? true : false

                scopes.push(
                    new Scope(scope.type,
                        scope.object.objectId ? this._variableHandles.create(scope.object.objectId as string) : 0,
                        expensive),
                )
            })
            response.body = {
                scopes: scopes
            }
            this.sendResponse(response)
        } catch (e) {
            this._handleError(e, 'Error reading scopes', true, 'scopesRequest')
            this.sendResponse(response)
        }
    }

    protected async variablesRequest(response: DebugProtocol.VariablesResponse, args: DebugProtocol.VariablesArguments, request?: DebugProtocol.Request): Promise<void> {
        const variables: DebugProtocol.Variable[] = []
        const objId = this._variableHandles.get(args.variablesReference)
        this._runtime.getProperties(objId).then(resp => {
            const propertiesMl = JSON.parse(resp).result.result as V8PropertyObject[] //array of properties
            for (let i = 0; i < propertiesMl.length; i++) {
                try {
                    const element: V8PropertyObject = propertiesMl[i]
                    // console.log(element);
                    const name: string = element.name
                    if (!element.hasOwnProperty('value')) {
                        variables.push({
                            name: name,
                            value: 'null',
                            variablesReference: 0
                        } as DebugProtocol.Variable)
                        continue
                    }
                    const type = element.value.hasOwnProperty('type') ? element.value.type : 'undefined'
                    let value
                    if (element.value.hasOwnProperty('value')) { value = String(element.value.value) }
                    else if (element.value.hasOwnProperty('description')) { value = String(element.value.description) }
                    else { value = 'undefined' }
                    variables.push({
                        name: name,
                        type: type,
                        value: value,
                        variablesReference: element.value.objectId ? this._variableHandles.create(element.value.objectId) : 0
                    } as DebugProtocol.Variable)
                } catch (e) {
                    this._handleError(e, 'Error inspecting variables', false, 'variablesRequest')
                }
            }
            response.body = {
                variables: variables
            }
            this.sendResponse(response)
        }).catch(err => {
            this._handleError(err, 'Error retrieving variables', false, 'variablesRequest')
            this.sendResponse(response)
        })
    }

    protected pauseRequest(response: DebugProtocol.PauseResponse, args: DebugProtocol.PauseArguments): void {
        this._runtime.pause().then(() => {
            this.sendResponse(response)
            //get stackTrace
            this._runtime.waitTillPaused().then(resp => {
                this._stackRespString = resp
                this.sendEvent(new StoppedEvent('pause', MLDebugSession.THREAD_ID))
                this._resetHandles()
            }).catch(err => {
                this._handleError(err, 'Error in waiting request', true, 'pauseRequest')
                this.sendResponse(response)
            })
        }).catch(err => {
            this._handleError(err, 'Error in pause command', true, 'pauseRequest')
        })
    }

    protected continueRequest(response: DebugProtocol.ContinueResponse, args: DebugProtocol.ContinueArguments): void {
        this._runtime.resume().then(() => {
            this.sendResponse(response)
            this._runtime.waitTillPaused().then(resp => {
                this._stackRespString = resp
                this.sendEvent(new StoppedEvent('breakpoint', MLDebugSession.THREAD_ID))
                this._resetHandles()
            }).catch(err => {
                this._handleError(err, 'Error in waiting request', true, 'continueRequest')
                this.sendResponse(response)
            })
        }).catch(err => {
            this._handleError(err, 'Error in continue command', true, 'continueRequest')
        })
    }

    protected nextRequest(response: DebugProtocol.NextResponse, args: DebugProtocol.NextArguments): void {
        this._runtime.stepOver().then(() => {
            this.sendResponse(response)
            this._runtime.waitTillPaused().then(resp => {
                this._stackRespString = resp
                this.sendEvent(new StoppedEvent('step', MLDebugSession.THREAD_ID))
                this._resetHandles()
            }).catch(err => {
                this._handleError(err, 'Error in waiting request', true, 'nextRequest')
                this.sendResponse(response)
            })
        }).catch(err => {
            this._handleError(err, 'Error in next command', true, 'nextRequest')
        })
    }

    protected stepInRequest(response: DebugProtocol.NextResponse, args: DebugProtocol.NextArguments): void {
        this._runtime.stepInto().then(() => {
            this.sendResponse(response)
            this._runtime.waitTillPaused().then(resp => {
                this._stackRespString = resp
                this.sendEvent(new StoppedEvent('step', MLDebugSession.THREAD_ID))
                this._resetHandles()
            }).catch(err => {
                this._handleError(err, 'Error in waiting request', true, 'stepInRequest')
                this.sendResponse(response)
            })
        }).catch(err => {
            this._handleError(err, 'Error in stepIn command', true, 'stepInRequest')
        })
    }

    protected stepOutRequest(response: DebugProtocol.NextResponse, args: DebugProtocol.NextArguments): void {
        this._runtime.stepOut().then(() => {
            this.sendResponse(response)
            this._runtime.waitTillPaused().then(resp => {
                this._stackRespString = resp
                this.sendEvent(new StoppedEvent('step', MLDebugSession.THREAD_ID))
                this._resetHandles()
            }).catch(err => {
                this._handleError(err, 'Error in waiting request', true, 'stepOutRequest')
                this.sendResponse(response)
            })
        }).catch(err => {
            this._handleError(err, 'Error in stepOut command', true, 'stepOutRequest')
        })
    }

    protected disconnectRequest(response: DebugProtocol.DisconnectResponse, args: DebugProtocol.DisconnectArguments): void {
        if (this._runtime.getRunTimeState() === 'launched') {
            this._runtime.setRunTimeState('shutdown')
            this._runtime.terminate().then(() => {
                this.sendResponse(response)
            }).catch((e) => {
                this._handleError(e, 'Error terminating request')
                this.sendResponse(response)
            })
        } else if (this._runtime.getRunTimeState() === 'attached') {
            this._runtime.setRunTimeState('shutdown')
            this._runtime.disable().then(() => {
                if (args.restart === true) {
                    this._trace('Restart is not supported for attach, please attach to a new request')
                }
                this.sendResponse(response)
            }).catch((e) => {
                this._handleError(e, 'Error disconnecting request')
                this.sendResponse(response)
            })
        } else {
            this.sendResponse(response)
        }
    }

    protected evaluateRequest(response: DebugProtocol.EvaluateResponse, args: DebugProtocol.EvaluateArguments): void {
        let cid = ''
        if (typeof args.frameId === 'number' && args.frameId > 0) {
            const frameInfo = this._frameHandles.get(args.frameId)
            cid = frameInfo.callFrameId
        }
        this._runtime.evaluateOnCallFrame(args.expression, cid).then(resp => {
            const body = resp
            const evalResult = JSON.parse(body).result.result as V8PropertyValue
            response.body = {
                result: evalResult.hasOwnProperty('value') ? String(evalResult.value) :
                    (evalResult.hasOwnProperty('description') ? String(evalResult.description) : 'undefined'),
                type: evalResult.type,
                variablesReference: evalResult.hasOwnProperty('objectId') ? this._variableHandles.create(evalResult.objectId) : 0
            }
            this.sendResponse(response)
        }).catch(err => {
            this._handleError(err, 'Error in evaluating expression', false, 'evaluateRequest')
            this.sendResponse(response)
        })
    }

    protected async sourceRequest(response: DebugProtocol.SourceResponse, args: DebugProtocol.SourceArguments, request?: DebugProtocol.Request): Promise<void> {
        this._runtime.getModuleContent(args.source.path).then(moduleContent => {
            return response.body = {
                content: moduleContent
            }
        }).then(() => {
            this.sendResponse(response)
        }).catch(err => {
            this._trace(JSON.stringify(err))
            this.sendResponse(response)
        })
    }

    protected completionsRequest(response: DebugProtocol.CompletionsResponse, args: DebugProtocol.CompletionsArguments): void {
        this.sendResponse(response)
    }

    //---- helpers

    private createSource(filePath: string): Source {
        let vsCodeUri = filePath
        let origin = 'local file'
        let id = 0

        if (filePath.toLowerCase().startsWith('untitled') && !existsSync(filePath)) {
            vsCodeUri = `untitled:${filePath}`
            origin = 'untitled'
        }
        else if (!existsSync(filePath)) {
            const mlModuleUri = this._mapLocalFiletoUrl(filePath)
            origin = `mldbg:/${mlModuleUri}`
            id = 9
            vsCodeUri = mlModuleUri
        }
        const name = basename(vsCodeUri)
        return new Source(name, vsCodeUri, id, origin, vsCodeUri)
    }

    private _mapUrlToLocalFile(url: string): string {
        if (!url) {
            return this._queryPath
        } else {
            return (this._workDir + url).replace(/\/+/, '/')
        }
    }

    private _mapLocalFiletoUrl(localPath: string): string {
        // localPath is the query being run => '' in debug stack
        if (this._queryPath === localPath) {
            return ''
        }
        // for querying with an unsaved buffer. Equivalent to '' in the debug
        // stack IFF the buffer title matches
        if (this._scheme === 'untitled' && localPath.toLowerCase().startsWith('untitled')) {
            return localPath
                .replace(`untitled:${this._queryPath}`, '')
        }
        // from module getter via "Show modules". return only path portion of URL
        if (localPath.startsWith('mlmodule:')) {
            return localPath
                .replace(`mlmodule:\/\/${this._runtime.getHostString()}`, '')
        }
        return localPath.replace(this._workDir, '')
    }

    private _setBufferedBreakPoints(): void {

        const mlrequests: Promise<string>[] = []
        for (const [path, breakpoints] of Object.entries(this._bpCache)) {
            breakpoints.forEach(bp => {
                const breakpoint = JSON.parse(String(bp))
                mlrequests.push(this._runtime.setBreakPoint({
                    url: this._mapLocalFiletoUrl(path),
                    line: this.convertClientLineToDebugger(breakpoint.line),
                    column: this.convertClientLineToDebugger(breakpoint.column),
                    condition: breakpoint.condition
                } as MLbreakPoint))
            })
        }

        Promise.all(mlrequests).catch(err => {
            this._handleError(err)
        })
    }

    private _trace(message: string): void {
        this.sendEvent(new OutputEvent(message + '\n', 'console'))
    }

    private _resetHandles(): void {
        this._variableHandles.reset()
        this._frameHandles.reset()
    }

    private _handleError(err: any, msg?: string, terminate?: boolean, func?: string): void {
        const errAsObject = JSON.parse(JSON.stringify(err))
        const errResp = errAsObject.errorResponse || errAsObject.message
        const messageCode = errResp.messageCode
        if (messageCode === 'JSDBG-REQUESTRECORD' || messageCode === 'XDMP-NOREQUEST') {
            this._runtime.setRunTimeState('shutdown')
            this.sendEvent(new TerminatedEvent())
            this._trace(`Request ${this._runtime.getRid()} has ended`)
        } else {
            if (!messageCode) {
                this._trace(errResp)
            }
            if (terminate === true) {
                this.sendEvent(new TerminatedEvent())
            }
            if (msg) {
                this._trace(msg)
            }
        }
    }

    /**
     * For mapping a debugger line from local source to its
     * corresponding MarkLogic module. Modules include an extra
     * 'cache-buster' line. To account for that, add 1 if the
     * module exists in ML.
     *
     * @param localLine line number in local XQY source code
     * @param uri URI of module in MarkLogic, or `''` for ad-hoc query
     * @returns predicted line number in MarkLogic module
     */
    private lineOnMl(localLine: number, uri: string): number {
        const localPath = this._mapUrlToLocalFile(uri)
        const locallyPresent: boolean = existsSync(localPath) || !uri
        if (uri && locallyPresent) return localLine + 1
        return localLine
    }
}


MLDebugSession.run(MLDebugSession)
