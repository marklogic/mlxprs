import { EventEmitter } from 'events'

import * as fs from 'fs'
import { ResultProvider } from 'marklogic'

import { sendXQuery } from '../client/queryDirector'
import { MarklogicVSClient } from '../client/marklogicClient'

export interface XqyBreakPoint {
    uri: string;
    line: number;
    column?: number;
    condition?: string;
    expr?: number;
}



export class XqyRuntime extends EventEmitter {

    private _mlClient: MarklogicVSClient
    private _rid = ''
    private _timeout = 1

    public constructor() {
        super()
    }

    private _runTimeState: 'shutdown' | 'launched' | 'attached' | 'error' = 'shutdown';

    public getRunTimeState(): 'shutdown' | 'launched' | 'attached' | 'error' {
	    return this._runTimeState
    }

    public setRunTimeState(state: 'shutdown' | 'launched' | 'attached'): void {
        this._runTimeState = state
    }

    public launchWithDebugEval(scriptLocation: string): Promise<string> {
	    const script = fs.readFileSync(scriptLocation).toString()
	    this.setRunTimeState('launched')

        return sendXQuery(this._mlClient, script, 'dbg')
    }

    public initialize(marklogicClient: MarklogicVSClient): void {
        this._mlClient = marklogicClient
    }

    public setRid(rid: string): void {
        this._rid = rid
    }

    public getRid(): string {
        return this._rid
    }

    public resume(): Promise<string> {
	    return sendXQuery(this._mlClient, `dbg:continue(${this._rid})`)
    }

    public stepOver(): Promise<string> {
        return sendXQuery(this._mlClient, `dbg:next(${this._rid})`)
    }

    public stepInto(): Promise<string> {
        return sendXQuery(this._mlClient, `dbg:step(${this._rid})`)
    }

    public stepOut(): Promise<string> {
        return sendXQuery(this._mlClient, `dbg:out(${this._rid})`)
    }

    public getStackTrace(): Promise<string> {
        return sendXQuery(this._mlClient, `dbg:stack(${this._rid})`)
    }

    private async findBreakPointExpr(location: XqyBreakPoint): Promise<null> {
        return await sendXQuery(this._mlClient, `dbg:line(${this._rid}, ${location.uri}, ${location.line})`)
            .result((fulfill: Record<string, any>[]) => {
                location.expr = fulfill['value'][0]
            })
    }

    public setBreakPoint(location: XqyBreakPoint): Promise<null> {
        if (!location.expr) {
            this.findBreakPointExpr(location)
        }
        return sendXQuery(this._mlClient, `dbg:break(${this._rid}, ${location.expr})`)
    }

    public removeBreakPoint(location: XqyBreakPoint): Promise<null> {
        if (!location.expr) {
            this.findBreakPointExpr(location)
        }
        return sendXQuery(this._mlClient, `dbg:clear(${this._rid}, ${location.expr})`)
    }

    public wait(): Promise<string> {
        return sendXQuery(this._mlClient, `dbg:wait(${this._rid}, 5)`)
    }

    public evaluateInContext(expr: string, cid?: string): ResultProvider<Record<string, any>> {
        return sendXQuery(this._mlClient, `dbg:value(${this._rid}, ${expr})`)
    }

    // public getProperties(): Promise (not sure if we can do this in XQY)

    public disable(): Promise<string> {
        return sendXQuery(this._mlClient, `dbg:value(${this._rid})`)
    }

    public terminate(): Promise<string> {
        return sendXQuery(this._mlClient, 'dbg:disconnent(xdmp:server())')
    }

    public async waitUntilPaused(): Promise<string> {
        try {
            const result = await this.wait()
            if (result === '') {return this.waitUntilPaused()}
            else {return result}
        } catch(e) {
            throw e
        }
    }
}
