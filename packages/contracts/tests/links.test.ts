import { describe, expect, test } from 'bun:test';

import { createUnboundLink, parseUnboundLink } from '../src/links';

describe('createUnboundLink', () => {
	test('builds an install link the parser reads back', () => {
		const url = createUnboundLink({ action: 'install', id: 'acme.hello-world_2' });

		expect(url).toBe('astral://install?id=acme.hello-world_2');
		expect(parseUnboundLink(url)).toEqual({ action: 'install', id: 'acme.hello-world_2' });
	});
});

describe('parseUnboundLink', () => {
	test('reads the scheme and the relay form, ignoring parameters Discord appends', () => {
		const cases: [string, ReturnType<typeof parseUnboundLink>][] = [
			['astral://install?id=acme.hello', { action: 'install', id: 'acme.hello' }],
			['ASTRAL://install?id=acme.hello', { action: 'install', id: 'acme.hello' }],
			[
				'com.hammerandchisel.discord://astral/install?id=acme.hello&fromAppsFlyer=false',
				{ action: 'install', id: 'acme.hello' },
			],
			[
				'astral://install?fromAppsFlyer=false&id=acme%2Ehello#top',
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
			'astral://install',
			'astral://install?id=',
			'astral://install?id=../etc',
			'astral://install?id=a%2Fb',
			'astral://install?id=%E0%A4%A',
			`astral://install?id=${'a'.repeat(101)}`,
			'astral://share?url=https://example.com',
			'astral://install/extra?id=acme.hello',
			'discord://astral/install?id=acme.hello',
			'com.hammerandchisel.discord://login?code=1',
			'com.hammerandchisel.discord://astralx/install?id=acme.hello',
			'https://discord.gg/unbound',
		];

		for (const url of urls) {
			expect({ url, link: parseUnboundLink(url) }).toEqual({ url, link: undefined });
		}
	});
});
