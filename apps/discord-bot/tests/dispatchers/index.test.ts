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
		const dispatchers = build(
			withIds({ RELEASES_CHANNEL_ID: undefined, RELEASES_ROLE_ID: undefined }),
		);

		expect(dispatchers.map((dispatcher) => dispatcher.name)).toEqual([
			'addons',
			'audit',
			'review-notices',
			'roles',
		]);
		expect(warnings()).toHaveLength(1);
		expect(warnings()[0]).toContain(
			'Not starting releases: RELEASES_CHANNEL_ID, RELEASES_ROLE_ID are still unset in src/lib/config.ts.',
		);
	});

	test('one unset role id keeps role sync from starting', () => {
		const dispatchers = build(withIds({ SPONSOR_ROLE_ID: undefined }));

		expect(dispatchers.map((dispatcher) => dispatcher.name)).not.toContain('roles');
		expect(warnings().join('\n')).toContain(
			'Not starting roles: SPONSOR_ROLE_ID is still unset in src/lib/config.ts.',
		);
	});

	test('builds every dispatcher whose ids the real constants set, each on its channel', () => {
		const set = withIds({ RELEASES_ROLE_ID: '3' });
		const channels = Object.fromEntries(
			build(set).map((dispatcher) => [dispatcher.name, dispatcher.channel]),
		);

		expect(channels).toEqual({
			addons: 'addon_changed',
			releases: 'loader_release',
			// Two cursors over one stream: each audit event wakes both.
			audit: 'audit_event',
			'review-notices': 'audit_event',
			roles: 'member_changed',
		});
		expect(warnings()).toEqual([]);
	});

	test('the real constants start everything but releases, whose role is still unset', () => {
		expect(build().map((dispatcher) => dispatcher.name)).toEqual([
			'addons',
			'audit',
			'review-notices',
			'roles',
		]);
		expect(warnings()).toEqual([
			expect.stringContaining('Not starting releases: RELEASES_ROLE_ID is still unset'),
		]);
	});
});
