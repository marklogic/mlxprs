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

interface AttachRequestArguments extends DebugProtocol.AttachRequestArguments {
    path: string;
    rid: string;
}

const timeout = (ms: number): Promise<any> => {
    return new Promise(resolve => setTimeout(resolve, ms))
}

export class XqyDebugSession extends LoggingDebugSession {

    private static THREAD_ID = 1
    private requestId: string

    private _runtime: XqyRuntime
    private _variableHandles = new Handles<XqyVariable[]>()
    private _frameHandles = new Handles<XqyFrame>()
    private _configurationDone = new Subject()
    private _stackFrames: Array<XqyFrame> = []
    private _bpCache: Set<XqyBreakPoint> = new Set()
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
        response.body.supportsConditionalBreakpoints = true
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

    private _mapLocalFiletoUrl(path: string): string {
        if (!path) {
            path = this._queryPath
        }
        return path.replace(this._workDir, '')
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
        this._bpCache.forEach(bp => {
            xqyRequests.push(this._runtime.setBreakPoint(bp))
        })

        Promise.all(xqyRequests).then().catch(error => {
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
            await this._runtime.launchWithDebugEval(args.query)
            this._stackFrames = await this._runtime.getCurrentStack()
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
        this._runtime.setRid(args.rid)
        this._workDir = args.path
        this._runtime.setRunTimeState('attached')
        this._stackFrames = await this._runtime.getCurrentStack()
        await this._setBufferedBreakPoints()
        this.sendResponse(response)
        this.sendEvent(new StoppedEvent('entry', XqyDebugSession.THREAD_ID))
    }

    protected setBreakPointsRequest(response: DebugProtocol.SetDataBreakpointsResponse, args: DebugProtocol.SetBreakpointsArguments): void {
        const path = args.source.path as string

        const xqyRequests = []
        if (args.breakpoints) {
            const actualBreakpoints = args.breakpoints.map((b, idx) => {
                const bp = new Breakpoint(true, b.line, b.column, this.createSource(path)) as DebugProtocol.Breakpoint
                return bp
            })

            const newBps: Set<XqyBreakPoint> = new Set()
            args.breakpoints.forEach((breakpoint: DebugProtocol.SourceBreakpoint) => {
                newBps.add({
                    filePath: path,
                    uri: this._mapLocalFiletoUrl(path),
                    line: breakpoint.line,
                    column: breakpoint.column,
                    condition: breakpoint.condition
                } as XqyBreakPoint)
            })

            const toDelete = new Set([...this._bpCache].filter(x => !newBps.has(x)))
            const toAdd = new Set([...newBps].filter(x => !this._bpCache.has(x)))
            this._bpCache = newBps

            if (this._runtime.getRunTimeState() !== 'shutdown') {
                toDelete.forEach(bp => {
                    bp.uri = this._mapLocalFiletoUrl(this._workDir)
                    xqyRequests.push(this._runtime.removeBreakPoint(bp))
                })

                toAdd.forEach(bp => {
                    bp.uri = this._mapLocalFiletoUrl(this._workDir)
                    xqyRequests.push(this._runtime.setBreakPoint(bp))
                })

                response.body = { breakpoints: actualBreakpoints }

                Promise.all(xqyRequests).then(() => {
                    this.sendResponse(response)
                }).catch(err => {
                    this._handleError(err, 'Error setting XQY breakpoitns', false, 'setBreakPointsRequest')
                })
            } else {
                response.body = { breakpoints: actualBreakpoints }
            }
            this.sendResponse(response)
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

    protected stackTraceRequest(response: DebugProtocol.StackTraceResponse, args: DebugProtocol.StackTraceArguments): void {
        const stackFrames: StackFrame[] = this._stackFrames.map(xqyFrame => {
            {
                return new StackFrame(
                    this._frameHandles.create(xqyFrame),
                    xqyFrame.operation ? xqyFrame.operation : '<anonymous>',
                    this.createSource(this._mapUrlToLocalFile(xqyFrame.uri)),
                    this.convertDebuggerLineToClient(xqyFrame.line),
                    this.convertDebuggerLineToClient(xqyFrame.line)
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

    private controlRequest(call: 'continue' | 'next' | 'step' | 'out', response: DebugProtocol.Response, args: any): void {
        this._runtime.dbgControlCall(call).then(() => {
            this.sendResponse(response)
            this._runtime.getCurrentStack().then(resp => {
                this._stackFrames = resp
                this.sendEvent(new StoppedEvent('breakpoint', XqyDebugSession.THREAD_ID))
                this._resetHandles()
                this._resetHandles()
            }).catch(err => {
                this._handleError(err,
                    `Error in command dbg:${call}(): ${JSON.stringify(err)}`, true, `dbg:${call}`)
            })
        })
    }

    protected continueRequest(response: DebugProtocol.ContinueResponse, args: DebugProtocol.ReverseContinueArguments): void {
        return this.controlRequest('continue', response, args)
    }

    protected stepInRequest(response: DebugProtocol.StepInResponse, args: DebugProtocol.StepInArguments): void {
        return this.controlRequest('step', response, args)
    }

    protected stepOutRequest(response: DebugProtocol.StepOutResponse, args: DebugProtocol.StepOutArguments): void {
        return this.controlRequest('out', response, args)
    }

    protected nextRequest(response: DebugProtocol.NextResponse, args: DebugProtocol.NextArguments): void {
        return this.controlRequest('next', response, args)
    }

    protected evaluateRequest(response: DebugProtocol.EvaluateResponse, args: DebugProtocol.EvaluateArguments): void {
        let xid = ''
        if (typeof args.frameId === 'number' && args.frameId > 0) {
            const frameInfo: XqyFrame = this._frameHandles.get(args.frameId)
            xid = frameInfo.xid
        }
        this._runtime.evaluateInContext(args.expression, xid).result((resp: Record<string, any>) => {
            const body = resp.get('result')
            const evalResult = JSON.parse(body).result.result
            response.body = {
                result: 'not yet implemented, sorry',
                type: null,
                variablesReference: 0
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
        if (error.message.includes('XDMP-NOREQUEST')) {
            this._runtime.setRunTimeState('shutdown')
            this.sendEvent(new TerminatedEvent())
            this._trace(`Request ${this._runtime.getRid()} is over`)
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
