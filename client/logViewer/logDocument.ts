import * as vscode from 'vscode'
import * as mlLogs from 'marklogicLogs'
import { curry } from 'conditional-reduce'
import { parse as parseDate, format as formatDate, parseJSON as parseDateJSON } from 'date-fns'
import { Document } from '../virtualDocument'

//TODO: In progress - this will change heavily as the feature is iterated
export class LogDocument extends Document {
    constructor(uri: vscode.Uri, reloadFunc: () => void, decorateFunc: () => void) {
        super(uri, reloadFunc, decorateFunc)
        this.text = 'MarkLogic Log Viewer'
    }

    private _publishedCount = 0;
    //This is mostly for debugging information
    private _lastRawResults = new Map<string, string>();
    //It is assumed that data is written to the text of the document only after order is finalized.
    //  `_lastIndexWritten` puts a bound on ordering entries and order across boundaries is not guaranteed
    //  if data is ordered and written out to document text before "earlier" logs are returned.
    public orderedEntries: mlLogs.Entry[] = [];
    public lastChecked = new Map<string, mlLogs.LastChecked>();
    public connectionSettings: mlLogs.ConnectionSettings;
    public tailTimer: NodeJS.Timeout;

    public processResults(host: string, response: mlLogs.LogResponse): void {
        this.saveRawResults(host + '_' + response.order, response.data)

        if (response.order === 0) {
            //Current document - save size
            this.lastChecked.set(host, { size: response.size })
        }

        const logParser = curry<mlLogs.Entry[]>({
            ErrorLog: this.connectionSettings.useBuiltinErrorParser ?
                () => this.parseErrorLogObject(host, response.data) :
                () => this.parseErrorLog(host, response.data),
            AccessLog: () => this.parseAccessLog(host, response.data),
            RequestLog: () => this.parseRequestLog(host, response.data)
        })
        const entries = logParser(this.connectionSettings.logType)
        this.saveEntries(entries)
    }

    public saveRawResults(host: string, data: string): void {
        this._lastRawResults.set(host, data)
    }

    public saveEntries(entries: mlLogs.Entry[]): void {
        //Results assumed to at least be in local order
        let i = this._publishedCount
        for (let j = 0; j < entries.length; j++) {
            while (i < this.orderedEntries.length && this.orderedEntries[i].time < entries[j].time) i++
            this.orderedEntries.splice(i, 0, entries[j])
            i++
        }
    }

    public clearEntries(): void {
        this.lastChecked.clear()
        this.orderedEntries.length = 0
        this._publishedCount = 0
    }

    public publishEntries(append = false): void {
        const start = append ? this._publishedCount : 0
        const toPublish = this.orderedEntries
            .slice(start)
            .map((entry: mlLogs.Entry) => this.formatEntry(entry))
            .join('\n')
        this.text = append ? this.text + '\n' + toPublish : `###MarkLogic ${this.connectionSettings.logType}###\n` + toPublish
        this._publishedCount = this.orderedEntries.length
    }

    public formatEntry(entry: mlLogs.Entry): string {
        return `${formatDate(entry.time, 'ccc HH:mm:ss X')}|${entry.host}|${entry.message}`
    }

    public parseErrorLog(host: string, rawResults: string): mlLogs.Entry[] {
        //TODO: This is very basic and can definitely be improved
        const regex = /^(?<time>\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3}) (?<severity>\w*):(?<multiline>[ |+])(?<message>.*)/
        const parsedResults: mlLogs.Entry[] = rawResults.split('\n')
            .filter(entry => regex.test(entry))
            .map((entry): mlLogs.Entry => {
                const parsed = entry.match(regex)
                return {
                    host: host,
                    raw: entry,
                    time: parseDate(parsed.groups['time'], 'yyyy-MM-dd HH:mm:ss.SSS', new Date(1900, 0, 1)),
                    message: parsed.groups['severity'] + ':' + parsed.groups['multiline'] + parsed.groups['message']
                }
            })
        return parsedResults
    }

    public parseErrorLogObject(host:string, rawResults: string): mlLogs.Entry[] {
        throw new Error('Not Implemented')
    }

    public parseAccessLog(host:string, rawResults: string): mlLogs.Entry[] {
        //TODO: Use a NCSA parser such as https://github.com/terribleplan/ncsa-parser
        const regex = /(?<source>.+) \[(?<time>\d{2}\/\w+\/\d{4}:\d{2}:\d{2}:\d{2} [+-]\d{4})\] (?<details>.+)/
        const parsedResults: mlLogs.Entry[] = rawResults.split('\n')
            .filter(entry => regex.test(entry))
            .map((entry): mlLogs.Entry => {
                const parsed = entry.match(regex)
                return {
                    host: host,
                    raw: entry,
                    time: parseDate(parsed.groups['time'], 'dd/MMM/yyyy:HH:mm:ss XX', new Date(1900, 0, 1)),
                    message: parsed.groups['source'] + ': ' + parsed.groups['details']
                }
            })
        return parsedResults
    }

    public parseRequestLog(host:string, rawResults: string): mlLogs.Entry[] {
        //TODO: This is very basic and can definitely be improved
        const parsedResults: mlLogs.Entry[] = rawResults.split('\n')
            .filter(entry => entry != '')
            .map((entry): mlLogs.Entry => {
                const parsed: {time: string} = JSON.parse(entry)
                return {
                    host: host,
                    raw: entry,
                    time: parseDateJSON(parsed.time),
                    message: Object.keys(parsed)
                        .filter(key => key != 'time')
                        .map(key => `${key}: ${parsed[key]}`)
                        .join(', ')
                }
            })
        return parsedResults
    }

    public dispose(): void {
        //Remove tail timer so VSCode doesn't continue to poll ML forever
        //  NOTE: This may take up to 3 minutes after the user closes the document
        //  https://github.com/microsoft/vscode/issues/84505
        clearTimeout(this.tailTimer)
        super.dispose()
    }
}
