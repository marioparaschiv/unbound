import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { afterEach, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createTarGz } from '../src/lib/tar';

const roots: string[] = [];

afterEach(() => {
	for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

test('packs files that the system tar extracts intact', () => {
	const dir = mkdtempSync(join(tmpdir(), 'ubd-tar-'));

	roots.push(dir);

	const bundle = 'x'.repeat(1_000);
	const archive = join(dir, 'plugin.tar.gz');

	writeFileSync(
		archive,
		createTarGz([
			{ name: 'manifest.json', data: Buffer.from('{"id":"a"}') },
			{ name: 'index.js', data: Buffer.from(bundle) },
		]),
	);

	const listed = spawnSync('tar', ['-tzvf', archive], { encoding: 'utf8' });

	expect(listed.status).toBe(0);
	expect(listed.stdout).toContain('manifest.json');

	const extracted = spawnSync('tar', ['-xzf', archive, '-C', dir], { encoding: 'utf8' });

	expect(extracted.status).toBe(0);
	expect(readFileSync(join(dir, 'manifest.json'), 'utf8')).toBe('{"id":"a"}');
	expect(readFileSync(join(dir, 'index.js'), 'utf8')).toBe(bundle);
});

test('refuses a name ustar cannot hold', () => {
	expect(() => createTarGz([{ name: 'a'.repeat(101), data: new Uint8Array() }])).toThrow();
});
