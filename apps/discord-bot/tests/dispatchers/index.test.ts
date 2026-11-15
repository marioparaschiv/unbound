import { afterEach, beforeEach, describe, expect, spyOn, test } from 'bun:test';
import { REST } from 'discord.js';

import { createAuditTelemetry } from '~/lib/audit-telemetry';
import type { BotConfig, DiscordIds } from '~/lib/config';
import { createDispatchers } from '~/dispatchers';

import { testConfig } from '../helpers/config';

type Warn = ReturnType<typeof spyOn<Console, 'warn'>>;

const CONFIG = testConfig();

// Building a dispatcher makes no Discord call, so a REST client without a token is enough.
function build(config: BotConfig = CONFIG) {
	return createDispatchers({
		config,
		discord: {
			rest: new REST(),
			selfId: '1',
			applicationId: '2',
			guilds: { fetch: () => Promise.reject(new Error('No guild in this test.')) },
		},
		telemetry: createAuditTelemetry({ env: config.env }),
		now: Date.now,
	});
}

function withIds(ids: Partial<DiscordIds>): BotConfig {
	return { ...CONFIG, ids: { ...CONFIG.ids, ...ids } };
}

describe('createDispatchers', () => {
	let warn: Warn;

	// The logger writes warnings through console.warn, so that is where they are read back.
	beforeEach(() => {
		warn = spyOn(console, 'warn').mockImplementation(() => void 0);
	});

	afterEach(() => {
		warn.mockRestore();
	});

	function warnings() {
		return warn.mock.calls.map((args) => args.join(' '));
	}

	test('a dispatcher missing an id is not built and is named in one warning', () => {
		const dispatchers = build(withIds({ LOADER_RELEASES_CHANNEL_ID: undefined }));

		expect(dispatchers.map((dispatcher) => dispatcher.name)).not.toContain('releases');
		expect(warnings()).toHaveLength(1);
		expect(warnings()[0]).toContain(
			'Not starting releases: LOADER_RELEASES_CHANNEL_ID is still unset in src/lib/config.ts.',
		);
	});

	test('one unset role id keeps role sync from starting', () => {
		const dispatchers = build(withIds({ SPONSOR_ROLE_ID: undefined }));

		expect(dispatchers.map((dispatcher) => dispatcher.name)).not.toContain('roles');
		expect(warnings().join('\n')).toContain(
			'Not starting roles: SPONSOR_ROLE_ID is still unset in src/lib/config.ts.',
		);
	});

	test('the real constants build every dispatcher, each on its channel', () => {
		const channels = Object.fromEntries(
			build().map((dispatcher) => [dispatcher.name, dispatcher.channel ?? 'timer only']),
		);

		expect(channels).toEqual({
			addons: 'addon_changed',
			releases: 'loader_release',
			bundles: 'bundle_release',
			// The API docs live on the CDN, which no trigger can watch.
			'api-releases': 'timer only',
			// Two cursors over one stream: each audit event wakes both.
			audit: 'audit_event',
			'review-notices': 'audit_event',
			roles: 'member_changed',
		});
		expect(warnings()).toEqual([]);
	});
});
