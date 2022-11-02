declare module 'marklogic' {

  export interface ResultProvider<R> extends NodeJS.ReadWriteStream {
    result<U>(onFulfilled:  (value: R) => Promise<U>, onRejected:  (error: any) => Promise<U>, onProgress?: (note: any) => any): Promise<U>;
    result<U>(onFulfilled:  (value: R) => Promise<U>, onRejected?: (error: any) => U,          onProgress?: (note: any) => any): Promise<U>;
    result<U>(onFulfilled:  (value: R) => U,          onRejected:  (error: any) => Promise<U>, onProgress?: (note: any) => any): Promise<U>;
    result<U>(onFulfilled?: (value: R) => U,          onRejected?: (error: any) => U,          onProgress?: (note: any) => any): Promise<U>;
  }

  export type sparqlResultsType =   'application/sparql-results+json' | 'application/sparql-results+xml' |
                                    'text/html' | 'text/csv'

  // application/trig should be supported according to the documentation
  // but there appears to be a bug in the implementation
  // so I removed it from package.json as an option
  export type rdfGraphType =    'application/n-triples' | 'application/n-quads' | 'application/rdf+json' |
                                'application/rdf+xml' | 'text/turtle' | 'text/n3' | 'application/trig'

  export type mimeType = sparqlResultsType | rdfGraphType | 'application/json' | 'application/xml'

  export type sparqlQueryForm = 'SELECT' | 'CONSTRUCT' | 'ASK' | 'DESCRIBE' | 'UNKNOWN'

  interface graphs {
      sparql: <U>(args: Record<string, unknown>) => ResultProvider<U>
  }

  export interface DatabaseClient {
    release: () => void;
    xqueryEval: <U>(query: string, variables?: Variables) => ResultProvider<U>;
    eval: <U>(query: string, variables?: Variables) => ResultProvider<U>;
    invoke: <U>(path: string, variables?: Variables) => ResultProvider<U>;
    read: (uri: string) => ResultProvider<string[]>;
    graphs: graphs;
    writeCollection: (collection: string, documents: Record<string, any>[]) => ResultProvider<string[]>;
    removeCollection: (collection: string) => ResultProvider<string>;
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
    [name: string]: number|string|boolean|Array<string>;
  }

  export function createDatabaseClient(connectionParams: ConnectionParams): DatabaseClient
}
