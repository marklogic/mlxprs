import { WorkspaceConfiguration } from 'vscode';

import { ClientFactory } from './clientFactory';
import { ConfigurationManager } from './configurationManager';

// Only use this when you're in a context that has access to the 'vscode' classes.
// This class is necessary because the debugger classes do not have access to the 'vscode' classes.
// By extension, they also do not have access to the ConfigurationManager.
// Therefore, these functions that rely on 'vscode' classes need to be outside of ClientFactory.
export function buildClientFactoryFromWorkspaceConfig(
    cfg: WorkspaceConfiguration,
    overrides: object = {}
): ClientFactory {
    const configParams: Record<string, unknown> = {
        host: String(cfg.get('marklogic.host')),
        user: String(cfg.get('marklogic.username')),
        password: String(cfg.get('marklogic.password')),
        pwd: cfg.get('marklogic.password'),
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
