export class DatabaseClient {
    constructor(
        host: string, port: number,
        user: string, pwd: string, authType: string,
        contentDb: string, modulesDb: string,
        ssl: boolean, pathToCa: string
        );
    host: string;
    port: string;
    user: string;
    pwd: string;
    authType: string;
    contentDb: string;
    modulesDb: string;
    ssl: boolean;
    pathToCa: string
    docsDbNumber: string;
    mldbClient: any;
}
export class createDatabaseClient {
    constructor(connectionParams: any);
    documents: any;
    transactions: any;
    graphs: any;
    resources: any;
    values: any;
    config: any;
    logger: any;
    createDatabaseClient(
        host: string, port: string, user: string, password: string,
        authType: string, ssl: boolean, ca: string): DatabaseClient;
    createCollection(...args: any[]): any;
    getLogger(): any;
    invoke(...args: any[]): any;
    probe(...args: any[]): any;
    queryCollection(collection: any, builtQuery: any): any;
    read(...args: any[]): any;
    release(): void;
    remove(...args: any[]): any;
    removeCollection(collection: any): any;
    setLogger(...args: any[]): void;
    writeCollection(...args: any[]): any;
    xqueryEval(...args: any[]): any;
}
export namespace patchBuilder {
    function add(number: any, ...args: any[]): any;
    function apply(...args: any[]): any;
    namespace collections {
        function add(collection: any): any;
        function remove(collection: any): any;
    }
    function concatAfter(appended: any, ...args: any[]): any;
    function concatBefore(prepended: any, ...args: any[]): any;
    function concatBetween(prepended: any, appended: any, ...args: any[]): any;
    function datatype(...args: any[]): any;
    function divideBy(divisor: any, ...args: any[]): any;
    function insert(...args: any[]): any;
    function library(module: any): any;
    function multiplyBy(multiplier: any, ...args: any[]): any;
    function pathLanguage(...args: any[]): any;
    namespace permissions {
        function add(...args: any[]): any;
        function remove(roleName: any): any;
        function replace(...args: any[]): any;
    }
    namespace properties {
        function add(name: any, value: any): any;
        function remove(name: any): any;
        function replace(name: any, value: any): any;
    }
    namespace quality {
        function set(quality: any): any;
    }
    function remove(...args: any[]): any;
    function replace(...args: any[]): any;
    function replaceInsert(...args: any[]): any;
    function replaceRegex(match: any, replace: any, flags: any, ...args: any[]): any;
    function substringAfter(start: any, ...args: any[]): any;
    function substringBefore(end: any, ...args: any[]): any;
    function subtract(number: any, ...args: any[]): any;
}
export namespace queryBuilder {
    function anchor(...args: any[]): any;
    function and(...args: any[]): any;
    function andNot(...args: any[]): any;
    function attribute(...args: any[]): any;
    function bind(name: any): any;
    function bindDefault(): any;
    function bindEmptyAs(binding: any): any;
    function boost(...args: any[]): any;
    function box(...args: any[]): any;
    function bucket(...args: any[]): any;
    function byExample(...args: any[]): any;
    function calculateFunction(...args: any[]): any;
    function circle(...args: any[]): any;
    function collection(...args: any[]): any;
    function copyFrom(otherQueryBuilder: any): any;
    function datatype(...args: any[]): any;
    function directory(...args: any[]): any;
    function document(...args: any[]): any;
    function documentFragment(...args: any[]): any;
    function element(...args: any[]): any;
    function extract(...args: any[]): any;
    function facet(...args: any[]): any;
    function facetOptions(...args: any[]): any;
    function field(...args: any[]): any;
    function fragmentScope(...args: any[]): any;
    function geoAttributePair(...args: any[]): any;
    function geoElement(...args: any[]): any;
    function geoElementPair(...args: any[]): any;
    function geoOptions(...args: any[]): any;
    function geoPath(...args: any[]): any;
    function geoProperty(...args: any[]): any;
    function geoPropertyPair(...args: any[]): any;
    function geospatial(...args: any[]): any;
    function heatmap(...args: any[]): any;
    function jsontype(type: any): any;
    function latlon(...args: any[]): any;
    function locksFragment(...args: any[]): any;
    function lsqtQuery(...args: any[]): any;
    function near(...args: any[]): any;
    function not(...args: any[]): any;
    function notIn(...args: any[]): any;
    function or(...args: any[]): any;
    function ordered(...args: any[]): any;
    function parseBindings(...args: any[]): any;
    function parseFunction(...args: any[]): any;
    function parsedFrom(...args: any[]): any;
    function pathIndex(...args: any[]): any;
    function period(...args: any[]): any;
    function periodCompare(...args: any[]): any;
    function periodRange(...args: any[]): any;
    function point(...args: any[]): any;
    function polygon(...args: any[]): any;
    function propertiesFragment(...args: any[]): any;
    function property(...args: any[]): any;
    function qname(...args: any[]): any;
    function range(...args: any[]): any;
    function rangeOptions(...args: any[]): any;
    function scope(...args: any[]): any;
    function score(...args: any[]): any;
    function snippet(...args: any[]): any;
    function sort(...args: any[]): any;
    function southWestNorthEast(...args: any[]): any;
    function suggestBindings(...args: any[]): any;
    function suggestOptions(...args: any[]): any;
    function temporalOptions(...args: any[]): any;
    function term(...args: any[]): any;
    function termOptions(...args: any[]): any;
    function transform(name: any, params: any): any;
    function value(...args: any[]): any;
    function weight(...args: any[]): any;
    function where(...args: any[]): any;
    function word(...args: any[]): any;
}
export function setSliceMode(mode: any): void;
export namespace valuesBuilder {
    function and(...args: any[]): any;
    function andNot(...args: any[]): any;
    function attribute(...args: any[]): any;
    function bind(name: any): any;
    function bindDefault(): any;
    function bindEmptyAs(binding: any): any;
    function boost(...args: any[]): any;
    function box(...args: any[]): any;
    function circle(...args: any[]): any;
    function collection(...args: any[]): any;
    function copyFrom(otherValueBuilder: any): any;
    function datatype(...args: any[]): any;
    function directory(...args: any[]): any;
    function document(...args: any[]): any;
    function documentFragment(...args: any[]): any;
    function element(...args: any[]): any;
    function field(...args: any[]): any;
    function fragmentScope(...args: any[]): any;
    function fromIndexes(...args: any[]): any;
    function geoAttributePair(...args: any[]): any;
    function geoElement(...args: any[]): any;
    function geoElementPair(...args: any[]): any;
    const geoOption: any;
    function geoPath(...args: any[]): any;
    function geoProperty(...args: any[]): any;
    function geoPropertyPair(...args: any[]): any;
    function geospatial(...args: any[]): any;
    function heatmap(...args: any[]): any;
    function jsontype(type: any): any;
    function latlon(...args: any[]): any;
    function locksFragment(...args: any[]): any;
    function lsqtQuery(...args: any[]): any;
    function near(...args: any[]): any;
    function not(...args: any[]): any;
    function notIn(...args: any[]): any;
    function or(...args: any[]): any;
    function ordered(...args: any[]): any;
    function parseBindings(...args: any[]): any;
    function parseFunction(...args: any[]): any;
    function parsedFrom(...args: any[]): any;
    function pathIndex(...args: any[]): any;
    function period(...args: any[]): any;
    function periodCompare(...args: any[]): any;
    function periodRange(...args: any[]): any;
    function point(...args: any[]): any;
    function polygon(...args: any[]): any;
    function propertiesFragment(...args: any[]): any;
    function property(...args: any[]): any;
    function qname(...args: any[]): any;
    function range(...args: any[]): any;
    function rangeOptions(...args: any[]): any;
    function scope(...args: any[]): any;
    function southWestNorthEast(...args: any[]): any;
    function temporalOptions(...args: any[]): any;
    function term(...args: any[]): any;
    function termOptions(...args: any[]): any;
    function transform(name: any, params: any): any;
    function udf(...args: any[]): any;
    function uri(): any;
    function value(...args: any[]): any;
    function weight(...args: any[]): any;
    function word(...args: any[]): any;
}
