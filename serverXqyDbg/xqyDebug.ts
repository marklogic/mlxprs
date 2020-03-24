import { DebugProtocol } from 'vscode-debugprotocol'
import { Handles, InitializedEvent,
    Logger, logger, LoggingDebugSession,
    StoppedEvent, OutputEvent, Source, TerminatedEvent, Breakpoint, Thread, StackFrame, Scope
} from 'vscode-debugadapter'
import * as CNST from './debugConstants'
// import { XqyRuntime, Stack } from './xqyRuntimeMocked'
import { XqyRuntime, XqyBreakPoint } from './xqyRuntime'
import { basename } from 'path'
import { Memento, WorkspaceConfiguration } from 'vscode'
import { MarklogicVSClient, getDbClient, XQY } from '../client/marklogicClient'
import { sendXQuery } from '../client/queryDirector'
// import * as ml from 'marklogic'


// eslint-disable-next-line @typescript-eslint/no-var-requires
const { Subject } = require('await-notify')

interface LaunchRequestArguments extends DebugProtocol.LaunchRequestArguments {
	program: string;
	stopOnEntry?: boolean;
	/** enable logging the Debug Adapter Protocol */
	trace?: boolean;
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
    private _variableHandles = new Handles<string>()
	private _configurationDone = new Subject()
    private _stackRespString = '';
    private _bpCache = new Set();
    private _vsCodeState: Memento = null;
    private _vsCodeCfg: WorkspaceConfiguration = null;

    private _cancelationTokens = new Map<number, boolean>()
    private _isLongrunning = new Map<number, boolean>()

    private createSource(filePath: string): Source {
        return new Source(basename(filePath), this.convertDebuggerPathToClient(filePath),
            undefined, undefined, 'data-placeholder')
    }

    public setMlClientContext(state: Memento, cfg: WorkspaceConfiguration): void {
        const client: MarklogicVSClient = getDbClient('', XQY, cfg, state)
        this._vsCodeState = state
        this._vsCodeCfg = cfg
        this._runtime.initialize(client)
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
	    return path.replace(this._workDir, '')
	}

    private _setBufferedBreakPoints() {
        const xqyRequests = []
        this._bpCache.forEach(bp => {
            const breakpoint = JSON.parse(String(bp))
            xqyRequests.push(this._runtime.setBreakPoint({
                uri: this._mapLocalFiletoUrl(breakpoint.path),
                line: this.convertClientColumnToDebugger(breakpoint.line),
                column: this.convertClientColumnToDebugger(breakpoint.column),
                condition: breakpoint.condition,
                expr: breakpoint.expr
            } as XqyBreakPoint))
        })

        Promise.all(xqyRequests).then().catch(error => {
            this._handleError(error)
        })
    }

    protected async launchRequest(response: DebugProtocol.LaunchResponse, args: LaunchRequestArguments): Promise<void> {
        logger.setup(args.trace ? Logger.LogLevel.Verbose : Logger.LogLevel.Stop, false)
        await this._configurationDone.wait(1000)

        try {
            const results = await this._runtime.launchWithDebugEval(args.program)
            const rid = 99
            this._runtime.setRid(rid)
            this._runtime.setRunTimeState('launched')
            this._stackRespString = await this._runtime.waitUntilPaused()
            await this._setBufferedBreakPoints()
            this.sendResponse(response)
            this.sendEvent(new StoppedEvent('entry', XqyDebugSession.THREAD_ID))
        } catch(error) {
            this._handleError(error, 'Error launching XQY request', true, 'launchRequest')
        }
    }

    protected async attachRequest(response: DebugProtocol.AttachResponse, args: AttachRequestArguments): Promise<void> {
        logger.setup(Logger.LogLevel.Stop, false)
        await this._configurationDone.wait(1000)
        this._runtime
    }

    protected setBreakPointsRequest(response: DebugProtocol.SetDataBreakpointsResponse, args: DebugProtocol.SetBreakpointsArguments): void {
        const path = args.source.path as string
        const clientLines = args.lines || []

        this._runtime.clearBreakPoints(path)

        const actualBreakpoints = clientLines.map(l => {
            const { verified, line, id } = this._runtime.setBreakPoint(path, this.convertClientColumnToDebugger(l))
            const bp = new Breakpoint(verified, this.convertDebuggerLineToClient(line)) as DebugProtocol.Breakpoint
            bp.id = id
            return bp
        })

        response.body = {
            breakpoints: actualBreakpoints
        }
        this.sendResponse(response)
    }

    protected breakpointLocationsRequest(
        response: DebugProtocol.BreakpointLocationsResponse,
        args: DebugProtocol.BreakpointLocationsArguments,
        request: DebugProtocol.Request): void {
        if (args.source.path) {
            const bps = this._runtime.getBreakpoints(args.source.path, this.convertClientLineToDebugger(args.line))
            response.body = {
                breakpoints: bps.map(col => {
                    return {
                        line: args.line,
                        column: this.convertDebuggerColumnToClient(col)
                    }
                })
            }
        } else {
            response.body = {
                breakpoints: []
            }
        }
        this.sendResponse(response)
    }

