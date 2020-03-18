/*
 * Copyright (c) 2020 MarkLogic Corporation
 */

import {LoggingDebugSession, Breakpoint, OutputEvent, InitializedEvent, TerminatedEvent, StoppedEvent, Thread, StackFrame, Scope,Source, Handles, Logger,logger} from 'vscode-debugadapter';
import { DebugProtocol } from 'vscode-debugprotocol';
import { basename } from 'path';
import { MLRuntime, MLbreakPoint, V8Frame, ScopeObject,V8PropertyObject,V8PropertyValue } from './mlRuntime';

const { Subject } = require('await-notify');

interface LaunchRequestArguments extends DebugProtocol.LaunchRequestArguments {
	path: string;

	hostname:string;

	username:string;

	password:string;

	rid:string;

	database?:string;

	txnId?:string;
}

interface AttachRequestArguments extends DebugProtocol.AttachRequestArguments {
	path: string;

	hostname:string;

	servername:string;

	username:string;

	password:string;

	rid:string;
}

export class MLDebugSession extends LoggingDebugSession {

	// we don't support multiple threads, so we can use a hardcoded ID for the default thread
	private static THREAD_ID = 1;

	// ML debug runtime
	private _runtime: MLRuntime;
	private _configurationDone = new Subject();
	private _variableHandles = new Handles<string>();
	private _frameHandles = new Handles<V8Frame>();
	private _bpCache = new Set();
	private _stackRespString:string = "";
	private _workDir:string = "";

	// private _traceLevel: "none" | "info" | "detailed" | "all" = "all"

	public constructor() {
		super("ml-debug.txt");
		// this debugger uses zero-based lines and columns
		this.setDebuggerLinesStartAt1(false);
		this.setDebuggerColumnsStartAt1(false);

		this._runtime = new MLRuntime();
	}

	/**
	 * The 'initialize' request is the first request called by the frontend
	 * to interrogate the features the debug adapter provides.
	 */
	protected initializeRequest(response: DebugProtocol.InitializeResponse, args: DebugProtocol.InitializeRequestArguments): void {

		// build and return the capabilities of this debug adapter:
		logger.setup(Logger.LogLevel.Stop, false);

		response.body = response.body || {};

		// the adapter implements the configurationDoneRequest.
		response.body.supportsConfigurationDoneRequest = true;

		// This debug adapter supports function breakpoints.
		response.body.supportsFunctionBreakpoints = false;

		// This debug adapter supports conditional breakpoints.
		response.body.supportsConditionalBreakpoints = true;

		// make VS Code to support completion in REPL
		response.body.supportsCompletionsRequest = true;

		// This debug adapter supports delayed loading of stackframes
		response.body.supportsDelayedStackTraceLoading = false;

		response.body.supportsTerminateRequest = false;

		// response.body.supportsRestartRequest = true;

		response.body.supportsSetVariable = false;

		response.body.supportsRestartFrame = false;

		this.sendResponse(response);

		// since this debug adapter can accept configuration requests like 'setBreakpoint' at any time,
		// we request them early by sending an 'initializeRequest' to the frontend.
		// The frontend will end the configuration sequence by calling 'configurationDone' request.
		this.sendEvent(new InitializedEvent());
	}

	/**
	 * Called at the end of the configuration sequence.
	 * Indicates that all breakpoints etc. have been sent to the DA and that the 'launch' can start.
	 */
	protected configurationDoneRequest(response: DebugProtocol.ConfigurationDoneResponse, args: DebugProtocol.ConfigurationDoneArguments): void {
		super.configurationDoneRequest(response, args);

		// notify the launchRequest that configuration has finished
		this._configurationDone.notify();
	}

	protected async launchRequest(response: DebugProtocol.LaunchResponse, args: LaunchRequestArguments) {
		// temporary
		// started the request in jsdbg.eval()
		logger.setup(Logger.LogLevel.Stop, false);
		await this._configurationDone.wait(1000);
		this._runtime.initialize(args);
		try{
			const result = await this._runtime.launchWithDebugEval(args.path, args.database, args.txnId);
			const rid = JSON.parse(result).requestId;
			this._runtime.setRid(rid);
			// runtime set up
			this._workDir = args.path;
			this._runtime.setRunTimeState("launched");
			this._stackRespString = await this._runtime.waitTillPaused();
			await this._setBufferedBreakPoints();
			this._trace("Launched Request with id: "+ rid);
			this.sendResponse(response);
			this.sendEvent(new StoppedEvent('entry', MLDebugSession.THREAD_ID));
		} catch (err) {
			this._handleError(err,"Error launching request",true,"launchRequest");
		}
	}

