'use strict'

import { MarklogicClient, MlClientParameters, sendJSQuery } from '../../marklogicClient'

/**
 *
 */
export async function getRid(client: MarklogicClient, qry: string): Promise<string[]> {
    const newParams: MlClientParameters = JSON.parse(JSON.stringify(client.params))
    newParams.port = 8002
    const newClient = new MarklogicClient(newParams)
    return sendJSQuery(newClient, qry)
        .result(
            (fulfill: Record<string, any>[]) => {
                return fulfill.map(o => {
                    return o.value
                })
            },
            (err) => {
                throw err
            })
}

/**
 *
 */
export function wait(ms: number): Promise<any> {
    return new Promise((resolve) => {
        setTimeout(resolve, ms)
    })
}