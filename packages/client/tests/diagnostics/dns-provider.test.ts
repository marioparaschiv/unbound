import { describe, expect, test } from 'bun:test';

import { privateDnsName, resolverName } from '~/diagnostics/dns-provider';

describe('resolverName', () => {
	test('names a public resolver over the router in front of it', () => {
		expect(resolverName(['192.168.1.1', '1.1.1.1'])).toBe('Cloudflare');
		expect(resolverName(['2a07:a8c0::ab:cd'])).toBe('NextDNS');
	});

	test('calls a router or LAN resolver local and anything else other', () => {
		expect(resolverName(['192.168.178.1'])).toBe('local');
		expect(resolverName(['fe80::1'])).toBe('local');
		expect(resolverName(['203.0.113.7'])).toBe('other');
		expect(resolverName([])).toBeUndefined();
	});
});

describe('privateDnsName', () => {
	test('names the provider without the personal hostname', () => {
		expect(privateDnsName(true, 'abc123.dns.nextdns.io')).toBe('NextDNS');
		expect(privateDnsName(true, 'dns.example.org')).toBe('custom');
	});

	test('says automatic without a hostname and nothing when off', () => {
		expect(privateDnsName(true)).toBe('automatic');
		expect(privateDnsName(false, 'dns.google')).toBeUndefined();
	});
});
