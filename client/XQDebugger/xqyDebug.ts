import { DebugProtocol } from 'vscode-debugprotocol'
import { Handles, InitializedEvent,
    Logger, logger, LoggingDebugSession,
    StoppedEvent, OutputEvent, Source, TerminatedEvent, Breakpoint, Thread,
    StackFrame, Scope, Variable
} from 'vscode-debugadapter'
import { XqyRuntime, XqyBreakPoint, XqyFrame, XqyScopeObject, XqyVariable } from './xqyRuntime'
import { basename } from 'path'

import { MlClientParameters } from '../marklogicClient'


// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Subject } = require('await-notify')

export interface LaunchRequestArguments extends DebugProtocol.LaunchRequestArguments {
    program: string;
    query: string;
    stopOnEntry?: boolean;
    /** enable logging the Debug Adapter Protocol */
    trace?: boolean;
    rid: string;
    clientParams: MlClientParameters;
    path: string;
}

export interface AttachRequestArguments extends DebugProtocol.AttachRequestArguments {
    path: string;
    rid: string;
    clientParams: MlClientParameters;
    trace?: boolean;
    stopOnEntry?: boolean;
}

export interface InitializeRequestArguments {
    clientParams: MlClientParameters;
}

const timeout = (ms: number): Promise<any> => {
    return new Promise(resolve => setTimeout(resolve, ms))
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
const lineOnMl = (localLine: number, uri: string): number => {
    if (uri) return localLine + 1
    return localLine
}


export class XqyDebugSession extends LoggingDebugSession {

    private static THREAD_ID = 1
    private requestId: string

    private _runtime: XqyRuntime
    private _variableHandles = new Handles<XqyVariable[]>()
    private _frameHandles = new Handles<XqyFrame>()
    private _configurationDone = new Subject()
    private _stackFrames: Array<XqyFrame> = []

    // localPath => <set of breakpoints>
    private _bpCache: Map<string, Set<XqyBreakPoint>> = new Map();

    // local modules root
    private _workDir = ''
    private _queryPath = ''


    private _cancelationTokens = new Map<number, boolean>()
    private _isLongrunning = new Map<number, boolean>()

    private createSource(filePath: string): Source {
        if (!filePath) filePath = this._workDir
        const name: string = basename(filePath)
        return new Source(name, filePath, undefined, undefined, 'data-placeholder')
    }

    public constructor() {
        super()

        this.requestId = '0'
        this.setDebuggerLinesStartAt1(false)
        this.setDebuggerColumnsStartAt1(false)

        this._runtime = new XqyRuntime()
    }

    protected initializeRequest(response: DebugProtocol.InitializeResponse, args: DebugProtocol.InitializeRequestArguments): void {
        logger.setup(Logger.LogLevel.Stop, false)
        response.body = response.body || {}
        response.body.supportsConfigurationDoneRequest = true
        response.body.supportsFunctionBreakpoints = false
        response.body.supportsConditionalBreakpoints = false
        response.body.supportsCompletionsRequest = true
        response.body.supportsDelayedStackTraceLoading = false
        response.body.supportsCompletionsRequest = true
        response.body.supportsSetVariable = false
        response.body.supportsRestartFrame = false

        response.body.completionTriggerCharacters = [ ':' ]

        this.sendResponse(response)
        this.sendEvent(new InitializedEvent())
    }

    protected configurationDoneRequest(response: DebugProtocol.LaunchResponse, args: LaunchRequestArguments): void {
        super.configurationDoneRequest(response, args)
        this._configurationDone.notify()
    }

    private _mapLocalFiletoUrl(localPath: string): string {
        // eval'd query => blank URI at top of stack
        if (this._queryPath === localPath) {
            return ''
        }
        return localPath.replace(this._workDir, '')
    }

    private _mapUrlToLocalFile(url: string): string {
        if (!url) {
            return this._queryPath
        } else {
            return `${this._workDir}${url}`.replace(/\/+/, '/')
        }
    }

    private _setBufferedBreakPoints(): void {
        const xqyRequests = []
        for (const [localPath, bps] of this._bpCache.entries()) {
            const uri: string = this._mapLocalFiletoUrl(localPath)
            const lines: number[] = [...bps].map(bp => lineOnMl(bp.line, uri))
            xqyRequests.push(this._runtime.setBreakPointsOnMl(uri, lines)
                .then((confirmedLines: number[]) => {
                    console.debug(`${confirmedLines.length} breakpoints set no ${uri}: (${confirmedLines.toString()})`)
                })
            )
        }

        Promise.all(xqyRequests)
            .catch(error => {
                this._handleError(error)
            })
    }

    protected async launchRequest(response: DebugProtocol.LaunchResponse, args: LaunchRequestArguments): Promise<void> {
        logger.setup(Logger.LogLevel.Stop, false)
        // TODO: are we only doing this because it was in the mock debugger?
        // is there an actual race condition this addresses?
        await this._configurationDone.wait(1000)
        this._workDir = args.path
        this._queryPath = args.program
        this._runtime.initialize(args)

        try {
            this._runtime.setRid(await this._runtime.launchWithDebugEval(args.query))
            this.refreshStack('launchRequest')
            await this._setBufferedBreakPoints()
            this.sendResponse(response)
            this.sendEvent(new StoppedEvent('entry', XqyDebugSession.THREAD_ID))
        } catch (error) {
            this._handleError(error, 'Error launching XQY request', true, 'launchRequest')
        }
    }

    protected async attachRequest(response: DebugProtocol.AttachResponse, args: AttachRequestArguments): Promise<void> {
        logger.setup(Logger.LogLevel.Stop, false)
        await this._configurationDone.wait(1000)
        this._workDir = args.path
        this._runtime.setRid(args.rid)
        if (this._runtime.getRid()) {
            this._runtime.setRunTimeState('attached')
            this._runtime.initialize(args)
            this.refreshStack('attachRequest')
            await this._setBufferedBreakPoints()
            this.sendResponse(response)
            this.sendEvent(new StoppedEvent('entry', XqyDebugSession.THREAD_ID))
        } else {
            response.success = false
            this._runtime.setRunTimeState('shutdown')
            this.sendEvent(new TerminatedEvent(false))
        }
    }

    protected setBreakPointsRequest(response: DebugProtocol.SetDataBreakpointsResponse, args: DebugProtocol.SetBreakpointsArguments): void {
        const path: string = args.source.path

        if (args.breakpoints) {
            const localBreakpoints = args.breakpoints.map((b, idx) => {
                const bp: DebugProtocol.Breakpoint = new Breakpoint(false, b.line, b.column, this.createSource(path))
                return bp
            })

            const uri: string = this._mapLocalFiletoUrl(path)
            const newBps: Set<XqyBreakPoint> = new Set()
            args.breakpoints.forEach((breakpoint: DebugProtocol.SourceBreakpoint) => {
                newBps.add({
                    filePath: path,
                    uri: uri,
                    line: breakpoint.line,
                    column: breakpoint.column,
                    condition: breakpoint.condition
                } as XqyBreakPoint)
            })
            this._bpCache.set(path, newBps)

            response.body = { breakpoints: localBreakpoints }
            if (this._runtime.getRunTimeState() !== 'shutdown') {
                const mlLineNos: number[] = [...newBps].map(bp => lineOnMl(bp.line, uri))

                this._runtime.setBreakPointsOnMl(uri, mlLineNos)
                    .then((confirmedLines: number[]) => {
                        console.debug(`set ${confirmedLines.length} new breakpoints on ${uri}: ${confirmedLines.toString()}`)
                        confirmedLines.forEach(mlLineNo => {
                            localBreakpoints.find(bp => mlLineNo === lineOnMl(bp.line, uri)).verified = true
                        })
                        this.sendResponse(response)
                    })
                    .catch(err => {
                        this._handleError(err, 'Error setting XQY breakpoitns', false, 'setBreakPointsRequest')
                    })
            } else {
                this.sendResponse(response)
            }
        }
    }

    protected threadsRequest(response: DebugProtocol.ThreadsResponse): void {
        response.body = {
            threads: [
                new Thread(XqyDebugSession.THREAD_ID, 'XQY thread 1 (single threaded)')
            ]
        }
        this.sendResponse(response)
    }

    // VS Code defaults to add 1. Let's not do that.
    protected convertDebuggerLineToClient(line: number): number {
        return line
    }

    protected stackTraceRequest(response: DebugProtocol.StackTraceResponse, args: DebugProtocol.StackTraceArguments): void {
        const stackFrames: StackFrame[] = this._stackFrames.map(xqyFrame => {
            {
                // if the stack frame has a module URI, it's a from module
                // therefore 'cache-buster' line ML modules needs to be offset
                const localLine: number = xqyFrame.uri ? xqyFrame.line - 1 : xqyFrame.line
                return new StackFrame(
                    this._frameHandles.create(xqyFrame),
                    xqyFrame.operation ? xqyFrame.operation : '<anonymous>',
                    this.createSource(this._mapUrlToLocalFile(xqyFrame.uri)),
                    this.convertDebuggerLineToClient(localLine),
                    this.convertDebuggerColumnToClient(xqyFrame.column)
                )
            }
        })
        response.body = {
            stackFrames: stackFrames,
            totalFrames: stackFrames.length
        }
        this.sendResponse(response)
    }

    protected scopesRequest(response: DebugProtocol.ScopesResponse, args: DebugProtocol.ScopesArguments): void {
        const scopes: Scope[] = []
        const frame: XqyFrame = this._frameHandles.get(args.frameId)

        for (let i = 0; i < frame.scopeChain.length; i++) {
            const xqyScope: XqyScopeObject = frame.scopeChain[i]
            const scope: Scope = new Scope(
                xqyScope.type,
                this._variableHandles.create(xqyScope.variables),
                false
            )
            scopes.push(scope)
        }

        response.body = { scopes: scopes }
        this.sendResponse(response)
    }

    protected async variablesRequest(response: DebugProtocol.VariablesResponse, args: DebugProtocol.VariablesArguments, request?: DebugProtocol.Request): Promise<void> {
        const variables: Variable[] = []
        const otherXqyVars: XqyVariable[] = this._variableHandles.get(args.variablesReference)

        otherXqyVars.forEach((xqvar: XqyVariable) => {
            variables.push(new Variable(xqvar.name, xqvar.value ? xqvar.value : '', 0))
        })

        response.body = { variables: variables }
        this.sendResponse(response)
    }

    private refreshStack(callerName: string): void {
        this._runtime.getCurrentStack().then(resp => {
            this._stackFrames = resp
            this.sendEvent(new StoppedEvent('breakpoint', XqyDebugSession.THREAD_ID))
            this._resetHandles()
        }).catch(err => {
            this._handleError(err,
                `Error after ${callerName}: ${JSON.stringify(err)}`, true, callerName)
        })
    }

    private controlRequest(call: 'continue' | 'next' | 'step' | 'out' | 'detach', response: DebugProtocol.Response, args: any): void {
        this._runtime.dbgControlCall(call).then(() => {
            this.sendResponse(response)
            if (call === 'detach') {
                this._runtime.setRunTimeState('shutdown')
                this.sendEvent(new TerminatedEvent())
            } else if (this._runtime.getRunTimeState() !== 'shutdown') {
                this.refreshStack(`dbg:${call}()`)
            }
        })
    }

    protected continueRequest(response: DebugProtocol.ContinueResponse, args: DebugProtocol.ReverseContinueArguments): void {
        this.controlRequest('continue', response, args)
    }

    protected stepInRequest(response: DebugProtocol.StepInResponse, args: DebugProtocol.StepInArguments): void {
        this.controlRequest('step', response, args)
    }

    protected stepOutRequest(response: DebugProtocol.StepOutResponse, args: DebugProtocol.StepOutArguments): void {
        this.controlRequest('out', response, args)
    }

    protected nextRequest(response: DebugProtocol.NextResponse, args: DebugProtocol.NextArguments): void {
        this.controlRequest('next', response, args)
    }

    /** the red stop button */
    protected disconnectRequest(response: DebugProtocol.DisconnectResponse, args: DebugProtocol.DisconnectArguments, request?: DebugProtocol.Request): void {
        if (this._runtime.getRunTimeState() === 'launched') {
            this._runtime.removeAllBreakPointsOnMl().then(() => {
                this.controlRequest('continue', response, args)
            }).then(() => {
                this.controlRequest('detach', response, args)
            }).then(() => {
                this._runtime.setRunTimeState('shutdown')
            })
        }
    }

    protected evaluateRequest(response: DebugProtocol.EvaluateResponse, args: DebugProtocol.EvaluateArguments): void {
        this._runtime.evaluateInContext(`\$${args.expression}`).then((resp: any) => {
            response.body = {
                result: resp.value,
                type: resp.datatype,
                variablesReference: resp.length ? resp.length : 0
            }
            this.sendResponse(response)
        }).catch(err => {
            this._handleError(err, 'Error evaluating expression', false, 'evaluateRequest')
        })
    }

    protected completionsRequest(response: DebugProtocol.CompletionsResponse, args: DebugProtocol.CompletionsArguments): void {
        this.sendResponse(response)
    }

    private _trace(message: string): void {
        this.sendEvent(new OutputEvent(message + '\n', 'console'))
    }

    private _handleError(error: Error, msg?: string, terminate?: boolean, func?: string): void {
        if (error.message.includes('XDMP-NOREQUEST') || msg.includes('DBG-REQUESTRECORD')) {
            this._runtime.setRunTimeState('shutdown')
            this.sendEvent(new TerminatedEvent())
            this._trace(`Request ${this._runtime.getRid()} is done`)
        } else {
            if (terminate === true) {
                this.sendEvent(new TerminatedEvent())
            }
            if (msg) {
                this._trace(msg)
            }
        }
    }

    private _resetHandles(): void {
        this._variableHandles.reset()
        this._frameHandles.reset()
    }

}


XqyDebugSession.run(XqyDebugSession)