	protected async attachRequest(response: DebugProtocol.AttachResponse, args: AttachRequestArguments) {
		logger.setup(Logger.LogLevel.Stop, false);
		await this._configurationDone.wait(1000);
		this._runtime.initialize(args);
		this._runtime.setRid(args.rid);
		this._workDir = args.path;
		this._runtime.setRunTimeState("attached");
		this._stackRespString = await this._runtime.waitTillPaused();
		await this._setBufferedBreakPoints();
		this.sendResponse(response);
		this.sendEvent(new StoppedEvent('entry', MLDebugSession.THREAD_ID));
	}

	protected setBreakPointsRequest(response: DebugProtocol.SetBreakpointsResponse, args: DebugProtocol.SetBreakpointsArguments): void {

		const path = <string>args.source.path;

		const mlrequests:any = [];
		if(args.breakpoints){
			//for response only
			const actualBreakpoints = args.breakpoints.map((b,idx) => {
				const bp = <DebugProtocol.Breakpoint> new Breakpoint(true, b.line, b.column);
				return bp;
			});

			const newBp = new Set();
			args.breakpoints.forEach(breakpoint => {
				newBp.add(JSON.stringify({
					path:path,
					line:breakpoint.line,
					column: breakpoint.column,
					condition: breakpoint.condition
				}));//construct the set of new breakpoints, better ways?
			});

			const toDelete = new Set([...this._bpCache].filter(x => !newBp.has(x)));
			const toAdd = new Set([...newBp].filter(x => !this._bpCache.has(x)));
			this._bpCache = newBp;
			if (this._runtime.getRunTimeState() !== "shutdown") {
				toDelete.forEach(bp => {
					const breakpoint =JSON.parse(String(bp));
					mlrequests.push(this._runtime.removeBreakPoint(<MLbreakPoint>{
						url:this._mapLocalFiletoUrl(breakpoint.path),
						line:this.convertClientLineToDebugger(breakpoint.line),
						column:this.convertClientLineToDebugger(breakpoint.column),
					}));
				});

				toAdd.forEach(bp => {
					const breakpoint =JSON.parse(String(bp));
					mlrequests.push(this._runtime.setBreakPoint(<MLbreakPoint>{
						url:this._mapLocalFiletoUrl(breakpoint.path),
						line:this.convertClientLineToDebugger(breakpoint.line),
						column:this.convertClientLineToDebugger(breakpoint.column),
						condition:breakpoint.condition
					}));
				});

				response.body ={
					breakpoints: actualBreakpoints
				};

				Promise.all(mlrequests).then(()=>{
					this.sendResponse(response);
				}).catch(err=>{
					this._handleError(err,"Error setting breakpoints",false,"setBreakPointsRequest");
				});
			} else {
				response.body ={
					breakpoints: []
				};
				this.sendResponse(response);
			}
		}
	}

	protected threadsRequest(response: DebugProtocol.ThreadsResponse): void {

		// Return dummy thread
		response.body = {
			threads: [
				new Thread(MLDebugSession.THREAD_ID, "ML Request Thread")
			]
		};
		this.sendResponse(response);
	}

	protected stackTraceRequest(response: DebugProtocol.StackTraceResponse, args: DebugProtocol.StackTraceArguments): void {
		try{
			const body = this._stackRespString;
			const stacks = <V8Frame[]>JSON.parse(body);

			const frames: StackFrame[] = [];
			for(let i = 0; i<stacks.length; i++){
				const stk = stacks[i];
				const url = stacks[i].url;
				frames.push(new StackFrame(
					this._frameHandles.create(stk),
					(stk.functionName) ? stk.functionName: "<anonymous>",
					this.createSource(this._mapUrlToLocalFile(url)),
					this.convertDebuggerLineToClient(stk.location.lineNumber),
					this.convertDebuggerLineToClient(stk.location.columnNumber)
				));
			}
			response.body = {
				stackFrames: frames,
				totalFrames: stacks.length
			};
			this.sendResponse(response);
		} catch(e){
			this._handleError(e,"Error reading stack trace",true,"stackTraceRequest");
		}
	}

