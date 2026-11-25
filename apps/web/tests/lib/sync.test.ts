import { emptySyncDocument, SYNC_MAX_INSTALLS } from '@unbound-app/contracts/sync';
import { describe, expect, test } from 'bun:test';

import { stripSyncDocument } from '~/lib/sync';
import { parseEnv } from '~/lib/env';

import { OFFLINE_DATABASE_ENV, TEST_ENV } from '../helpers/context';

const env = parseEnv({ ...TEST_ENV, ...OFFLINE_DATABASE_ENV });

function pluginsDocument(count: number) {
	const installs = Array.from({ length: count }, (_, index) => ({
		id: `p${index}.plugin`,
		url: `https://cdn.unbound.rip/addons/p${index}.plugin/1.0.0/manifest.json`,
		enabled: true,
	}));

	return { ...emptySyncDocument(), addons: { plugins: { installs, applied: null } } };
}

describe('stripSyncDocument', () => {
	test('keeps every install a request may carry under the default limits', () => {
		const document = stripSyncDocument(pluginsDocument(SYNC_MAX_INSTALLS), env);

		expect(document.addons.plugins.installs).toHaveLength(SYNC_MAX_INSTALLS);
	});
});
