import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test';
import type { UnboundNativeBridge } from '@unbound-app/types';

const writes: [string, string, string][] = [];

mock.module('~/native/fs', () => ({
	default: {
		writeFile: async (path: string, content: string, encoding: string) => {
			writes.push([path, content, encoding]);
		},
	},
}));

const { downloadFile } = await import('./download-file');

function bridge(downloads: [string, string][]): UnboundNativeBridge {
	return {
		getLoader: () => ({ origin: 'test', version: '2.0.0', bytecodeVersion: 96 }),
		getPlugins: () => [],
		getThemes: () => [],
		getSha256: () => '',
		downloadFile: async (url, path) => {
			downloads.push([url, path]);
		},
	};
}

afterEach(() => {
	globalThis.UnboundNative = undefined;
	mock.restore();
	writes.length = 0;
});

describe('downloadFile', () => {
	test('hands a path in the Unbound folder to the loader, relative to that folder', async () => {
		const downloads: [string, string][] = [];

		globalThis.UnboundNative = bridge(downloads);

		await downloadFile('https://cdn.invalid/a.ttf', 'Unbound/Fonts/a.ttf');

		expect(downloads).toEqual([['https://cdn.invalid/a.ttf', 'Fonts/a.ttf']]);
		expect(writes).toEqual([]);
	});

	test('writes the bytes as base64 without a loader', async () => {
		spyOn(globalThis, 'fetch').mockResolvedValue(new Response(new Uint8Array([1, 2, 3])));

		await downloadFile('https://cdn.invalid/a.ttf', 'Unbound/Fonts/a.ttf');

		expect(writes).toEqual([['Unbound/Fonts/a.ttf', 'AQID', 'base64']]);
	});

	test('writes a path outside the Unbound folder through JS even with a loader', async () => {
		const downloads: [string, string][] = [];

		globalThis.UnboundNative = bridge(downloads);
		spyOn(globalThis, 'fetch').mockResolvedValue(new Response(new Uint8Array([1])));

		await downloadFile('https://cdn.invalid/a.ttf', 'Other/a.ttf');

		expect(downloads).toEqual([]);
		expect(writes).toEqual([['Other/a.ttf', 'AQ==', 'base64']]);
	});

	test('rejects a failed request without writing', async () => {
		spyOn(globalThis, 'fetch').mockResolvedValue(new Response('gone', { status: 404 }));

		const failure = await downloadFile('https://cdn.invalid/a.ttf', 'Unbound/Fonts/a.ttf').then(
			() => undefined,
			(error: Error) => error.message,
		);

		expect(failure).toContain('HTTP 404');
		expect(writes).toEqual([]);
	});
});
