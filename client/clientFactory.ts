import * as ml from 'marklogic';

import { ClientContext, MlClientParameters } from './marklogicClient';

// This class should NOT use the WorkspaceConfiguration (WC) class imported below.
// The debuggers don't have access to the vscode namespace, including WC.
// So if WC is used in the class, the debuggers won't be able to use this class.
// Note that this also precludes the use of ConfigurationManager in the class.
export class ClientFactory implements ml.ConnectionParams {
    host: string;
    port: number;
    basePath: string;
    user: string;
    password: string;
    database: string;
    authType: string;
    apiKey: string;
    accessTokenDuration: number;
    ssl: boolean;
    ca: string;
    rejectUnauthorized: boolean;
    // Additional fields not included in ml.ConnectionParams
    pathToCa: string;
    modulesDb: string;
    managePort: number;
    adminPort: number;
    testPort: number;
    manageBasePath: string;
    adminBasePath: string;
    restBasePath: string;
    testBasePath: string;

    constructor(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        rawParams: Record<string, any>
    ) {
        this.host = rawParams.host;
        this.port = Number(rawParams.port);
        this.basePath = rawParams.restBasePath || '';
        this.restBasePath = rawParams.restBasePath || '';
        this.managePort = Number(rawParams.managePort);
        this.manageBasePath = rawParams.manageBasePath || '';
        this.testPort = Number(rawParams.testPort);
        this.testBasePath = rawParams.testBasePath || '';
        this.adminPort = Number(rawParams.adminPort);
        this.adminBasePath = rawParams.adminBasePath || '';
        this.user = rawParams.user;
        this.password = rawParams.password;
        // contentDb is required for backward compatability
        this.database = rawParams.contentDb || rawParams.documentsDb || '';
        this.modulesDb = rawParams.modulesDb || '';
        this.authType = rawParams.authType;
        this.apiKey = rawParams.apiKey;
        this.accessTokenDuration = rawParams.accessTokenDuration;
        this.ssl = Boolean(rawParams.ssl);
        this.pathToCa = rawParams.pathToCa || '';
        this.rejectUnauthorized = Boolean(rawParams.rejectUnauthorized);

        // This check was previously done in the MarklogicClient constructor, but doing
        // so causes the sameAs function in this class to not behave properly
        if (this.authType !== 'DIGEST' && this.authType !== 'BASIC' && this.authType !== 'CLOUD') {
            this.authType = 'DIGEST';
        }
    }

    newMarklogicRestClient(
        overrides: object = {}
    ): ClientContext {
        const restClientConnectionParams: MlClientParameters = this.newRestClientParams(overrides);
        return new ClientContext(restClientConnectionParams);
    }

    newMarklogicManageClient(
        overrides: object = {}
    ): ClientContext {
        const manageClientConnectionParams: MlClientParameters = this.newManageClientParams(overrides);
        return new ClientContext(manageClientConnectionParams);
    }

    newMarklogicTestClient(
        overrides: object = {}
    ): ClientContext {
        const testClientConnectionParams: MlClientParameters = this.newTestClientParams(overrides);
        return new ClientContext(testClientConnectionParams);
    }

    newRestClientParams(
        overrides: object = {}
    ): MlClientParameters {
        const configParams: MlClientParameters = {
            host: this.host,
            user: this.user,
            pwd: this.password,
            port: this.port,
            restBasePath: this.restBasePath,
            contentDb: this.database,
            modulesDb: this.modulesDb,
            authType: this.authType.toUpperCase(),
            apiKey: this.apiKey,
            accessTokenDuration: this.accessTokenDuration,
            ssl: this.ssl,
            pathToCa: this.pathToCa || '',
            rejectUnauthorized: this.rejectUnauthorized,
            sameAs: null
        };
        return ({ ...configParams, ...overrides }) as MlClientParameters;
    }

    newManageClientParams(
        overrides: object = {}
    ): MlClientParameters {
        const manageOverrides: object = {
            port: this.managePort,
            restBasePath: this.manageBasePath,
            contentDb: null,
            modulesDb: null
        };
        return this.newRestClientParams({ ...manageOverrides, ...overrides });
    }

    newTestClientParams(
        overrides: object = {}
    ): MlClientParameters {
        const testOverrides: object = {
            port: this.testPort,
            restBasePath: this.testBasePath,
            contentDb: null,
            modulesDb: null
        };
        return this.newRestClientParams({ ...testOverrides, ...overrides });
    }
}

import { WorkspaceConfiguration } from 'vscode';
export function buildClientFactoryFromWorkspaceConfig(
    cfg: WorkspaceConfiguration,
    overrides: object = {}
): ClientFactory {
    const configParams: Record<string, unknown> = {
        host: String(cfg.get('marklogic.host')),
        user: String(cfg.get('marklogic.username')),
        password: String(cfg.get('marklogic.password')),
        port: Number(cfg.get('marklogic.port')),
        restBasePath: String(cfg.get('marklogic.restBasePath')) || '',
        managePort: Number(cfg.get('marklogic.managePort')),
        manageBasePath: String(cfg.get('marklogic.manageBasePath')) || '',
        testPort: Number(cfg.get('marklogic.testPort')),
        testBasePath: String(cfg.get('marklogic.testBasePath')) || '',
        adminPort: Number(cfg.get('marklogic.adminPort')),
        adminBasePath: String(cfg.get('marklogic.adminBasePath')) || '',
        contentDb: String(cfg.get('marklogic.documentsDb')),
        modulesDb: String(cfg.get('marklogic.modulesDb')),
        authType: String(cfg.get('marklogic.authType')).toUpperCase(),
        apiKey: String(cfg.get('marklogic.apiKey')),
        accessTokenDuration: Number(cfg.get('marklogic.accessTokenDuration')),
        ssl: Boolean(cfg.get('marklogic.ssl')),
        pathToCa: String(cfg.get('marklogic.pathToCa') || ''),
        rejectUnauthorized: Boolean(cfg.get('marklogic.rejectUnauthorized'))
    };
    return new ClientFactory({ ...configParams, ...overrides });
}

import { ConfigurationManager } from './configurationManager';
export function buildClientFactoryFromConfigurationManager(): ClientFactory {
    const configParams: Record<string, unknown> = {
        host: ConfigurationManager.getHost(),
        user: ConfigurationManager.getUsername(),
        password: ConfigurationManager.getPassword(),
        port: ConfigurationManager.getPort(),
        restBasePath: ConfigurationManager.getRestBasePath(),
        managePort: ConfigurationManager.getManagePort(),
        manageBasePath: ConfigurationManager.getManageBasePath(),
        testPort: ConfigurationManager.getTestPort(),
        testBasePath: ConfigurationManager.getTestBasePath(),
        adminPort: ConfigurationManager.getAdminPort(),
        adminBasePath: ConfigurationManager.getAdminBasePath(),
        contentDb: ConfigurationManager.getDocumentsDb(),
        modulesDb: ConfigurationManager.getModulesDb(),
        authType: ConfigurationManager.getAuthType().toUpperCase(),
        apiKey: ConfigurationManager.getApiKey(),
        accessTokenDuration: ConfigurationManager.getAccessTokenDuration(),
        pathToCa: ConfigurationManager.getPathToCa() || '',
        rejectUnauthorized: ConfigurationManager.getRejectUnauthorized()
    };
    return new ClientFactory(configParams);
}
