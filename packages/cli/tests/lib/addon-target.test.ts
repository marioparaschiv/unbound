import { afterEach, expect, test } from 'bun:test';
import { join } from 'node:path';

import { resolveAddonTarget } from '~/lib/addon-target';

import { createTempDir, type TempDir } from '../helpers/ubd';

const dirs: TempDir[] = [];
const cwd = process.cwd();

afterEach(() => {
	process.chdir(cwd);

	for (const dir of dirs.splice(0)) dir.remove();
});

function manifest(id: string): string {
	return JSON.stringify({ id, name: id, main: 'index.js', version: '1.0.0' });
}

test('resolves an addon directory from outside its workspace, as from the repo root', async () => {
	const root = createTempDir({
		'packages/plugins/unbound.config.json': JSON.stringify({
			addons: ['*'],
			build: 'true',
			output: 'dist',
		}),
		'packages/plugins/first/manifest.json': manifest('com.example.first'),
	});

	dirs.push(root);
	process.chdir(root.path);

	const resolved = await resolveAddonTarget('packages/plugins/first', { build: false });

	expect(resolved).toEqual({
		addon: expect.objectContaining({
			id: 'com.example.first',
			dir: join(root.path, 'packages/plugins/first'),
		}),
	});
});
