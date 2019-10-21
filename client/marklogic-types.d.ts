declare module 'marklogic' {

  export interface ResultProvider<R> extends NodeJS.ReadWriteStream {
    result<U>(onFulfilled:  (value: R) => Promise<U>, onRejected:  (error: any) => Promise<U>, onProgress?: (note: any) => any): Promise<U>;
    result<U>(onFulfilled:  (value: R) => Promise<U>, onRejected?: (error: any) => U,          onProgress?: (note: any) => any): Promise<U>;
    result<U>(onFulfilled:  (value: R) => U,          onRejected:  (error: any) => Promise<U>, onProgress?: (note: any) => any): Promise<U>;
    result<U>(onFulfilled?: (value: R) => U,          onRejected?: (error: any) => U,          onProgress?: (note: any) => any): Promise<U>;
  }

  export interface DatabaseClient {
    release: () => void;
    xqueryEval: <U>(query: string, variables?: Variables) => ResultProvider<U>;
    eval: <U>(query: string, variables?: Variables) => ResultProvider<U>;
  }

  export interface ConnectionParams {
    host: string;
    port: number;
    user: string;
    password: string;
    authType: string;
    ssl: boolean;
    ca: string;
  }

  export interface Variables {
    [name: string]: number|string|boolean;
  }

  export function createDatabaseClient(connectionParams: ConnectionParams): DatabaseClient
}
