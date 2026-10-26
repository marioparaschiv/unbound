import type { PublicAddon } from '@unbound-app/web/bot';
import { expect, test } from 'bun:test';

import { contentHash } from '~/lib/content-hash';

// A listing and the `posted_hash` its message carries in production, written under the old feed.
const POSTED: PublicAddon = {
	id: 'eternal.hello-unbound',
	type: 'plugin',
	name: 'Hello Unbound',
	description: 'A test plugin that logs when it starts and stops.',
	version: '1.0.0',
	authors: [{ name: 'eternal', discordId: '263689920210534400' }],
	pageUrl: 'https://unbound.rip/addons/eternal.hello-unbound',
	listed: true,
};
const POSTED_HASH = '60c6e6a69b193e7659789a36e87cd7b01e7ae7edbabe985ff504b4fdbe2864e8';

test('an unchanged listing hashes to the hash posted under the old feed', () => {
	expect(contentHash(POSTED)).toBe(POSTED_HASH);
});

test('key order and an absent icon do not change the hash; any visible field does', () => {
	const { id, type, name, description, version, authors, pageUrl, listed } = POSTED;

	expect(contentHash({ listed, pageUrl, authors, version, description, name, type, id })).toBe(
		POSTED_HASH,
	);
	expect(contentHash({ ...POSTED, iconUrl: undefined })).toBe(POSTED_HASH);
	expect(contentHash({ ...POSTED, version: '1.0.1' })).not.toBe(POSTED_HASH);
});
