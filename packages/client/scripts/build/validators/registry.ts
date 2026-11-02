import {
	syncDeleteResponseSchema,
	syncDocumentSchema,
	syncSettingsStoreSchema,
	syncStateSchema,
} from '@unbound-app/contracts/sync';
import {
	accountOAuthConfigSchema,
	accountSignInResponseSchema,
	meResponseSchema,
} from '@unbound-app/contracts/account';
import {
	installedAddonSchema,
	updatesRequestSchema,
	updatesResponseSchema,
} from '@unbound-app/contracts/updates';
import { crashReportResponseSchema, crashReportSchema } from '@unbound-app/contracts/crash-reports';
import { loaderUpdateQuerySchema, loaderUpdateResponseSchema } from '@unbound-app/contracts/loader';
import { addonVersionsResponseSchema, catalogResponseSchema } from '@unbound-app/contracts/addons';
import { addonPageSchema } from '@unbound-app/contracts/addon-page';

import type { ValidatorEntry } from './generate';

/** The type imports one entry needs: `Static` and the schema it narrows. */
function types(module: string, schema: string): string[] {
	return [
		"import type { Static } from '@unbound-app/contracts/schema';",
		`import type { ${schema} } from '@unbound-app/contracts/${module}';`,
	];
}

function entry(
	name: string,
	module: string,
	schema: string,
	value: ValidatorEntry['schema'],
	structureOnly = false,
): ValidatorEntry {
	return {
		name,
		schema: value,
		typeImports: types(module, schema),
		valueType: `Static<typeof ${schema}>`,
		structureOnly,
	};
}

// The order `validators.gen.ts` exports its checks. Add an entry, run `bun run validators`.
// A `structureOnly` entry holds refinements or codecs the check cannot carry; its call site runs them.
export const validatorRegistry: ValidatorEntry[] = [
	entry('isAccountOAuthConfig', 'account', 'accountOAuthConfigSchema', accountOAuthConfigSchema),
	entry(
		'isAccountSignInResponse',
		'account',
		'accountSignInResponseSchema',
		accountSignInResponseSchema,
	),
	entry('isMeResponse', 'account', 'meResponseSchema', meResponseSchema),
	entry('isAddonPage', 'addon-page', 'addonPageSchema', addonPageSchema, true),
	entry('isCatalogResponse', 'addons', 'catalogResponseSchema', catalogResponseSchema, true),
	entry(
		'isAddonVersionsResponse',
		'addons',
		'addonVersionsResponseSchema',
		addonVersionsResponseSchema,
		true,
	),
	entry('isCrashReport', 'crash-reports', 'crashReportSchema', crashReportSchema),
	entry(
		'isCrashReportResponse',
		'crash-reports',
		'crashReportResponseSchema',
		crashReportResponseSchema,
	),
	entry('isLoaderUpdateQuery', 'loader', 'loaderUpdateQuerySchema', loaderUpdateQuerySchema),
	entry(
		'isLoaderUpdateResponse',
		'loader',
		'loaderUpdateResponseSchema',
		loaderUpdateResponseSchema,
	),
	entry('isSyncDeleteResponse', 'sync', 'syncDeleteResponseSchema', syncDeleteResponseSchema),
	entry('isSyncDocument', 'sync', 'syncDocumentSchema', syncDocumentSchema),
	entry('isSyncSettingsStore', 'sync', 'syncSettingsStoreSchema', syncSettingsStoreSchema),
	entry('isSyncState', 'sync', 'syncStateSchema', syncStateSchema),
	entry('isInstalledAddon', 'updates', 'installedAddonSchema', installedAddonSchema),
	entry('isUpdatesRequest', 'updates', 'updatesRequestSchema', updatesRequestSchema, true),
	entry('isUpdatesResponse', 'updates', 'updatesResponseSchema', updatesResponseSchema, true),
];
