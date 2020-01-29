import { DebugProtocol } from 'vscode-debugprotocol'
import { Handles, LoggingDebugSession } from 'vscode-debugadapter'

export class XqyDebugSession extends LoggingDebugSession {

    private static THREAD_ID = 1

    private _runtime: XqyRuntime
    private _variableHandles = new Handles<string>();
}

