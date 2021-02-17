import { INestApplication, INestApplicationContext } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { getConnectionToken } from '@nestjs/typeorm';
import { Type } from '@vendure/common/lib/shared-types';
import cookieSession = require('cookie-session');
import { Connection, ConnectionOptions, EntitySubscriberInterface } from 'typeorm';

import { InternalServerError } from './common/error/errors';
import { getConfig, setConfig } from './config/config-helpers';
import { DefaultLogger } from './config/logger/default-logger';
import { Logger } from './config/logger/vendure-logger';
import { RuntimeVendureConfig, VendureConfig } from './config/vendure-config';
import { Administrator } from './entity/administrator/administrator.entity';
import { coreEntitiesMap } from './entity/entities';
import { registerCustomEntityFields } from './entity/register-custom-entity-fields';
import { setEntityIdStrategy } from './entity/set-entity-id-strategy';
import { validateCustomFieldsConfig } from './entity/validate-custom-fields-config';
import { getConfigurationFunction, getEntitiesFromPlugins } from './plugin/plugin-metadata';
import { getProxyMiddlewareCliGreetings } from './plugin/plugin-utils';

export type VendureBootstrapFunction = (config: VendureConfig) => Promise<INestApplication>;

/**
 * @description
 * Bootstraps the Vendure server. This is the entry point to the application.
 *
 * @example
 * ```TypeScript
 * import { bootstrap } from '\@vendure/core';
 * import { config } from './vendure-config';
 *
 * bootstrap(config).catch(err => {
 *     console.log(err);
 * });
 * ```
 * @docsCategory
 * */
export async function bootstrap(userConfig: Partial<VendureConfig>): Promise<INestApplication> {
    const config = await preBootstrapConfig(userConfig);
    Logger.useLogger(config.logger);
    Logger.info(`Bootstrapping Vendure Server (pid: ${process.pid})...`);

    // The AppModule *must* be loaded only after the entities have been set in the
    // config, so that they are available when the AppModule decorator is evaluated.
    // tslint:disable-next-line:whitespace
    const appModule = await import('./app.module');
    const { hostname, port, cors } = config.apiOptions;
    DefaultLogger.hideNestBoostrapLogs();
    const app = await NestFactory.create(appModule.AppModule, {
        cors,
        logger: new Logger(),
    });
    DefaultLogger.restoreOriginalLogLevel();
    app.useLogger(new Logger());
    if (config.authOptions.tokenMethod === 'cookie') {
        const { sessionSecret, cookieOptions } = config.authOptions;
        app.use(
            cookieSession({
                ...cookieOptions,
                // TODO: Remove once the deprecated sessionSecret field is removed
                ...(sessionSecret ? { secret: sessionSecret } : {}),
            }),
        );
    }
    await app.listen(port, hostname || '');
    app.enableShutdownHooks();
    logWelcomeMessage(config);
    return app;
}

/**
 * @description
 * Bootstraps the Vendure . Read more about the [Vendure Worker]({{< relref "vendure-worker" >}})
 *
 * @example
 * ```TypeScript
 * import { bootstrapWorker } from '\@vendure/core';
 * import { config } from './vendure-config';
 *
 * bootstrapWorker(config).catch(err => {
 *     console.log(err);
 * });
 * ```
 * @docsCategory worker
 * */
export async function bootstrapWorker(userConfig: Partial<VendureConfig>): Promise<INestApplicationContext> {
    const vendureConfig = await preBootstrapConfig(userConfig);
    const config = disableSynchronize(vendureConfig);
    (config.logger as any).setDefaultContext('Vendure Worker');
    Logger.useLogger(config.logger);
    Logger.info(`Bootstrapping Vendure Worker (pid: ${process.pid})...`);

    const appModule = await import('./app.module');
    DefaultLogger.hideNestBoostrapLogs();
    const workerApp = await NestFactory.createApplicationContext(appModule.AppModule, {
        logger: new Logger(),
    });
    DefaultLogger.restoreOriginalLogLevel();
    workerApp.useLogger(new Logger());
    workerApp.enableShutdownHooks();
    await validateDbTablesForWorker(workerApp);
    return workerApp;
}