    protected threadsRequest(response: DebugProtocol.ThreadsResponse): void {
        response.body = {
            threads: [
                new Thread(XqyDebugSession.THREAD_ID, 'thread 1 (single threaded)')
            ]
        }
        this.sendResponse(response)
    }

    protected stackTraceRequest(response: DebugProtocol.StackTraceResponse, args: DebugProtocol.StackTraceArguments): void {
        const startFrame = typeof args.startFrame === 'number' ? args.startFrame : 0
        const maxLevels = typeof args.levels === 'number' ? args.levels : 1000
        const endFrame = startFrame + maxLevels

        const stk: Stack = this._runtime.stack(startFrame, endFrame)

        response.body = {
            stackFrames: stk.frames.map(f  => new StackFrame(f.index, f.name, this.createSource(f.file), this.convertDebuggerLineToClient(f.line))),
            totalFrames: stk.count
        }
        this.sendResponse(response)
    }

    protected scopesRequest(response: DebugProtocol.ScopesResponse, args: DebugProtocol.ScopesArguments): void {
        response.body = {
            scopes: [
                new Scope(CNST.LOCAL, this._variableHandles.create(CNST.lOCAL), false),
                new Scope(CNST.GLOBAL, this._variableHandles.create(CNST.gLOBAL), true)
            ]
        }
        this.sendResponse(response)
    }

    protected async variablesRequest(
        response: DebugProtocol.VariablesResponse,
        args: DebugProtocol.VariablesArguments,
        request?: DebugProtocol.Request): Promise<void> {

        const variables: DebugProtocol.Variable[] = []

        if (this._isLongrunning.get(args.variablesReference)) {
            if (request) {
                this._cancelationTokens.set(request.seq, false)
            }
            for (let i = 0; i < 100; i++) {
                await timeout(1000)
                variables.push({
                    name: `i_${i}`,
                    type: 'integer',
                    value: `${i}`,
                    variablesReference: 0
                })
                if (request && this._cancelationTokens.get(request.seq)) {
                    break
                }
            }
            if (request) {
                this._cancelationTokens.delete(request.seq)
            }

        } else {
            const id = this._variableHandles.get(args.variablesReference)

            if (id) {
                variables.push({
                    name: `${id}_f`,
                    type: 'string',
                    value: 'TODO!!1',
                    variablesReference: 0
                })
            }

            const nm = `${id}_long_running`
            const ref = this._variableHandles.create(`${id}_lr`)
            variables.push({
                name: nm,
                type: 'object',
                value: 'TODO',
                variablesReference: ref
            })
            this._isLongrunning.set(ref, true)

        }

        response.body = {
            variables: variables
        }

        this.sendResponse(response)
    }

    protected continueRequest(response: DebugProtocol.ContinueResponse, args: DebugProtocol.ReverseContinueArguments): void {
        this._runtime.continue()
        this.sendResponse(response)
    }

    protected reverseContinueRequest(response: DebugProtocol.ReverseContinueResponse, args: DebugProtocol.ReverseContinueArguments): void {
        this._runtime.continue()
        this.sendResponse(response)
    }

    protected nextRequest(response: DebugProtocol.NextResponse, args: DebugProtocol.NextArguments): void {
        this._runtime.step()
        this.sendResponse(response)
    }

    protected stepBackRequest(response: DebugProtocol.StepBackResponse, args: DebugProtocol.StepBackArguments): void {
        this._runtime.step(true)
        this.sendResponse(response)
    }

    protected evaluateRequest(response: DebugProtocol.EvaluateResponse, args: DebugProtocol.EvaluateArguments): void {
        const reply: string | undefined = undefined

        if (args.context === 'repl') {
            console.info(`eval ${args.context} not yet implemented`)
        }

        this.sendResponse(response)
    }

    protected dataBreakpointInfoRequest(response: DebugProtocol.DataBreakpointInfoResponse, args: DebugProtocol.DataBreakpointInfoArguments): void {
        response.body = {
            dataId: null,
            description: 'cannot break on data access',
            accessTypes: undefined,
            canPersist: false
        }
        if (args.variablesReference && args.name) {
            const id = this._variableHandles.get(args.variablesReference)
            if (id.startsWith('global_')) {
                response.body.dataId = args.name
                response.body.description = args.name
                response.body.accessTypes = ['read']
                response.body.canPersist = true
            }
        }
        this.sendResponse(response)
    }

    protected completionsRequest(response: DebugProtocol.CompletionsResponse, args: DebugProtocol.CompletionsArguments): void {
        response.body = {
            targets: [
                {
                    label: 'item 10',
                    sortText: '10'
                },
                {
                    label: 'item 1',
                    sortText: '01'
                },
                {
                    label: 'item 2',
                    sortText: '02'
                }
            ]
        }
        this.sendResponse(response)
    }

    protected cancelRequest(response: DebugProtocol.CancelResponse, args: DebugProtocol.CancelArguments): void {
        if (args.requestId) {
            this._cancelationTokens.set(args.requestId, true)
        }
    }


}

