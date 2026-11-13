import { describe, expect, test } from 'bun:test';

import {
	pickAddress,
	readSocketAddress,
	readTxtRecord,
	toDiscoveredBridge,
} from '~/debugger/bridge-service.dev';

function txt(...entries: string[]) {
	return new Uint8Array(
		entries.flatMap((entry) => [entry.length, ...new TextEncoder().encode(entry)]),
	);
}

describe('readTxtRecord', () => {
	test('reads length-prefixed key=value strings', () => {
		expect(readTxtRecord(txt('proto=1', 'by=devtools', 'code=4827'))).toEqual({
			proto: '1',
			by: 'devtools',
			code: '4827',
		});
	});

	test('keeps a bare key, keeps `=` inside a value and skips empty or keyless entries', () => {
		expect(readTxtRecord(txt('flag', 'a=b=c', '', '=x'))).toEqual({ flag: '', a: 'b=c' });
	});
});

describe('readSocketAddress', () => {
	test('reads an IPv4 sockaddr_in as host:port', () => {
		expect(readSocketAddress(new Uint8Array([16, 2, 0x23, 0x84, 192, 168, 64, 1, 0, 0]))).toBe(
			'192.168.64.1:9092',
		);
	});

	test('skips other families and short buffers', () => {
		expect(readSocketAddress(new Uint8Array([28, 30, 0x23, 0x84, 0, 0, 0, 0]))).toBeUndefined();
		expect(readSocketAddress(new Uint8Array([16, 2]))).toBeUndefined();
	});
});

describe('pickAddress', () => {
	test('prefers a routable address over a link-local one', () => {
		expect(pickAddress([undefined, '169.254.9.1:9092', '192.168.1.5:9092'])).toBe(
			'192.168.1.5:9092',
		);
		expect(pickAddress(['169.254.9.1:9092'])).toBe('169.254.9.1:9092');
		expect(pickAddress([undefined])).toBeUndefined();
	});
});

describe('toDiscoveredBridge', () => {
	test('builds a bridge from a record of this protocol', () => {
		expect(
			toDiscoveredBridge('Mac', '10.0.0.2:9090', { proto: '1', by: 'cli', code: '0042' }),
		).toEqual({ computer: 'Mac', address: '10.0.0.2:9090', by: 'cli', code: '0042' });
	});

	test('skips another protocol or a missing or malformed pairing code', () => {
		expect(toDiscoveredBridge('Mac', 'a:1', { proto: '2', code: '1234' })).toBeUndefined();
		expect(toDiscoveredBridge('Mac', 'a:1', { proto: '1' })).toBeUndefined();
		expect(toDiscoveredBridge('Mac', 'a:1', { proto: '1', code: '12a4' })).toBeUndefined();
	});
});
