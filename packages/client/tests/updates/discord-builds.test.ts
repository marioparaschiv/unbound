import type { AndroidBuild, AndroidBuildsResponse } from '@unbound-app/contracts/android-builds';
import { afterAll, describe, expect, test } from 'bun:test';

import {
	compareDiscordVersions,
	discordChannel,
	fetchDiscordBuilds,
	findInstalledBuild,
	isOlderDiscord,
} from '~/updates/discord-builds';
import { createUnboundClient } from '~/account/client';

function build(
	discordVersion: string,
	commit: string,
	hashes: Record<string, string>,
): AndroidBuild {
	const [major = '0', minor = '0'] = discordVersion.split('.');

	return {
		channel: 'stable',
		discordVersion,
		discordVersionCode: Number(major) * 1000 + Number(minor),
		commit: commit.repeat(40),
		publishedAt: '2026-11-05T12:00:00.000Z',
		splits: Object.entries(hashes).map(([name, hash]) => ({
			name,
			sha256: hash.repeat(64),
			size: 10,
			compressedSize: 5,
			url: `https://cdn.unbound.rip/android/${name}.apk.gz`,
		})),
	};
}

const NEWEST = build('352.17', 'b', { base: '1', 'config.arm64_v8a': '2', 'config.en': '3' });
const OLDER = build('351.11', 'a', { base: '4', 'config.arm64_v8a': '5', 'config.en': '6' });

describe('discordChannel', () => {
	test("reads the channel from Discord's version name", () => {
		expect(discordChannel('352.17 - Stable')).toBe('stable');
		expect(discordChannel('353.4 - Beta')).toBe('beta');
		expect(discordChannel('354.0 - Alpha')).toBe('alpha');
		expect(discordChannel('352.17')).toBeUndefined();
		expect(discordChannel('352.17 - Canary')).toBeUndefined();
	});
});

describe('compareDiscordVersions and isOlderDiscord', () => {
	test('compare by part, not as text', () => {
		expect(compareDiscordVersions('352.9', '352.17')).toBeLessThan(0);
		expect(compareDiscordVersions('353.0', '352.17')).toBeGreaterThan(0);
		expect(compareDiscordVersions('352.17', '352.17')).toBe(0);
		expect(isOlderDiscord(OLDER, '352.17 - Stable')).toBe(true);
		expect(isOlderDiscord(NEWEST, '352.17 - Stable')).toBe(false);
	});
});

describe('findInstalledBuild', () => {
	test('matches the build whose every installed split has the same hash', () => {
		const installed = { base: '4'.repeat(64), 'config.arm64_v8a': '5'.repeat(64) };

		expect(findInstalledBuild([NEWEST, OLDER], installed)).toBe(OLDER);
		expect(
			findInstalledBuild([NEWEST, OLDER], {
				...installed,
				'config.arm64_v8a': '2'.repeat(64),
			}),
		).toBeUndefined();
		expect(findInstalledBuild([NEWEST], { base: null })).toBeUndefined();
	});
});

describe('fetchDiscordBuilds', () => {
	const requested: URL[] = [];
	const server = Bun.serve({
		port: 0,
		routes: {
			'/api/v1/loader/android-builds': (request) => {
				requested.push(new URL(request.url));

				return Response.json({ builds: [NEWEST, OLDER] } satisfies AndroidBuildsResponse);
			},
		},
	});

	afterAll(() => server.stop(true));

	test("asks for the channel's builds", async () => {
		expect(
			await fetchDiscordBuilds('beta', createUnboundClient({ baseUrl: server.url.origin })),
		).toEqual([NEWEST, OLDER]);
		expect(requested.at(-1)?.searchParams.get('channel')).toBe('beta');
	});
});
