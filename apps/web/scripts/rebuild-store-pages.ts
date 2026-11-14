// Rewrites each missing or outdated published `store-page.json`, e.g. after adding a page icon.
// Usage: bun scripts/rebuild-store-pages.ts
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

const logger = createLogger('Web', 'StorePages');
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
		const target = bucket.file(`${directory}/${STORE_PAGE_FILENAME}`);

		if (!(await page.exists())) {
			continue;
		}

		const [addonMd, measured, current] = await Promise.all([
			page.text(),
			readMeasured(`${directory}/${MEASURED_PAGE_FILENAME}`),
			target.exists().then((exists) => (exists ? target.text() : null)),
		]);
		const file = buildStorePageFile(addonMd, measured);

		if (file === current) {
			continue;
		}

		await bucket.write(`${directory}/${STORE_PAGE_FILENAME}`, file, {
			type: 'application/json',
		});
		written += 1;
	} catch (error) {
		logger.error(`Failed to rebuild store-page.json of ${addonId}@${version}:`, error);
	}
}

logger.success(`Wrote ${written} store pages across ${versions.length} versions.`);
await db.$client.end();
