import type { LoaderUpdateResponse } from '@unbound-app/contracts/loader';
import type { UnboundLoaderInfo } from '@unbound-app/types';
import { afterAll, describe, expect, test } from 'bun:test';

import { buildLoaderUpdateQuery, fetchLoaderUpdate, resolveRequiredLoader } from './loader-updates';

const UPDATE: LoaderUpdateResponse = {
	update: {
		platform: 'ios',
		version: '3.1.0',
		url: 'https://github.com/unbound-app/loader-ios/releases/tag/3.1.0',
		changelog: 'Faster startup.',
		publishedAt: '2026-10-17T12:00:00.000Z',
		changelogs: [
			{
				version: '3.1.0',
				changelog: 'Faster startup.',
				publishedAt: '2026-10-17T12:00:00.000Z',
			},
		],
	},
	requiredVersion: '3.2.0',
};

const requested: URL[] = [];

const server = Bun.serve({
	port: 0,
	routes: {
		'/api/v1/loader/updates': (request) => {
			requested.push(new URL(request.url));

			return Response.json(UPDATE);
		},
	},
});

afterAll(() => server.stop(true));

function loader(version: string, requiredVersion?: string): UnboundLoaderInfo {
	return {
		origin: 'unbound-app/loader-ios',
		version,
		bytecodeVersion: 96,
		...(requiredVersion ? { requiredVersion } : {}),
	};
}

describe('buildLoaderUpdateQuery', () => {
	test('asks about the installed loader on each platform a loader ships for', () => {
		expect(buildLoaderUpdateQuery('ios', loader('3.0.0'))).toEqual({
			platform: 'ios',
			version: '3.0.0',
		});
		expect(buildLoaderUpdateQuery('android', loader('1.2.0-beta.1'))).toEqual({
			platform: 'android',
			version: '1.2.0-beta.1',
		});
	});

	test('names the channel only when the server publishes bundles to it', () => {
		expect(buildLoaderUpdateQuery('ios', loader('3.0.0'), 'beta')).toEqual({
			platform: 'ios',
			version: '3.0.0',
			channel: 'beta',
		});
		expect(buildLoaderUpdateQuery('ios', loader('3.0.0'), 'local')).toEqual({
			platform: 'ios',
			version: '3.0.0',
		});
	});

	test('skips the check without loader info, on other platforms and for non-semver versions', () => {
		expect(buildLoaderUpdateQuery('ios', undefined)).toBeUndefined();
		expect(buildLoaderUpdateQuery('web', loader('3.0.0'))).toBeUndefined();

		for (const version of ['dev', 'v3.0.0', '3.0', '']) {
			expect(buildLoaderUpdateQuery('ios', loader(version))).toBeUndefined();
		}
	});
});

describe('fetchLoaderUpdate', () => {
	const baseUrl = server.url.origin;

	test('sends no request when the loader cannot be checked', async () => {
		requested.length = 0;

		expect(await fetchLoaderUpdate({ baseUrl, platform: 'ios', loader: undefined })).toEqual({
			update: null,
			requiredVersion: null,
		});
		expect(
			await fetchLoaderUpdate({ baseUrl, platform: 'ios', loader: loader('dev', '3.2.0') }),
		).toEqual({ update: null, requiredVersion: '3.2.0' });
		expect(requested).toEqual([]);
	});

	test("asks about the installed loader and returns the server's update", async () => {
		requested.length = 0;

		expect(
			await fetchLoaderUpdate({
				baseUrl,
				platform: 'ios',
				loader: loader('3.0.0'),
				channel: 'stable',
			}),
		).toEqual(UPDATE);
		expect(requested.map((url) => Object.fromEntries(url.searchParams))).toEqual([
			{ platform: 'ios', version: '3.0.0', channel: 'stable' },
		]);
	});
});

describe('resolveRequiredLoader', () => {
	test("prefers the server's requirement, then the loader's own refusal", () => {
		expect(resolveRequiredLoader(loader('3.0.0', '3.1.0'), '3.2.0')).toBe('3.2.0');
		expect(resolveRequiredLoader(loader('3.0.0', '3.1.0'), null)).toBe('3.1.0');
		expect(resolveRequiredLoader(loader('3.0.0'), null)).toBeNull();
	});

	test('drops a requirement the installed loader already meets', () => {
		expect(resolveRequiredLoader(loader('3.2.0', '3.1.0'))).toBeNull();
		expect(resolveRequiredLoader(loader('3.2.0'), '3.2.0')).toBeNull();
	});
});