/**
 * Setting the global config must be done prior to loading the AppModule.
 */
export async function preBootstrapConfig(
    userConfig: Partial<VendureConfig>,
): Promise<Readonly<RuntimeVendureConfig>> {
    if (userConfig) {
        checkForDeprecatedOptions(userConfig);
        setConfig(userConfig);
    }

    const entities = await getAllEntities(userConfig);
    const { coreSubscribersMap } = await import('./entity/subscribers');
    setConfig({
        dbConnectionOptions: {
            entities,
            subscribers: Object.values(coreSubscribersMap) as Array<Type<EntitySubscriberInterface>>,
        },
    });

    let config = getConfig();
    setEntityIdStrategy(config.entityIdStrategy, entities);
    const customFieldValidationResult = validateCustomFieldsConfig(config.customFields, entities);
    if (!customFieldValidationResult.valid) {
        process.exitCode = 1;
        throw new Error(`CustomFields config error:\n- ` + customFieldValidationResult.errors.join('\n- '));
    }
    config = await runPluginConfigurations(config);
    registerCustomEntityFields(config);
    setExposedHeaders(config);
    return config;
}

/**
 * Initialize any configured plugins.
 */
async function runPluginConfigurations(config: RuntimeVendureConfig): Promise<RuntimeVendureConfig> {
    for (const plugin of config.plugins) {
        const configFn = getConfigurationFunction(plugin);
        if (typeof configFn === 'function') {
            config = await configFn(config);
        }
    }
    return config;
}

/**
 * Returns an array of core entities and any additional entities defined in plugins.
 */
export async function getAllEntities(userConfig: Partial<VendureConfig>): Promise<Array<Type<any>>> {
    const coreEntities = Object.values(coreEntitiesMap) as Array<Type<any>>;
    const pluginEntities = getEntitiesFromPlugins(userConfig.plugins);

    const allEntities: Array<Type<any>> = coreEntities;

    // Check to ensure that no plugins are defining entities with names
    // which conflict with existing entities.
    for (const pluginEntity of pluginEntities) {
        if (allEntities.find(e => e.name === pluginEntity.name)) {
            throw new InternalServerError(`error.entity-name-conflict`, { entityName: pluginEntity.name });
        } else {
            allEntities.push(pluginEntity);
        }
    }
    return allEntities;
}

/**
 * If the 'bearer' tokenMethod is being used, then we automatically expose the authTokenHeaderKey header
 * in the CORS options, making sure to preserve any user-configured exposedHeaders.
 */
function setExposedHeaders(config: Readonly<RuntimeVendureConfig>) {
    if (config.authOptions.tokenMethod === 'bearer') {
        const authTokenHeaderKey = config.authOptions.authTokenHeaderKey;
        const corsOptions = config.apiOptions.cors;
        if (typeof corsOptions !== 'boolean') {
            const { exposedHeaders } = corsOptions;
            let exposedHeadersWithAuthKey: string[];
            if (!exposedHeaders) {
                exposedHeadersWithAuthKey = [authTokenHeaderKey];
            } else if (typeof exposedHeaders === 'string') {
                exposedHeadersWithAuthKey = exposedHeaders
                    .split(',')
                    .map(x => x.trim())
                    .concat(authTokenHeaderKey);
            } else {
                exposedHeadersWithAuthKey = exposedHeaders.concat(authTokenHeaderKey);
            }
            corsOptions.exposedHeaders = exposedHeadersWithAuthKey;
        }
    }
}

