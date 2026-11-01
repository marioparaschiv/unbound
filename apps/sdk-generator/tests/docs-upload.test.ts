import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { beforeEach, describe, expect, test } from 'bun:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
	IMMUTABLE_CACHE_CONTROL,
	MUTABLE_CACHE_CONTROL,
	uploadDocs,
	type DocsBucket,
} from '../src/docs-upload';

type StoredObject = {
	body: string;
	cacheControl: string;
};

function createMemoryBucket(objects: Map<string, StoredObject>): DocsBucket {
	return {
		read: async (key) => objects.get(key)?.body,
		exists: async (key) => objects.has(key),
		list: async (prefix) => [...objects.keys()].filter((key) => key.startsWith(prefix)),
		write: async (key, body, cacheControl) => {
			objects.set(key, { body, cacheControl });
		},
	};
}

let dir: string;
let objects: Map<string, StoredObject>;
let bucket: DocsBucket;

function writeLocal(version: string, body: string) {
	mkdirSync(join(dir, 'docs', 'api'), { recursive: true });
	writeFileSync(join(dir, 'docs', 'api', `${version}.json`), body);
}

beforeEach(() => {
	dir = mkdtempSync(join(tmpdir(), 'sdk-docs-'));
	objects = new Map();
	bucket = createMemoryBucket(objects);
});

describe('uploadDocs', () => {
	test('publishes main with a short cache and lists it', async () => {
		writeLocal('main', '{"main":1}');

		expect(await uploadDocs(dir, 'main', bucket)).toEqual([
			'docs/api/main.json',
			'docs/api/versions.json',
		]);
		expect(objects.get('docs/api/main.json')).toEqual({
			body: '{"main":1}',
			cacheControl: MUTABLE_CACHE_CONTROL,
		});
		expect(JSON.parse(objects.get('docs/api/versions.json')?.body ?? '')).toEqual({
			package: 'api',
			versions: ['main'],
		});
	});

	test('adds a release to the remote manifest, immutable, without losing earlier versions', async () => {
		objects.set('docs/api/versions.json', {
			body: JSON.stringify({ package: 'api', versions: ['main', 'v0.11.0'] }),
			cacheControl: MUTABLE_CACHE_CONTROL,
		});
		writeLocal('v0.12.0', '{"tag":1}');

		await uploadDocs(dir, 'v0.12.0', bucket);

		expect(objects.get('docs/api/v0.12.0.json')?.cacheControl).toBe(IMMUTABLE_CACHE_CONTROL);
		expect(JSON.parse(objects.get('docs/api/versions.json')?.body ?? '').versions).toEqual([
			'main',
			'v0.12.0',
			'v0.11.0',
		]);
	});

	test('rerunning a release writes nothing', async () => {
		writeLocal('v0.12.0', '{"tag":1}');
		await uploadDocs(dir, 'v0.12.0', bucket);
		const before = new Map(objects);

		writeLocal('v0.12.0', '{"tag":2}');

		expect(await uploadDocs(dir, 'v0.12.0', bucket)).toEqual([]);
		expect(objects).toEqual(before);
	});

	test('lists a release whose earlier run failed before writing the manifest', async () => {
		objects.set('docs/api/v0.12.0.json', {
			body: '{"tag":1}',
			cacheControl: IMMUTABLE_CACHE_CONTROL,
		});
		objects.set('docs/api/versions.json', {
			body: JSON.stringify({ package: 'api', versions: ['main'] }),
			cacheControl: MUTABLE_CACHE_CONTROL,
		});
		writeLocal('main', '{"main":1}');

		await uploadDocs(dir, 'main', bucket);

		expect(JSON.parse(objects.get('docs/api/versions.json')?.body ?? '').versions).toEqual([
			'main',
			'v0.12.0',
		]);
	});

	test('rerunning main rewrites its docs but not the manifest', async () => {
		writeLocal('main', '{"main":1}');
		await uploadDocs(dir, 'main', bucket);

		expect(await uploadDocs(dir, 'main', bucket)).toEqual(['docs/api/main.json']);
	});
});
