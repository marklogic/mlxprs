import { EventEmitter } from 'events'
import { ResultProvider } from 'marklogic'
import { LaunchRequestArguments } from './xqyDebug'
import { sendXQuery, MarklogicClient, MlClientParameters } from '../marklogicClient'
import { parseString } from 'xml2js'

export interface XqyBreakPoint {
    uri: string;
    line: number;
    column?: number;
    condition?: string;
    expr: Array<XqyExpr>;

}

export interface XqyExpr {
    id: string;
    source: string;
    uri?: string;
    line: number;
    statements: string[];
}

export interface XqyFrame {
    uri: string;
    line: number;
    operation?: string;
    xid?: string;       // xpath to the frame in the debug:stack element
    scopeChain: XqyScopeObject[];
}

export interface XqyScopeObject {
    type: 'global' | 'external' | 'local';
    variables: XqyVariable[];
}

export interface XqyVariable {
    name: string;
    prefix: string;
}

export class XqyRuntime extends EventEmitter {

    private _mlClient: MarklogicClient
    private _clientParams: MlClientParameters
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

    public launchWithDebugEval(query: string): Promise<string> {
        return this.sendFreshQuery(query, 'dbg')
            .result(
                (fulfill: Record<string, any>) => {
                    console.log('fulfill (dbg): ' + JSON.stringify(fulfill))
                    this._rid = fulfill[0]['value']
                    this.setRunTimeState('launched')
                    return this._rid
                },
                (error: Record<string, any>) => {
                    console.log('error (dbg): ' + JSON.stringify(error))
                    this._runTimeState = 'error'
                    return ''
                })
    }

    public initialize(args: LaunchRequestArguments): void {
        this._clientParams = args.clientParams
        this._mlClient = new MarklogicClient(this._clientParams)
    }

    private sendFreshQuery(query: string, prefix: 'xdmp' | 'dbg' = 'xdmp'): ResultProvider<Record<string, any>> {
        this._mlClient = new MarklogicClient(this._clientParams)
        return sendXQuery(this._mlClient, query, prefix)
    }

    public setRid(rid: string): void {
        this._rid = rid
    }

    public getRid(): string {
        return this._rid
    }

    public resume(): ResultProvider<Record<string, any>> {
	    return sendXQuery(this._mlClient, `dbg:continue(${this._rid})`)
    }

    public stepOver(): ResultProvider<Record<string, any>> {
        return sendXQuery(this._mlClient, `dbg:next(${this._rid})`)
    }

    public stepInto(): ResultProvider<Record<string, any>> {
        return sendXQuery(this._mlClient, `dbg:step(${this._rid})`)
    }

    public stepOut(): ResultProvider<Record<string, any>> {
        return sendXQuery(this._mlClient, `dbg:out(${this._rid})`)
    }

    public getStackTrace(): ResultProvider<Record<string, any>> {
        return sendXQuery(this._mlClient, `dbg:stack(${this._rid})`)
    }

    /**
     * XQuery fns dbg:clear() and and dbg:break() require expression IDs, not lines,
     * in order to clear andset breakpoints.
     *
     * @param location
     * @return expression ID as a string
     */
    private findBreakPointExpr(location: XqyBreakPoint): Promise<Array<string>> {
        const findExprQuery =
        `try {
            <a>{dbg:line(${this._rid}, "${location.uri}", ${location.line}) ! dbg:expr(${this._rid}, .)}</a>
        } catch($e) {
            <a>{dbg:line(${this._rid}, "", ${location.line}) ! dbg:expr(${this._rid}, .)}</a>
        }`
        return this.sendFreshQuery(findExprQuery)
            .result(
                (fulfill: Record<string, any>[]) => {
                    console.info('fulfull fbpe: ' + JSON.stringify(fulfill))
                    try {
                        location.expr = XqyRuntime.parseExprXML(fulfill[0]['value'])
                        return location.expr.map((e: XqyExpr) => e.id)
                    } catch (err) {
                        console.error(`Failed parsing dbg:line(): ${JSON.stringify(err)}`)
                        location.expr = null
                        return []
                    }
                },
                (error: Record<string, any>[]) => {
                    console.error('error fbpe: ' + JSON.stringify(error))
                    return []
                })
    }

    /**
     * Set a breakpoint on MarkLogic server. If we don't know the `<expr/>` for
     * the location, look it up first and then set the breakpoint.
     *
     * Uses `dbg:break()`
     *
     * @param location: The XqyBreakPoint to be set
     *
     */
    public setBreakPoint(location: XqyBreakPoint): Promise<void> {
        if (!location.expr) {
            return this.findBreakPointExpr(location).then((exprIds: string[]) => {
                exprIds.forEach((exprId: string) => this.setBreakPointOnMl(exprId))
            })
        } else {
            const exprIds: string[] = location.expr.map(e => e.id)
            exprIds.forEach((exprId: string) => this.setBreakPointOnMl(exprId))
            return null
        }
    }

    public removeBreakPoint(location: XqyBreakPoint): Promise<void> {
        if (!location.expr) {
            return this.findBreakPointExpr(location).then((exprIds: string[]) => {
                exprIds.forEach((exprId: string) => this.removeBreakPointOnMl(exprId))
            })
        } else {
            const exprIds: string[] = location.expr.map(e => e.id)
            exprIds.forEach((exprId: string) => this.removeBreakPointOnMl(exprId))
            return null
        }
    }