	protected scopesRequest(response: DebugProtocol.ScopesResponse, args: DebugProtocol.ScopesArguments): void {
		try{
			const scopes: Scope[] = [];
			const v8frame = this._frameHandles.get(args.frameId);
			const scopes_ml = <ScopeObject[]>v8frame.scopeChain;

			for(let i = 0; i<scopes_ml.length; i++){
				const scope = scopes_ml[i];
				const expensive = scope.type === "global"? true:false;

				scopes.push(
					new Scope(scope.type,
						scope.object.objectId? this._variableHandles.create(<string>scope.object.objectId):0,
						expensive),
				);
			}
			response.body = {
				scopes: scopes
			};
			this.sendResponse(response);
		}catch(e){
			this._handleError(e,"Error reading scopes",true, "scopesRequest");
		}
	}

	protected async variablesRequest(response: DebugProtocol.VariablesResponse, args: DebugProtocol.VariablesArguments, request?: DebugProtocol.Request) {
		const variables: DebugProtocol.Variable[] = [];
		const objId = this._variableHandles.get(args.variablesReference);
		this._runtime.getProperties(objId).then(resp => {
			const properties_ml = <V8PropertyObject[]>JSON.parse(resp).result.result; //array of properties
			for(let i = 0; i< properties_ml.length; i++){
				try {
					const element = properties_ml[i];
					// console.log(element);
					let name, type, value;
					name = element.name;
					if(!element.value) {
						variables.push(<DebugProtocol.Variable>{
							name:name,
							value:"null",
							variablesReference:0
						});
						continue;
					}
					type = element.value.type? element.value.type: "undefined";
					if(element.value.value){value = String(element.value.value);}
					else if (element.value.description) {value = String(element.value.description);}
					else {value = "undefined";}
					variables.push(<DebugProtocol.Variable>{
						name:name,
						type:type ,
						value:value,
						variablesReference:element.value.objectId? this._variableHandles.create(element.value.objectId): 0
					});
				} catch(e) {
					this._trace(JSON.stringify(properties_ml[i]));
					this._trace(e.toString());
					this._handleError(e,"Error inspecting variables", false, "variablesRequest");
				}
			}
			response.body = {
				variables: variables
			};
			this.sendResponse(response);
		}).catch(err => {
			this._handleError(err,"Error retrieving variables", false, "variablesRequest");
		});
	}

	protected continueRequest(response: DebugProtocol.ContinueResponse, args: DebugProtocol.ContinueArguments): void {
		this._runtime.resume().then(() => {
			this.sendResponse(response);
			this._runtime.waitTillPaused().then( resp=>{
				this._stackRespString = resp;
				this.sendEvent(new StoppedEvent('breakpoint', MLDebugSession.THREAD_ID));
				this._resetHandles();
			}).catch(err=>{
				this._handleError(err,"Error in waiting request",true,"continueRequest");
			});
		}).catch(err => {
			this._handleError(err,"Error in continue command",true,"continueRequest");
		});
	}

	protected nextRequest(response: DebugProtocol.NextResponse, args: DebugProtocol.NextArguments): void {
		this._runtime.stepOver().then(() => {
			this.sendResponse(response);
			this._runtime.waitTillPaused().then( resp=>{
				this._stackRespString = resp;
				this.sendEvent(new StoppedEvent('step', MLDebugSession.THREAD_ID));
				this._resetHandles();
			}).catch(err=>{
				this._handleError(err,"Error in waiting request",true,"nextRequest");
			});
		}).catch(err => {
			this._handleError(err,"Error in next command", true,"nextRequest");
		});
	}

	protected stepInRequest(response: DebugProtocol.NextResponse, args: DebugProtocol.NextArguments): void {
		this._runtime.stepInto().then(() => {
			this.sendResponse(response);
			this._runtime.waitTillPaused().then( resp=>{
				this._stackRespString = resp;
				this.sendEvent(new StoppedEvent('step', MLDebugSession.THREAD_ID));
				this._resetHandles();
			}).catch(err=>{
				this._handleError(err,"Error in waiting request",true,"stepInRequest");
			});
		}).catch(err => {
				this._handleError(err,"Error in stepIn command",true, "stepInRequest");
		});
	}

