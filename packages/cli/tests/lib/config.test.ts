import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { afterEach, expect, test } from 'bun:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { findNestedWorkspaces, loadConfig } from '~/lib/config';
import { readManifest } from '~/lib/manifest';

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

test('loadConfig finds the one workspace below a monorepo root', () => {
	const root = mkdtempSync(join(tmpdir(), 'ubd-config-test-'));

	roots.push(root);
	mkdirSync(join(root, 'packages', 'plugins'), { recursive: true });
	mkdirSync(join(root, 'node_modules', 'other'), { recursive: true });
	writeFileSync(join(root, 'packages', 'plugins', 'unbound.config.json'), '{}');
	writeFileSync(join(root, 'node_modules', 'other', 'unbound.config.json'), '{}');

	expect(loadConfig(root)).toMatchObject({ dir: join(root, 'packages', 'plugins'), bare: false });
});

test('findNestedWorkspaces lists every workspace below a folder, and none below an addon', () => {
	const addon = directoryWith('manifest.json', '{}');
	const ambiguous = mkdtempSync(join(tmpdir(), 'ubd-config-test-'));

	roots.push(ambiguous);
	mkdirSync(join(addon, 'nested'));
	writeFileSync(join(addon, 'nested', 'unbound.config.json'), '{}');

	for (const name of ['a', 'b']) {
		mkdirSync(join(ambiguous, name));
		writeFileSync(join(ambiguous, name, 'unbound.config.json'), '{}');
	}

	expect(findNestedWorkspaces(addon)).toEqual([]);
	expect(findNestedWorkspaces(ambiguous)).toEqual([join(ambiguous, 'a'), join(ambiguous, 'b')]);
	expect(loadConfig(ambiguous)).toMatchObject({ dir: ambiguous, bare: true });
});
