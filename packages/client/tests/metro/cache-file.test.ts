import { beforeEach, describe, expect, mock, test } from 'bun:test';
import type { SettingsValue } from '@unbound-app/types';

const disk = new Map<string, string>();
const bucket = new Map<string, SettingsValue | undefined>();
const files: {
	read?: (path: string) => string | undefined;
	write?: (path: string, text: string) => boolean;
} = {};
let clears = 0;

mock.module('~/native/native', () => ({ NativePlatform: { files } }));
mock.module('~/storage/api', () => ({
	getBucket: () => ({
		get: (key: string, def: SettingsValue | undefined) =>
			bucket.has(key) ? bucket.get(key) : def,
		set: (key: string, value: SettingsValue) => void bucket.set(key, value),
		clear: () => {
			clears++;
			bucket.clear();
		},
	}),
}));

const { readStoredCache, writeStoredCache } = await import('~/metro/cache-file');

const FIELDS = ['info', 'assets'];

function withFiles() {
	files.read = (path) => disk.get(path);
	files.write = (path, text) => {
		disk.set(path, text);

		return true;
	};
}

beforeEach(() => {
	disk.clear();
	bucket.clear();
	clears = 0;
	delete files.read;
	delete files.write;
});

describe('metro cache file', () => {
	test('reads and writes the whole cache as its own file, leaving settings alone', () => {
		withFiles();
		disk.set(
			'metro-cache.json',
			JSON.stringify({ info: { buildNumber: 1 }, assets: { 'a.png': 4 } }),
		);

		expect(readStoredCache(FIELDS)).toEqual({
			info: { buildNumber: 1 },
			assets: { 'a.png': 4 },
		});

		writeStoredCache({ info: { buildNumber: 2 }, assets: {} }, ['info']);

		expect(JSON.parse(disk.get('metro-cache.json') ?? '')).toEqual({
			info: { buildNumber: 2 },
			assets: {},
		});
		expect(clears).toBe(0);
	});

	test('carries the settings Bucket over once, then empties it', () => {
		withFiles();
		bucket.set('assets', { 'b.png': 7 });

		expect(readStoredCache(FIELDS)).toEqual({ info: undefined, assets: { 'b.png': 7 } });

		writeStoredCache({ assets: { 'b.png': 7 } }, ['assets']);
		writeStoredCache({ assets: { 'b.png': 8 } }, ['assets']);

		expect(JSON.parse(disk.get('metro-cache.json') ?? '')).toEqual({ assets: { 'b.png': 8 } });
		expect(bucket.size).toBe(0);
		expect(clears).toBe(1);
	});

	test('reads a malformed file as an empty cache', () => {
		withFiles();

		for (const text of ['{broken', '[1]', 'null']) {
			disk.set('metro-cache.json', text);

			expect(readStoredCache(FIELDS)).toEqual({});
		}
	});

	test('keeps the cache in the settings Bucket under a loader without file access', () => {
		bucket.set('info', { buildNumber: 3 });

		expect(readStoredCache(FIELDS)).toEqual({ info: { buildNumber: 3 }, assets: undefined });

		writeStoredCache({ info: { buildNumber: 4 }, assets: { 'c.png': 1 } }, ['assets']);

		expect(bucket.get('assets')).toEqual({ 'c.png': 1 });
		expect(bucket.get('info')).toEqual({ buildNumber: 3 });
		expect(disk.size).toBe(0);
	});
});
