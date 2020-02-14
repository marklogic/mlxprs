import { EventEmitter } from 'events'
import * as CNST from './debugConstants'
import { Memento, WorkspaceConfiguration } from 'vscode'
import { MarklogicVSClient, getDbClient } from '../client/marklogicClient'
export interface XqyBreakpoint {
    id: number;
    line: number;
    verified: boolean;
}

export interface ProtoStackFrame {
    index: number;
    name: string;
    file: string;
    line: number;
}

export interface Stack {
    frames: Array<ProtoStackFrame>;
    count: number;
}

export class XqyRuntime extends EventEmitter {

    private _sourceCode: string
    public get sourceFile(): string {
        return this._sourceCode
    }

    private _sourceLines: string[]
    private _currentLine = 0
    private _breakPoints = new Map<string, XqyBreakpoint[]>()
    private _breakPointId = 1
    private _breakAddresses = new Set<string>()

    private mlClient: MarklogicVSClient

    public setMlClient(state: Memento, cfg: WorkspaceConfiguration): void {
        this.mlClient = getDbClient('', CNST.XQY, cfg, state)
    }

    constructor() {
        super()
    }

    private loadSource(sourceCode: string): void {
        if (this._sourceCode !== sourceCode) {
            this._sourceLines = this._sourceCode.split('\n')
        }
    }

    private verifyBreakpoints(path: string): void {
        const bps = this._breakPoints.get(path)
        if (bps) {
            this.loadSource(path)
            bps.forEach(bp => {
                if (bp.verified && bp.line < this._sourceLines.length) {
                    const srcLine = this._sourceLines[bp.line].trim()
                }
            })
        }
    }

    private sendEvent(event: string, ... args: any[]) {
        setImmediate(_ => {
            this.emit(event, ...args)
        })
    }

    private fireEventsForLine(ln: number, stepEvent?: string): boolean {
        const line = this._sourceLines[ln].trim()

        const words = line.split(' ')
        for (const word of words) {
            if (this._breakAddresses.has(word)) {
                this.sendEvent(CNST.STOPONDATABREAKPOINT)
                return true
            }
        }

        if (line.indexOf(CNST.EXCEPTION) >= 0) {
            this.sendEvent(CNST.STOPONEXCEPTION)
            return true
        }

        const breakpoints = this._breakPoints.get(this._sourceCode)
        if (breakpoints) {
            const bps = breakpoints.filter(bp => bp.line === ln)
            if (bps.length > 0) {
                this.sendEvent(CNST.STOPONBREAKPOINT)

                if (!bps[0].verified) {
                    bps[0].verified = true
                    this.sendEvent(CNST.BREAKPOINTVALIDATED, bps[0])
                }
                return true
            }
        }

        if (stepEvent && line.length > 0) {
            this.sendEvent(stepEvent)
            return true
        }

        return false
    }

    private run(reverse = false, stepEvent?: string): boolean | void {
        if (reverse) {
            for (let ln = this._currentLine - 1; ln >= 0; ln--) {
                if (this.fireEventsForLine(ln, stepEvent)) {
                    this._currentLine = ln
                    return
                }
            }
            this._currentLine = 0
            this.sendEvent(CNST.STOPONENTRY)
        } else {
            for(let ln = this._currentLine + 1; ln < this._sourceLines.length; ln++) {
                if (this.fireEventsForLine(ln, stepEvent)) {
                    this._currentLine = ln
                    return true
                }
            }
            this.sendEvent(CNST.END)
        }
    }

    public step(reverse = false, event = CNST.STOPONSTEP): boolean | void {
        this.run(reverse, event)
    }

    public continue(reverse = false, event = CNST.STOPONSTEP): boolean | void {
        this.run(reverse, event)
    }

    public start(program: string, stopOnEntry: boolean): boolean | void {
        this.loadSource(program)
        this._currentLine = -1

        this.verifyBreakpoints(this._sourceCode)

        if (stopOnEntry) {
            this.step(false, CNST.STOPONENTRY)
        } else {
            this.continue()
        }
    }

    public clearBreakPoint(path: string, line: number): XqyBreakpoint | undefined {
        const bps = this._breakPoints.get(path)
        if (bps) {
            const index = bps.findIndex(bp => bp.line === line)
            if (index >= 0) {
                const bp = bps[index]
                bps.splice(index, 1)
                return bp
            }
        }
        return undefined
    }

    public clearBreakPoints(path: string): void {
        this._breakPoints.delete(path)
    }

    public clearAllDataBreakpoints(): void {
        this._breakAddresses.clear()
    }

    public setBreakPoint(path: string, line: number): XqyBreakpoint | undefined {
        const bp = { verified: false, line, id: this._breakPointId++ } as XqyBreakpoint
        let bps = this._breakPoints.get(path)
        if (!bps) {
            bps = new Array<XqyBreakpoint>()
            this._breakPoints.set(path, bps)
        }
        bps.push(bp)
        this.verifyBreakpoints(path)
        return bp
    }

    public stack(startFrame: number, endFrame: number): Stack {
        const frames = new Array<ProtoStackFrame>()
        frames.push({
            index: 0,
            name: 'TODO!',
            file: this._sourceCode,
            line: this._currentLine
        })
        frames.push({
            index: 1,
            name: 'STILL TODO!',
            file: this._sourceCode,
            line: this._currentLine
        })
        return {
            frames: frames,
            count: 2
        }
    }

    public getBreakpoints(path: string, line: number): number[] {
        const l = this._sourceLines[line]

        let sawSpace = true
        const bps: number[] = []
        for (let i = 0; i < l.length; i++) {
            if (l[i] !== ' ') {
                if (sawSpace) {
                    bps.push(i)
                    sawSpace = false
                }
            } else {
                sawSpace = true
            }
        }
        return bps
    }

}