	protected stepOutRequest(response: DebugProtocol.NextResponse, args: DebugProtocol.NextArguments): void {
		this._runtime.stepOut().then(() => {
			this.sendResponse(response);
			this._runtime.waitTillPaused().then( resp=>{
				this._stackRespString = resp;
				this.sendEvent(new StoppedEvent('step', MLDebugSession.THREAD_ID));
				this._resetHandles();
			}).catch(err=>{
				this._handleError(err,"Error in waiting request",true, "stepOutRequest");
			});
		}).catch(err => {
			this._handleError(err,"Error in stepOut command",true, "stepOutRequest");
		});
	}

	protected disconnectRequest(response: DebugProtocol.DisconnectResponse, args: DebugProtocol.DisconnectArguments): void {
		if (this._runtime.getRunTimeState() === "launched") {
			this._runtime.setRunTimeState('shutdown');
			this._runtime.terminate().then(() => {
				this.sendResponse(response);
			}).catch((e) => {
				this._handleError(e,"Error terminating request");
			});
		} else if (this._runtime.getRunTimeState() === "attached") {
			this._runtime.setRunTimeState('shutdown');
			this._runtime.disable().then(() => {
				if(args.restart === true){
					this._trace("Restart is not supported for attach, please attach to a new request");
				}
				this.sendResponse(response);
			}).catch((e) => {
				this._handleError(e,"Error disconnecting request");
			});
		} else {
			//do nothing if its already shutdown
		}
	}

	protected evaluateRequest(response: DebugProtocol.EvaluateResponse, args: DebugProtocol.EvaluateArguments): void {
		let cid = "";
		if (typeof args.frameId === 'number' && args.frameId > 0) {
			const frameInfo = this._frameHandles.get(args.frameId);
			cid = frameInfo.callFrameId;
		}
		this._runtime.evaluateOnCallFrame(args.expression, cid).then(resp=> {
			const body = resp;
			const evalResult = <V8PropertyValue>JSON.parse(body).result.result;
			response.body = {
				result: evalResult.value? String(evalResult.value): (evalResult.description? String(evalResult.description): "undefined"),
				type:evalResult.type,
				variablesReference:evalResult.objectId? this._variableHandles.create(evalResult.objectId):0
			};
			this.sendResponse(response);
		}).catch(err=>{
			this._handleError(err,"Error in evaluating expression", false, "evaluateRequest");
		});
	}

	protected completionsRequest(response: DebugProtocol.CompletionsResponse, args: DebugProtocol.CompletionsArguments): void {
		this.sendResponse(response);
	}

	//---- helpers

	private createSource(filePath: string): Source {
		return new Source(basename(filePath), this.convertDebuggerPathToClient(filePath), undefined, undefined, 'ml-adapter-data');
	}

	private _mapUrlToLocalFile(url: string ) {
		return this._workDir + url;
	}

	private _mapLocalFiletoUrl(path: string ) {
		return path.replace(this._workDir,"");
	}

	private _setBufferedBreakPoints() {

		const mlrequests: any[] = [];
		this._bpCache.forEach(bp => {
			const breakpoint =JSON.parse(String(bp));
			mlrequests.push(this._runtime.setBreakPoint(<MLbreakPoint>{
				url:this._mapLocalFiletoUrl(breakpoint.path),
				line:this.convertClientLineToDebugger(breakpoint.line),
				column:this.convertClientLineToDebugger(breakpoint.column),
				condition:breakpoint.condition
			}));
		});

		Promise.all(mlrequests).then().catch(err=>{
			this._handleError(err);
		});
	}

	private _trace(message: string) {
		this.sendEvent(new OutputEvent(message + '\n', 'console'));
	}

	private _resetHandles(){
		this._variableHandles.reset();
		this._frameHandles.reset();
	}

	private _handleError(err: Error, msg?:string, terminate?:boolean, func?:string){
		if (err.message.includes("JSDBG-REQUESTRECOR") || err.message.includes("XDMP-NOREQUEST")){
			this._runtime.setRunTimeState("shutdown");
			this.sendEvent(new TerminatedEvent());
			this._trace(`Request ${this._runtime.getRid()} has ended`);
		} else {
			if(terminate === true) {
				this.sendEvent(new TerminatedEvent());
			}
			if(msg) {
				this._trace(msg);
			}
		}
	}
}


MLDebugSession.run(MLDebugSession);