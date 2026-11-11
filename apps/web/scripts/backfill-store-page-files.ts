// Writes `store-page.json` beside each published ADDON.md that has none yet, from ADDON.md and `page.json`.
// Usage: bun scripts/backfill-store-page-files.ts
import {
	ADDON_PAGE_FILENAME,
	MEASURED_PAGE_FILENAME,
	STORE_PAGE_FILENAME,
} from '@unbound-app/contracts/addon-page-text';
import { addonPageSchema, type AddonPage } from '@unbound-app/contracts/addon-page';
import { getVersionDirectory } from '@unbound-app/contracts/version-layout';
import { parse } from '@unbound-app/contracts/schema';
import { createLogger } from '@unbound-app/logger';

import { buildStorePageFile } from '~/lib/store-page-file';
import { createDatabase } from '~/db/database';
import { createStorage } from '~/lib/storage';
import { addonVersion } from '~/db/schema';
import { parseEnv } from '~/lib/env';

const logger = createLogger('Web', 'StorePageFiles');
const env = parseEnv();
const db = createDatabase(env.DATABASE_DIRECT_URL);
const bucket = createStorage(env).public;

async function readMeasured(key: string): Promise<AddonPage | null> {
	const file = bucket.file(key);

	return (await file.exists()) ? parse(addonPageSchema, await file.json()) : null;
}

const versions = await db
	.select({ addonId: addonVersion.addonId, version: addonVersion.version })
	.from(addonVersion);
let written = 0;

for (const { addonId, version } of versions) {
	const directory = getVersionDirectory(addonId, version);

	try {
		const page = bucket.file(`${directory}/${ADDON_PAGE_FILENAME}`);
		const target = `${directory}/${STORE_PAGE_FILENAME}`;

		if (!(await page.exists()) || (await bucket.file(target).exists())) {
			continue;
		}

		const [addonMd, measured] = await Promise.all([
			page.text(),
			readMeasured(`${directory}/${MEASURED_PAGE_FILENAME}`),
		]);

		await bucket.write(target, buildStorePageFile(addonMd, measured), {
			type: 'application/json',
		});
		written += 1;
	} catch (error) {
		logger.error(`Failed to backfill store-page.json of ${addonId}@${version}:`, error);
	}
}

logger.success(`Wrote ${written} store pages across ${versions.length} versions.`);
await db.$client.end();