    private setBreakPointOnMl(exprId: string): Promise<void> {
        return this.sendFreshQuery(`dbg:break(${this._rid}, ${exprId})`)
            .result(
                (fulfill: Record<string, any>[]) => {
                    console.debug(`set breakpoint on ${this._rid} at ${exprId}`)
                },
                (error: Record<string, any>[]) => {
                    console.info('error: ' + JSON.stringify(error))
                })
    }

    private removeBreakPointOnMl(exprId: string): Promise<void> {
        return this.sendFreshQuery(`dbg:clear(${this._rid}, ${exprId})`)
            .result(
                (fulfill: Record<string, any>[]) => {
                    console.info('fulfull: ' + JSON.stringify(fulfill))
                },
                (error: Record<string, any>[]) => {
                    console.info('error: ' + JSON.stringify(error))
                })
    }

    public wait(): Promise<string> {
        return this.sendFreshQuery(`dbg:wait(${this._rid}, 5)`)
            .result(
                (fulfill: Record<string, any>[]) => {
                    return fulfill[0]['value']
                },
                (error: Record<string, any>[]) => {
                    console.error('error on dbg:wait(): ' + JSON.stringify(error))
                    return ''
                }
            )
    }

    public evaluateInContext(expr: string, cid?: string): ResultProvider<Record<string, any>> {
        return sendXQuery(this._mlClient, `dbg:value(${this._rid}, ${expr})`)
    }

    public async getProperties(objectId: string): Promise<string> {
        return 'not yet implemented'
    }

    public disable(): ResultProvider<Record<string, any>> {
        return sendXQuery(this._mlClient, `dbg:value(${this._rid})`)
    }

    public terminate(): ResultProvider<Record<string, any>> {
        return sendXQuery(this._mlClient, 'dbg:disconnent(xdmp:server())')
    }

    public static parseExprXML(exprXMLString: string): Array<XqyExpr> {
        let parsed: any
        const exprArray: Array<XqyExpr> = []
        parseString(exprXMLString, (err: Error, result: any) => {
            parsed = result
            parsed.a.expr.forEach(expr => {
                exprArray.push({
                    id: expr['expr-id'][0],
                    source: expr['expr-source'][0],
                    uri: expr.uri[0],
                    line: expr.line[0],
                    statements: [] // TODO: find an example, parse it
                })
            })
        })
        return exprArray
    }

    public static parseScopeXML(frameObj: any): Array<XqyScopeObject> {
        const globalScope: XqyScopeObject = {type: 'global', variables: []} as XqyScopeObject
        const externalScope: XqyScopeObject = {type: 'external', variables: []} as XqyScopeObject
        const localScope: XqyScopeObject = {type: 'local', variables: []} as XqyScopeObject

        const globalScopeXMLObj = frameObj['global-variables'][0]
        const externalScopeXMLObj = frameObj['external-variables'][0]
        const localScopeXMLObj = frameObj.variables[0]

        if (globalScopeXMLObj) globalScopeXMLObj['global-variable'].forEach(gv => {
            globalScope.variables.push({
                name: gv.name[0]._,
                prefix: gv.prefix[0] ? gv.prefix[0]._ : ''
            } as XqyVariable)
        })
        if (externalScopeXMLObj) externalScopeXMLObj['external-variable'].forEach(ev => {
            externalScope.variables.push({
                name: ev.name[0]._,
                prefix: ev.prefix ? ev.prefix[0]._ : ''
            })
        })
        if (localScopeXMLObj) localScopeXMLObj['variable'].forEach(v => {
            localScope.variables.push({
                name: v.name[0]._,
                prefix: v.prefix ? v.prefix[0]._ : ''
            })
        })
        return [globalScope, externalScope, localScope]
    }

    public static parseStackXML(stackXMLString: string): Array<XqyFrame> {
        let parsed: any
        const stackArray: Array<XqyFrame> = []
        parseString(stackXMLString, (err: Error, result: any) => {
            parsed = result
            const expr: any = parsed.stack.expr[0]
            const uri: string = expr.uri[0]
            const operation: string = expr['expr-source'][0]
            for (let i = 0; i < parsed.stack.frame.length; i++) {
                stackArray.push({
                    uri: uri,
                    line: Number(parsed.stack.frame[i].line[0]),
                    operation: operation,
                    xid: `/debug:stack/debug:frame[${i}]`,
                    scopeChain: this.parseScopeXML(parsed.stack.frame[i])
                } as XqyFrame)
            }
        })
        return stackArray
    }

    public async getCurrentStack(): Promise<Array<XqyFrame>> {
        return this.sendFreshQuery(`dbg:stack(${this._rid})`).result(
            (fulfill: Record<string, any>) => {
                // TODO: parse frameXML into stack
                console.info('stack: ' + JSON.stringify(fulfill))
                return XqyRuntime.parseStackXML(fulfill[0].value)
            },
            (error: Record<string, any>) => {
                console.info('error (stack): ' + JSON.stringify(error))
                return []
            })
    }
}
