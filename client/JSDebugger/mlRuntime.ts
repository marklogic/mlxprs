/*
 * Copyright (c) 2020 MarkLogic Corporation
 */

import { EventEmitter } from 'events';
//@ts-ignore
import * as request from 'request-promise';
import * as fs from 'fs';
import * as querystring from 'querystring';

/**Interfaces defined for Debugger Response*/

export interface V8Frame {
	callFrameId: string;
	functionName?: string;
	functionLocation?: object;
	location: {
		scriptId:string,
		lineNumber:number,
		columnNumber:number
	};
	url: string;
	scopeChain: ScopeObject[];
	this: V8PropertyValue;
}

export interface ScopeObject {
	type: string;
	object: V8PropertyValue;
}

export interface V8PropertyObject {
	name: string;
	value: V8PropertyValue;
	writable?: boolean;
	configurable?: boolean;
	enumerable?:boolean;
	isOwn?:boolean;
}

export interface V8PropertyValue {
	type: string;
	value?: any;
	classname?: string;
	description?: string;
	objectId?: string;
}

export interface MLbreakPoint {
	url:string;
	line:number;
	column?:number;
	condition?:string;
}

export class MLRuntime extends EventEmitter {
	//Config
	private _hostName:string = "";
	// private _serverName;
	private _username:string = "";
	private _password:string = "";
	private _rid:string = "";
	private _timeout = 1;

	//Internal
	private _runTimeState: "shutdown" | "launched" | "attached" | "error" = "shutdown";

	constructor() {
		super();
	}

	public getRunTimeState(){
		return this._runTimeState;
	}

	public setRunTimeState(state: "shutdown" | "launched" | "attached"){
		this._runTimeState = state;
	}

	public launchWithDebugEval(scriptLocation:string, database:string, txnId:string, modules:string, root:string): Promise<string> {
		const script = fs.readFileSync(scriptLocation).toString();
		this.setRunTimeState("launched");

		return this._sendMLdebugEvalRequest(script,database,txnId,modules,root);
	}

	public initialize(args: any) {
		//placeholder for now
		this._hostName = args.hostname;
		this._username = args.username;
		this._password = args.password;
	}

	public setRid(rid:string) {
		this._rid = rid;
	}

	public getRid():string {
		return this._rid;
	}

	public resume():Promise<string> {
		return this._sendMLdebugRequestPOST("resume");
	}
	public stepOver():Promise<string> {
		return this._sendMLdebugRequestPOST("step-over");
	}
	public stepInto():Promise<string> {
		return this._sendMLdebugRequestPOST("step-into");
	}
	public stepOut():Promise<string> {
		return this._sendMLdebugRequestPOST("step-out");
	}

	public getStackTrace(): Promise<string> {
		return this._sendMLdebugRequestGET("stack-trace");
	}

	public setBreakPoint(location: MLbreakPoint): Promise<string> {
		let body = `url=${location.url}&lno=${location.line}`;
		if(location.column){
			body = body.concat(`&cno=${location.column}`);
		}
		if(location.condition){
			body = body.concat(`&condition=${location.condition}`);
		}
		return this._sendMLdebugRequestPOST("set-breakpoint",body);
	}

	public removeBreakPoint(location: MLbreakPoint): Promise<string> {
		let body = `url=${location.url}&lno=${location.line}`;
		if(location.column){
			body = body.concat(`&cno=${location.column}`);
		}
		return this._sendMLdebugRequestPOST("remove-breakpoint",body);
	}

	public wait(): Promise<string> {
		const body = "time-out=5";
		return this._sendMLdebugRequestPOST("wait",body);
	}

	public evaluateOnCallFrame(expr: string,cid?: string): Promise<string> {
		const qs:any = {expr:expr};
		if (cid !== "") {qs["call-frame"] = cid;}
		return this._sendMLdebugRequestGET("eval-on-call-frame",qs);
	}

	public getProperties(objectId: string): Promise<string> {
		//temporary
		// const obj = JSON.parse(objectId)
		const queryString = {
			"object-id": objectId
		};
		return this._sendMLdebugRequestGET("properties",queryString);
	}

	public disable(): Promise<string> {
		return this._sendMLdebugRequestPOST("disable");
	}

	public terminate(): Promise<string> {
		const data = "server-name=TaskServer"
		return this._sendMLdebugRequestPOST("request-cancel",data);
	}

	public async waitTillPaused(): Promise<string> {
		try{
			let result = await this.wait();
			if(result === "") {return this.waitTillPaused();}
			else {return result;}
		} catch(e) {
			throw e;
		}
	}

	/** Replaced with wait() function, keep it for now */
	// public checkRequestStatus(action: string) {
	// 	this._sendMLdebugRequest("requestStatus").then(
	// 		result => {
	// 			// console.log(result)
	// 			if(result== ""){
	// 				this.sendEvent('end');
	// 				this.requestStatus = "end";
	// 				return;
	// 			}
	// 			const status = JSON.parse( result.split("\r\n\r\n")[1].split("\r\n")[0]).requestState
	// 			if(status == "stopped") {
	// 				if(action == "step") this.sendEvent('stopOnStep');
	// 				else this.sendEvent("stopOnBreakpoint");
	// 			} else if(status == "running") {
	// 				setTimeout(() => this.checkRequestStatus(action), 200);
	// 			}
	// 		}
	// 	).catch(
	// 		err => {
	// 			console.log(err)
	// 		}
	// 	)
	// }

	//---- helpers

	private _sendMLdebugRequestPOST(module:string, body?: string): Promise<string>{
		const url = `http://${this._hostName}:8002/jsdbg/v1/${module}/${this._rid}`;
		const options:any = {
			auth: {
				user: this._username,
				pass: this._password,
				'sendImmediately': false
			}
		};
		if(body) {options.body = body;}
		return request.post(url, options);
	}

	private _sendMLdebugRequestGET(module:string, queryString?: object): Promise<string> {
		const url = `http://${this._hostName}:8002/jsdbg/v1/${module}/${this._rid}`;
		const options:any = {
			auth: {
				user: this._username,
				pass: this._password,
				'sendImmediately': false
			}
		};
		if(queryString) {options.qs = queryString;}
		return request.get(url,options);
	}

	private _sendMLdebugEvalRequest(script: string, database:string, txnId:string, modules:string, root:string): Promise<string> {
		const url = `http://${this._hostName}:8002/jsdbg/v1/eval`;
		const options = {
			headers : {
				'Content-type': 'application/x-www-form-urlencoded'
			},
			auth: {
				user: this._username,
				pass: this._password,
				'sendImmediately': false
				},
			body: `javascript=${querystring.escape(script)}`
		};
		if(database) options.body += `&database=${database}`;
		if(txnId) options.body += `&txnId=${txnId}`;
		if(modules) options.body += `&modules=${modules}`;
		if(root) options.body += `&root=${root}`;
		return request.post(url, options);
	}

	// private _sendTerminateRequest(): Promise<string> {

	// }
}

/*  Mapping between local file (be it local copy of module or a script to be evaled)
	and remote file in MarkLogic Server
*/
// class Mapper {

// }