import { expect, mock, test } from 'bun:test';
import { strFromU8, unzipSync } from 'fflate';

const FILES: Record<string, string> = {
	'Unbound/Logs/unbound.log': 'started\ncontact me@example.com please',
	'Unbound/Logs/native.1.log': 'native line',
	'Unbound/native-crash.txt': 'SIGSEGV in Unbound.dylib',
	'Unbound/crash-history.json': JSON.stringify([
		{ at: 0, crash: 'SIGTRAP in New Member Sprout', stack: 'Signal 5\n#0 0x1' },
		{ at: 1000, crash: 'SIGSEGV' },
	]),
	'Unbound/Logs/unbound.1.log': `${'old line\n'.repeat(80_000)}newest line`,
};

mock.module('~/native/fs', () => ({
	default: {
		documentsPath: '/docs',
		exists: async (path: string) => path in FILES,
		readFile: async (path: string) => FILES[path] ?? '',
		writeFile: async () => undefined,
		removeFile: async () => true,
	},
}));

const { buildDiagnosticsZip } = await import('~/diagnostics/diagnostics-zip');

function unzip(base64: string): Record<string, string> {
	const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));

	return Object.fromEntries(
		Object.entries(unzipSync(bytes)).map(([name, data]) => [name, strFromU8(data)]),
	);
}

test('zips the logs, crash state, report, capability use and entitlements that exist', async () => {
	const files = unzip(
		await buildDiagnosticsZip({ report: { client: 'v3' }, entitlements: '<plist/>' }),
	);

	expect(Object.keys(files).sort()).toEqual([
		'Entitlements.xml',
		'capability-use.json',
		'crashes/1970-01-01T00-00-00-000Z-SIGTRAP-in-New-Member-Sprout.txt',
		'debug-info.json',
		'logs/native.1.log',
		'logs/unbound.1.log',
		'logs/unbound.log',
		'state/crash-history.json',
		'state/native-crash.txt',
	]);
	expect(JSON.parse(files['debug-info.json'] ?? '')).toEqual({ client: 'v3' });
	expect(files['state/native-crash.txt']).toBe('SIGSEGV in Unbound.dylib');
	expect(files['crashes/1970-01-01T00-00-00-000Z-SIGTRAP-in-New-Member-Sprout.txt']).toBe(
		'Signal 5\n#0 0x1',
	);
});

test('scrubs secrets from the logs', async () => {
	const files = unzip(await buildDiagnosticsZip({ report: {} }));

	expect(files['logs/unbound.log']).not.toContain('me@example.com');
	expect(files['logs/unbound.log']).toContain('started');
});

test('keeps only the newest part of a long log, cut at a line', async () => {
	const files = unzip(await buildDiagnosticsZip({ report: {} }));
	const log = files['logs/unbound.1.log'] ?? '';

	expect(log.length).toBeLessThanOrEqual(512 * 1024);
	expect(log.endsWith('newest line')).toBe(true);
	expect(log.startsWith('old line')).toBe(true);
});
