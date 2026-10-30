import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { afterEach, expect, test } from 'bun:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { readManifest } from '../src/lib/manifest';
import { loadConfig } from '../src/lib/config';

const roots: string[] = [];

afterEach(() => {
	for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function directoryWith(name: string, contents: string): string {
	const dir = mkdtempSync(join(tmpdir(), 'ubd-config-test-'));

	roots.push(dir);
	writeFileSync(join(dir, name), contents);

	return dir;
}

test('loadConfig names the config file that is not JSON or has the wrong shape', () => {
	const notJson = directoryWith('unbound.config.json', '{ addons: ');
	const wrongShape = directoryWith('unbound.config.json', '{"addons":"plugins/*"}');

	expect(loadConfig(notJson)).toEqual({
		error: expect.stringContaining(`Invalid ${join(notJson, 'unbound.config.json')}: `),
	});
	expect(loadConfig(wrongShape)).toEqual({
		error: expect.stringContaining('addons'),
	});
});

test('loadConfig fills the defaults for a valid config', () => {
	const dir = directoryWith('unbound.config.json', '{"output":"build"}');

	expect(loadConfig(dir)).toEqual({
		config: { addons: ['plugins/*', 'themes/*'], build: 'bun run build', output: 'build' },
		dir,
		bare: false,
	});
});

test('readManifest refuses a manifest missing the fields the platform needs', () => {
	const dir = directoryWith('manifest.json', '{"id":"a.b","main":"index.js"}');

	expect(() => readManifest(dir)).toThrow(`Invalid ${join(dir, 'manifest.json')}`);
});
