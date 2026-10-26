import { afterEach, expect, test } from 'bun:test';

import { createTempDir, type TempDir } from './helpers/ubd';
import { discoverAddons } from '../src/lib/discovery';
import { loadConfig } from '../src/lib/config';

const dirs: TempDir[] = [];

afterEach(() => {
	for (const dir of dirs.splice(0)) dir.remove();
});

function manifest(id: string): string {
	return JSON.stringify({ id, name: id, main: 'index.js', version: '1.0.0' });
}

test('finds addons without descending into node_modules or .git', async () => {
	const workspace = createTempDir({
		'unbound.config.json': JSON.stringify({ addons: ['**'], build: 'true', output: 'dist' }),
		'plugins/first/manifest.json': manifest('com.example.first'),
		'plugins/nested/second/manifest.json': manifest('com.example.second'),
		'node_modules/dependency/manifest.json': manifest('com.example.dependency'),
		'plugins/first/node_modules/dependency/manifest.json': manifest('com.example.nested'),
		'.git/manifest.json': manifest('com.example.git'),
	});

	dirs.push(workspace);

	const addons = await discoverAddons(loadConfig(workspace.path));

	expect(addons.map((addon) => addon.id)).toEqual(['com.example.first', 'com.example.second']);
});
