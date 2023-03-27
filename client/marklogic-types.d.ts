declare module 'marklogic' {

    export interface ResultProvider<R> extends NodeJS.ReadWriteStream {
        result<U>(onFulfilled: (value: R) => Promise<U>, onRejected: (error: any) => Promise<U>, onProgress?: (note: any) => any): Promise<U>;
        result<U>(onFulfilled: (value: R) => Promise<U>, onRejected?: (error: any) => U, onProgress?: (note: any) => any): Promise<U>;
        result<U>(onFulfilled: (value: R) => U, onRejected: (error: any) => Promise<U>, onProgress?: (note: any) => any): Promise<U>;
        result<U>(onFulfilled?: (value: R) => U, onRejected?: (error: any) => U, onProgress?: (note: any) => any): Promise<U>;
    }

    export type contentType = 'application/json' | 'application/xml' | 'text/html' | 'text/csv'
    export type RowsResponseFormat = 'json' | 'xml' | 'csv'
    export type RowsQueryType = 'dsl' | 'json'

    interface graphs {
        sparql: <U>(args: Record<string, unknown>) => ResultProvider<U>
    }

    export type Item = {
        format: string,
        datatype: string,
        value: any
    }

    export type RowsResponse = {
        columns: { name: string }[],
        rows: object[],
        preRequestError: string
    }

    export type RowsOptions = {
        queryType: RowsQueryType
        format: RowsResponseFormat
    }

    interface Rows {
        query: (actualQuery: object | string, options: RowsOptions) => Promise<RowsResponse>
    }

    export interface DatabaseClient {
        release: () => void;
        xqueryEval: <U>(query: string, variables?: Variables) => ResultProvider<U>
        eval: <U>(query: string, variables?: Variables) => ResultProvider<U>
        invoke: <U>(path: string, variables?: Variables) => ResultProvider<U>
        read: (uri: string) => ResultProvider<string[]>
        graphs: graphs
        rows: Rows
        writeCollection: (collection: string, documents: Record<string, any>[]) => ResultProvider<string[]>
        removeCollection: (collection: string) => ResultProvider<string>
    }

    export interface ConnectionParams {
        host: string;
        port: number;
        user: string;
        password: string;
        database: string;
        authType: string;
        ssl: boolean;
        ca: string;
        rejectUnauthorized: boolean;
    }

    export interface Variables {
        [name: string]: number | string | boolean | Array<string>;
    }

    export function createDatabaseClient(connectionParams: ConnectionParams): DatabaseClient
}
