import { beforeEach, describe, expect, test } from 'bun:test';

import { createScopedFetch, hostAllowed } from '~/addons/network';

const sent: string[] = [];

function send(input: Parameters<typeof fetch>[0]) {
	sent.push(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);

	return Promise.resolve(new Response('ok'));
}

beforeEach(() => {
	sent.length = 0;
});

describe('hostAllowed', () => {
	test('matches exact hosts and wildcard domains with their subdomains', () => {
		expect(hostAllowed('api.example.com', ['api.example.com'])).toBe(true);
		expect(hostAllowed('example.com', ['*.example.com'])).toBe(true);
		expect(hostAllowed('cdn.example.com', ['*.example.com'])).toBe(true);
		expect(hostAllowed('evilexample.com', ['*.example.com'])).toBe(false);
		expect(hostAllowed('other.com', ['api.example.com'])).toBe(false);
	});
});

describe('createScopedFetch', () => {
	test('passes every request through without a network list', async () => {
		await createScopedFetch('Plugin', undefined, send).fetch('https://anywhere.dev/x');

		expect(sent).toEqual(['https://anywhere.dev/x']);
	});

	test('refuses hosts the list leaves out and records them', async () => {
		const scoped = createScopedFetch('Plugin', ['api.example.com'], send);

		await scoped.fetch('https://api.example.com/v1');
		const refused = await scoped
			.fetch('https://tracker.dev/beacon')
			.catch((error: Error) => error);

		expect(refused).toBeInstanceOf(TypeError);

		expect(sent).toEqual(['https://api.example.com/v1']);
		expect(scoped.blocked()).toEqual(['tracker.dev']);
	});
});