function logWelcomeMessage(config: RuntimeVendureConfig) {
    let version: string;
    try {
        version = require('../package.json').version;
    } catch (e) {
        version = ' unknown';
    }
    const { port, shopApiPath, adminApiPath } = config.apiOptions;
    const apiCliGreetings: Array<[string, string]> = [];
    apiCliGreetings.push(['Shop API', `http://localhost:${port}/${shopApiPath}`]);
    apiCliGreetings.push(['Admin API', `http://localhost:${port}/${adminApiPath}`]);
    apiCliGreetings.push(...getProxyMiddlewareCliGreetings(config));
    const columnarGreetings = arrangeCliGreetingsInColumns(apiCliGreetings);
    const title = `Vendure server (v${version}) now running on port ${port}`;
    const maxLineLength = Math.max(title.length, ...columnarGreetings.map(l => l.length));
    const titlePadLength = title.length < maxLineLength ? Math.floor((maxLineLength - title.length) / 2) : 0;
    Logger.info(`=`.repeat(maxLineLength));
    Logger.info(title.padStart(title.length + titlePadLength));
    Logger.info('-'.repeat(maxLineLength).padStart(titlePadLength));
    columnarGreetings.forEach(line => Logger.info(line));
    Logger.info(`=`.repeat(maxLineLength));
}

function arrangeCliGreetingsInColumns(lines: Array<[string, string]>): string[] {
    const columnWidth = Math.max(...lines.map(l => l[0].length)) + 2;
    return lines.map(l => `${(l[0] + ':').padEnd(columnWidth)}${l[1]}`);
}

/**
 * Fix race condition when modifying DB
 * See: https://github.com/vendure-ecommerce/vendure/issues/152
 */
function disableSynchronize(userConfig: Readonly<RuntimeVendureConfig>): Readonly<RuntimeVendureConfig> {
    const config = { ...userConfig };
    config.dbConnectionOptions = {
        ...userConfig.dbConnectionOptions,
        synchronize: false,
    } as ConnectionOptions;
    return config;
}

/**
 * Check that the Database tables exist. When running Vendure server & worker
 * concurrently for the first time, the worker will attempt to access the
 * DB tables before the server has populated them (assuming synchronize = true
 * in config). This method will use polling to check the existence of a known table
 * before allowing the rest of the worker bootstrap to continue.
 * @param worker
 */
async function validateDbTablesForWorker(worker: INestApplicationContext) {
    const connection: Connection = worker.get(getConnectionToken());
    await new Promise(async (resolve, reject) => {
        const checkForTables = async (): Promise<boolean> => {
            try {
                const adminCount = await connection.getRepository(Administrator).count();
                return 0 < adminCount;
            } catch (e) {
                return false;
            }
        };

        const pollIntervalMs = 5000;
        let attempts = 0;
        const maxAttempts = 10;
        let validTableStructure = false;
        Logger.verbose('Checking for expected DB table structure...');
        while (!validTableStructure && attempts < maxAttempts) {
            attempts++;
            validTableStructure = await checkForTables();
            if (validTableStructure) {
                Logger.verbose('Table structure verified');
                resolve();
                return;
            }
            Logger.verbose(
                `Table structure could not be verified, trying again after ${pollIntervalMs}ms (attempt ${attempts} of ${maxAttempts})`,
            );
            await new Promise(resolve1 => setTimeout(resolve1, pollIntervalMs));
        }
        reject(`Could not validate DB table structure. Aborting bootstrap.`);
    });
}

function checkForDeprecatedOptions(config: Partial<VendureConfig>) {
    const deprecatedApiOptions = [
        'hostname',
        'port',
        'adminApiPath',
        'shopApiPath',
        'channelTokenKey',
        'cors',
        'middleware',
        'apolloServerPlugins',
    ];
    const deprecatedOptionsUsed = deprecatedApiOptions.filter(option => config.hasOwnProperty(option));
    if (deprecatedOptionsUsed.length) {
        throw new Error(
            `The following VendureConfig options are deprecated: ${deprecatedOptionsUsed.join(', ')}\n` +
                `They have been moved to the "apiOptions" object. Please update your configuration.`,
        );
    }
}
