import { EventEmitter } from 'events'

export class XqyRuntime extends EventEmitter {

  private _sourceFile: string
  public get sourceFile(): string {
    return this._sourceFile
  }
}
