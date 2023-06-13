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

import * as vscode from 'vscode';

export interface MarklogicConfigurationSettings {
    host?: string;
    port?: string;
    managePort?: string;
    username?: string;
    password?: string;
    documentsDb?: string;
    modulesDb?: string;
    authType?: string;
    ssl?: string;
    pathToCa?: string;
    rejectUnauthorized?: string;
}

export class ConfigurationManager {

    private static vscodeConfiguration: vscode.WorkspaceConfiguration = vscode.workspace.getConfiguration('marklogic');
    private static overrides: MarklogicConfigurationSettings = {};

    static setOverride(key: string, val: unknown): void {
        ConfigurationManager.overrides[key] = val;
    }

    static handleUpdateConfigurationEvent(): void {
        ConfigurationManager.vscodeConfiguration = vscode.workspace.getConfiguration('marklogic');
    }

    static getConfigValue(key: string): unknown {
        if (ConfigurationManager.overrides[key]) {
            return ConfigurationManager.overrides[key];
        } else {
            return ConfigurationManager.vscodeConfiguration.get(key);
        }
    }

    static getHost(): string {
        return ConfigurationManager.getConfigValue('host') as string;
    }

    static getPort(): string {
        return ConfigurationManager.getConfigValue('port') as string;
    }

    static getManagePort(): string {
        return ConfigurationManager.getConfigValue('managePort') as string;
    }

    static getUsername(): string {
        return ConfigurationManager.getConfigValue('username') as string;
    }

    static getPassword(): string {
        return ConfigurationManager.getConfigValue('password') as string;
    }

    static getDocumentsDb(): string {
        return ConfigurationManager.getConfigValue('documentsDb') as string;
    }

    static getModulesDb(): string {
        return ConfigurationManager.getConfigValue('modulesDb') as string;
    }

    static getAuthType(): string {
        return ConfigurationManager.getConfigValue('authType') as string;
    }

    static getSsl(): string {
        return ConfigurationManager.getConfigValue('ssl') as string;
    }

    static getPathToCa(): string {
        return ConfigurationManager.getConfigValue('pathToCa') as string;
    }

    static getRejectUnauthorized(): string {
        return ConfigurationManager.getConfigValue('rejectUnauthorized') as string;
    }
}