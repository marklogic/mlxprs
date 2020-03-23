import { DebugProtocol } from 'vscode-debugprotocol'
import { Handles, InitializedEvent,
    Logger, logger, LoggingDebugSession,
    StoppedEvent, OutputEvent, Source, TerminatedEvent, Breakpoint, Thread, StackFrame, Scope
} from 'vscode-debugadapter'
import * as CNST from './debugConstants'
// import { XqyRuntime, Stack } from './xqyRuntimeMocked'
import { XqyRuntime } from './xqyRuntime'
import { basename } from 'path'
import { Memento, WorkspaceConfiguration } from 'vscode'
import { MarklogicVSClient } from '../client/marklogicClient'
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

const timeout = (ms: number): Promise<any> => {
    return new Promise(resolve => setTimeout(resolve, ms))
}

export class XqyDebugSession extends LoggingDebugSession {

    private static THREAD_ID = 1
    private requestId: string

    private _runtime: XqyRuntime
    private _variableHandles = new Handles<string>();
	private _configurationDone = new Subject();

    private _cancelationTokens = new Map<number, boolean>()
    private _isLongrunning = new Map<number, boolean>()

    private createSource(filePath: string): Source {
        return new Source(basename(filePath), this.convertDebuggerPathToClient(filePath),
            undefined, undefined, 'data-placeholder')
    }

    public setMlClientContext(state: Memento, cfg: WorkspaceConfiguration): void {
        this._runtime.setMlClient(state, cfg)
    }

    public constructor() {
        super()

        this.requestId = '0'
        this.setDebuggerLinesStartAt1(false)
        this.setDebuggerColumnsStartAt1(false)

        this._runtime = new XqyRuntime()
        this._runtime.on(CNST.STOPONENTRY, () => {
            this.sendEvent(new StoppedEvent(CNST.ENTRY, XqyDebugSession.THREAD_ID))
        })
        this._runtime.on(CNST.STOPONSTEP, () => {
            this.sendEvent(new StoppedEvent(CNST.STEP, XqyDebugSession.THREAD_ID))
        })
        this._runtime.on(CNST.STOPONBREAKPOINT, () => {
            this.sendEvent(new StoppedEvent(CNST.BREAKPOINT, XqyDebugSession.THREAD_ID))
        })
        this._runtime.on(CNST.STOPONDATABREAKPOINT, () => {
            this.sendEvent(new StoppedEvent(CNST.DATABREAKPOINT, XqyDebugSession.THREAD_ID))
        })
        this._runtime.on(CNST.STOPONEXCEPTION, () => {
            this.sendEvent(new StoppedEvent(CNST.EXCEPTION, XqyDebugSession.THREAD_ID))
        })
        this._runtime.on(CNST.BREAKPOINTVALIDATED, () => {
            this.sendEvent(new StoppedEvent(CNST.CHANGED, XqyDebugSession.THREAD_ID))
        })
        this._runtime.on(CNST.OUTPUT, (text, filePath, line, column) => {
            const e: DebugProtocol.OutputEvent = new OutputEvent(`${text}\n`)
            e.body.source = this.createSource(filePath)
            e.body.line = this.convertDebuggerLineToClient(line)
            e.body.column = this.convertDebuggerColumnToClient(column)
            this.sendEvent(e)
        })
        this._runtime.on(CNST.END, () => {
            this.sendEvent(new TerminatedEvent())
        })
    }

    protected initializeRequest(response: DebugProtocol.InitializeResponse, args: DebugProtocol.InitializeRequestArguments): void {
        response.body = response.body || {}
        response.body.supportsConfigurationDoneRequest = true
        response.body.supportsEvaluateForHovers = true
        response.body.supportsStepBack = false
        response.body.supportsDataBreakpoints = true
        response.body.supportsCompletionsRequest = true
        response.body.completionTriggerCharacters = [ ':' ]
        response.body.supportsCancelRequest = true
        response.body.supportsBreakpointLocationsRequest = true

        this.sendResponse(response)
        this.sendEvent(new InitializedEvent())
    }

    protected configurationDoneRequest(response: DebugProtocol.LaunchResponse, args: LaunchRequestArguments): void {
        super.configurationDoneRequest(response, args)
        this._configurationDone.notify()
    }

    protected async launchRequest(response: DebugProtocol.LaunchResponse, args: LaunchRequestArguments): Promise<void> {
        logger.setup(args.trace ? Logger.LogLevel.Verbose : Logger.LogLevel.Stop, false)
        const client: MarklogicVSClient = this._runtime.getMlClient()

        await sendXQuery(client, '1 + 5', 'dbg').result(
            (fulfill: Record<string, any>[]) => {
                const result0: object = fulfill[0]
                this.requestId = result0.value
                response.body = result0
            },
            (error: Record<string, any>[]) => {
                const error0 = error.body.errorResponse
                response.body = {
                    error: error0
                }
            }
        )
        this._runtime.start(args.program, !!args.stopOnEntry)
        this.sendResponse(response)
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

