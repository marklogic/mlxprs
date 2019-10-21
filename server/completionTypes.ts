'use strict'

class MarkLogicFnDocsObject {
    name: string;
    prefix: string;
    summary: string;
    return: string;
    example: string[];
    params: MarkLogicParamsObject[] = [];

    constructor(o: any) {
        this.name = o.name
        this.prefix = o.prefix
        this.summary = o.summary
        this.return = o.return
        this.example = o.example || []
        this.params = o.params || []
    }
}

interface MarkLogicParamsObject {
    name: string;
    type: string;
    description: string;
    optional?: boolean;
}

export {
    MarkLogicFnDocsObject, MarkLogicParamsObject
}
