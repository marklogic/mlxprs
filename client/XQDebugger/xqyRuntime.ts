import { EventEmitter } from 'events'
import { ResultProvider } from 'marklogic'
import { InitializeRequestArguments } from './xqyDebug'
import { sendXQuery, MarklogicClient, MlClientParameters } from '../marklogicClient'
import { parseString } from 'xml2js'
import { ModuleContentHandler } from '../moduleContentHandler'

export interface XqyBreakPoint {
    uri: string;      // module URI on MarkLogic
    filePath: string; // local file location
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
    column: number;
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
    value?: string;
}

export class XqyRuntime extends EventEmitter {

    private _mlClient: MarklogicClient
    private _mlModuleGetter: ModuleContentHandler
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

    /**
     *
     * @param query full text of query to run in debug mode on MarkLogic
     * @returns the request-id of the launched query presently getting debugged
     */
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
                    XqyRuntime.reportError(error, 'launchWithDebugEval')
                    this._runTimeState = 'error'
                    return ''
                })
    }

    public initialize(args: InitializeRequestArguments): void {
        this._clientParams = args.clientParams
        this._mlClient = new MarklogicClient(this._clientParams)
    }

    private sendFreshQuery(query: string, prefix: 'xdmp' | 'dbg' = 'xdmp'): ResultProvider<Record<string, any>> {
        this._mlClient = new MarklogicClient(this._clientParams)
        return sendXQuery(this._mlClient, query, prefix)
    }

    public async getModuleContent(modulePath: string): Promise<string> {
        this._mlClient = new MarklogicClient(this._clientParams)
        this._mlModuleGetter = new ModuleContentHandler(this._mlClient)
        return this._mlModuleGetter.readTextDocumentContent(modulePath)
    }

    public setRid(rid: string): void {
        this._rid = rid
    }

    public getRid(): string {
        return this._rid
    }

    public dbgControlCall(call: 'continue' | 'next' | 'step' | 'out' | 'detach'): Promise<void> {
        return this.sendFreshQuery(`dbg:${call}(${this._rid})`)
            .result(
                () => {
                    console.debug(`called dbg:${call}(${this._rid})`)
                },
                (error: Record<string, any>[]) => {
                    console.error(`error in dbg:${call}(): ${JSON.stringify(error)}`)
                })
    }

    private static setBreakPointsQuery(uri: string, lines: number[], rid: string): string {
        return `
        declare variable $uri := '${uri}';
        declare variable $lines := (${lines.toString()});
        declare variable $rid as xs:unsignedLong := ${rid};

    json:to-array(fn:distinct-values(
        let $exprs := $lines ! dbg:line($rid, $uri, .) ! dbg:expr($rid, .)
        for $expr in fn:distinct-values(($exprs[dbg:line = $lines])/dbg:expr-id/fn:data())
        return (
            dbg:break($rid, $expr),
            dbg:expr($rid, $expr)/dbg:line/fn:data()
          )))`
    }

    private static removeBreakPointsQuery(uri: string, rid: string): string {
        return `
        declare variable $uri := '${uri}';
        declare variable $rid as xs:unsignedLong := ${rid};

        let $exprs as element(dbg:expr)* := dbg:breakpoints($rid) ! dbg:expr($rid, .)
        for $expr in fn:distinct-values($exprs[dbg:uri/fn:string() = $uri]/dbg:expr-id/fn:data())

        return dbg:clear($rid, $expr)`
    }

    /**
     * Set the breakpoints in MarkLogic. Old breakpoint settings will get cleared
     * and overwritten with what's given here.
     * @param uri Module URI on MarkLogic. Blank string for the top-level query
     * @param lines line numbers in MarkLogic to add breakpoints (keep in mind the +1 for 'cache-buster' line)
     * @returns array of line numbers for which a breakpoint was successfully set
     */
    public setBreakPointsOnMl(uri: string, lines: number[]): Promise<number[]> {
        const q = XqyRuntime.setBreakPointsQuery(uri, lines, this._rid)
        return this.removeBreakPointsOnMl(uri).then(() => {
            return this.sendFreshQuery(q)
                .result(
                    (fulfill: Record<string, number[]>[]) => {
                        console.debug(`set ${fulfill[0]['value'].length} breakpoints for ${uri} on ${this._rid}`)
                        return fulfill[0]['value']
                    },
                    (error: Record<string, any>[]) => {
                        XqyRuntime.reportError(error, 'setBreakPointsOnMl')
                        return []
                    })
        })
    }

    private removeBreakPointsOnMl(uri: string): Promise<void> {
        const q = XqyRuntime.removeBreakPointsQuery(uri, this._rid)
        return this.sendFreshQuery(q)
            .result(
                () => {
                    console.debug(`removed breakpoints for ${uri} on ${this._rid}`)
                },
                (error: Record<string, any>[]) => {
                    XqyRuntime.reportError(error, 'removeBreakPointsOnMl')
                })
    }

    public removeAllBreakPointsOnMl(): Promise<void> {
        return this.sendFreshQuery(`dbg:breakpoints(${this._rid}) ! dbg:clear(${this._rid}, .)`)
            .result(
                (fulfill: Record<string, unknown>[]) => {
                    console.debug(`cleared breakpoints on ${this._rid}`)
                },
                (error: Record<string, any>[]) => {
                    XqyRuntime.reportError(error, 'removeAllBreakPointsOnMl')
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
                })
    }

    /**
     * Run a query in the context of a stopped debug process, using dbg:value($this._rid, ${query})
     * @param query query to be evaluated in context of stopped request
     * @returns results of the eval
     */
    public evaluateInContext(query: string): Promise<any> {
        return this.sendFreshQuery(`dbg:value(${this._rid}, "${query}")`)
            .result(
                (fulfill: Record<string, any>[]) => {
                    return fulfill[0]
                },
                (error: Record<string, any>[]) => {
                    console.error(
                        `error on dbg:value(${this._rid}, "${query}"): ${JSON.stringify(error)}`)
                    return error
                })
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

    private static parseVariableXML(v: any): XqyVariable {
        return {
            name: v.name[0]._,
            prefix: v.prefix ? v.prefix[0] : '',
            value: v.value ? v.value[0] : undefined
        } as XqyVariable
    }

    public static parseScopeXML(frameObj: any): Array<XqyScopeObject> {
        const globalScope: XqyScopeObject = { type: 'global', variables: [] } as XqyScopeObject
        const externalScope: XqyScopeObject = { type: 'external', variables: [] } as XqyScopeObject
        const localScope: XqyScopeObject = { type: 'local', variables: [] } as XqyScopeObject

        const globalScopeXMLObj = frameObj['global-variables'][0]
        const externalScopeXMLObj = frameObj['external-variables'][0]
        const localScopeXMLObj = frameObj.variables ? frameObj.variables[0] : {}

        const scopesToReturn = []
        if (globalScopeXMLObj) {
            globalScopeXMLObj['global-variable'].forEach(gv => {
                globalScope.variables.push(this.parseVariableXML(gv))
            })
            scopesToReturn.push(globalScope)
        }
        if (externalScopeXMLObj) {
            externalScopeXMLObj['external-variable'].forEach(ev => {
                externalScope.variables.push(this.parseVariableXML(ev))
            })
            scopesToReturn.push(externalScope)
        }
        if (localScopeXMLObj.variable) {
            localScopeXMLObj.variable.forEach(v => {
                localScope.variables.push(this.parseVariableXML(v))
            })
            scopesToReturn.push(localScope)
        }
        return scopesToReturn
    }

    public static parseStackXML(stackXMLString: string): Array<XqyFrame> {
        let parsed: any
        const stackArray: Array<XqyFrame> = []
        parseString(stackXMLString, (err: Error, result: any) => {
            parsed = result
            const expr: any = parsed.stack.expr[0]
            const exprId: string = expr['expr-id'][0]
            const uri: string = expr.uri[0]
            const operation: string = expr['expr-source'][0]

            stackArray.push({
                uri: uri,
                line: Number(expr.line[0]),
                column: Number(expr.column[0]),
                operation: operation,
                xid: exprId,
                scopeChain: this.parseScopeXML(expr)
            } as XqyFrame)

            for (let i = 0; i < parsed.stack.frame.length; i++) {
                const frame: any = parsed.stack.frame[i]
                const scopeChain: XqyScopeObject[] = this.parseScopeXML(frame)
                stackArray.push({
                    uri: frame.uri,
                    line: Number(frame.line[0]),
                    column: Number(expr.column[0]),
                    operation: frame.operation ? frame.operation[0] : '<anonymous>',
                    xid: exprId,
                    scopeChain: scopeChain
                } as XqyFrame)
                // include local variables, if present, in the expr scope
                if (i === 0) {
                    stackArray[0].scopeChain = scopeChain
                }
            }
        })
        return stackArray
    }

    public async getCurrentStack(): Promise<Array<XqyFrame>> {
        // This is usually called immediately after a dbg control call, so the
        // request may not have been stopped by the time we get here. 60ms delay
        // should be enough time to wait, without bothering the user
        await new Promise(resolve => setTimeout(resolve, 60))

        return this.sendFreshQuery(`dbg:stack(${this._rid})`).result(
            (fulfill: Record<string, any>) => {
                console.debug('stack: ' + JSON.stringify(fulfill[0].value))
                return XqyRuntime.parseStackXML(fulfill[0].value)
            },
            (error: Record<string, any>) => {
                // combined with the 60 ms delay above, retry if the request
                // hasn't been stopped yet
                if (error.body.errorResponse.messageCode === 'DBG-NOTSTOPPED') {
                    console.debug(`Request ${this._rid} not yet stopped`)
                    return this.getCurrentStack()
                }
                console.error('error (stack): ' + JSON.stringify(error))
                throw error
            })
    }

    private static reportError(error: any, functionName: string): void {
        const informativeMessage = error.body.errorResponse.message || JSON.stringify(error)
        console.error(`error (${functionName}): ${informativeMessage}`)
    }
}
