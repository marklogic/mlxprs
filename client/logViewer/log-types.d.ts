declare module 'marklogicLogs' {

    export type LogType = 'ErrorLog' | 'AccessLog' | 'RequestLog'
    export type LastChecked = LastCheckedTime | LastCheckedSize
    //Actual response from ML will be an array of these
    export type LogResponse = {order: number, size: number, data: string}

    export interface LastCheckedTime {
        time: Date;
    }

    export interface LastCheckedSize {
        size: number;
    }

    export interface ConnectionSettings {
        overrideHost: string;
        overridePort: number;
        overrideUsername: string;
        overridePassword: string;

        hostIsLoadbalancer: boolean;
        useBuiltinErrorParser: boolean;
        selectedHosts: string[];
        logType: LogType;
        logPort: number;
    }

    export interface Entry {
        host: string;
        raw: string;
        time: Date;
        message: string;
    }
}
