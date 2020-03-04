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