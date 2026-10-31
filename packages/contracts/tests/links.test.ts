import { describe, expect, test } from 'bun:test';

import { createUnboundLink, parseUnboundLink } from '../src/links';

describe('createUnboundLink', () => {
	test('builds an install link the parser reads back', () => {
		const url = createUnboundLink({ action: 'install', id: 'acme.hello-world_2' });

		expect(url).toBe('unbound://install?id=acme.hello-world_2');
		expect(parseUnboundLink(url)).toEqual({ action: 'install', id: 'acme.hello-world_2' });
	});
});

describe('parseUnboundLink', () => {
	test('reads the scheme and the relay form, ignoring parameters Discord appends', () => {
		const cases: [string, ReturnType<typeof parseUnboundLink>][] = [
			['unbound://install?id=acme.hello', { action: 'install', id: 'acme.hello' }],
			['UNBOUND://install?id=acme.hello', { action: 'install', id: 'acme.hello' }],
			[
				'com.hammerandchisel.discord://unbound/install?id=acme.hello&fromAppsFlyer=false',
				{ action: 'install', id: 'acme.hello' },
			],
			[
				'unbound://install?fromAppsFlyer=false&id=acme%2Ehello#top',
				{ action: 'install', id: 'acme.hello' },
			],
		];

		for (const [url, expected] of cases) {
			expect({ url, link: parseUnboundLink(url) }).toEqual({ url, link: expected });
		}
	});

	test('rejects everything that is not a well-formed Unbound link', () => {
		const urls = [
			'',
			'unbound://install',
			'unbound://install?id=',
			'unbound://install?id=../etc',
			'unbound://install?id=a%2Fb',
			'unbound://install?id=%E0%A4%A',
			`unbound://install?id=${'a'.repeat(101)}`,
			'unbound://share?url=https://example.com',
			'unbound://install/extra?id=acme.hello',
			'discord://unbound/install?id=acme.hello',
			'com.hammerandchisel.discord://login?code=1',
			'com.hammerandchisel.discord://unboundx/install?id=acme.hello',
			'https://discord.gg/unbound',
		];

		for (const url of urls) {
			expect({ url, link: parseUnboundLink(url) }).toEqual({ url, link: undefined });
		}
	});
});
