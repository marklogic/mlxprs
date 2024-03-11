/*
 * Copyright (c) 2023 MarkLogic Corporation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

import { ClientContext, sendXQuery } from './marklogicClient';
import { ClientFactory } from './clientFactory';

export const listModulesQuery = 'cts:uris()';

export class ModuleContentGetter {
    private dbClientContext: ClientContext;

    public constructor(dbClientContext: ClientContext) {
        const moduleGetterParams: Record<string, any> = dbClientContext.params;
        moduleGetterParams.password = moduleGetterParams.pwd;
        this.dbClientContext =
            new ClientFactory(moduleGetterParams)
                .newMarklogicModulesClient();
    }

    public host(): string {
        return this.dbClientContext.params.host;
    }

    public port(): number {
        return this.dbClientContext.params.port;
    }

    public initialize(dbClientContext: ClientContext): void {
        this.dbClientContext = dbClientContext;
    }

    public async provideTextDocumentContent(modulePath: string): Promise<string> {
        return this.dbClientContext.databaseClient.read(modulePath)
            .result(
                (fulfill: string[]) => {
                    const moduleContent: string = fulfill[0];
                    return moduleContent;
                },
                (err) => {
                    throw err;
                });
    }

    public async listModules(): Promise<string[]> {
        return sendXQuery(this.dbClientContext, listModulesQuery)
            .result(
                (fulfill: Record<string, any>[]) => {
                    return fulfill.map(o => {
                        return o.value;
                    });
                },
                (err) => {
                    throw err;
                });
    }



}
