import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { contentHash } from '../content-hash';

function build(files: Record<string, string>): string {
	const dir = mkdtempSync(join(tmpdir(), 'content-hash-'));

	for (const [path, text] of Object.entries(files)) {
		mkdirSync(join(dir, path, '..'), { recursive: true });
		writeFileSync(join(dir, path), text);
	}

	return dir;
}

const stamps = (revision: string, version: string) => ({
	$$VERSION$$: revision,
	$$CLIENT_VERSION$$: version,
});

describe('contentHash', () => {
	test('hashes two builds of the same code alike despite their revision and version', () => {
		const first = build({ 'unbound.js': 'a("abc1234","3.1.0");', 'i18n/en.json': '{}' });
		const second = build({ 'unbound.js': 'a("def5678","3.2.0");', 'i18n/en.json': '{}' });

		expect(contentHash(first, stamps('abc1234', '3.1.0'))).toBe(
			contentHash(second, stamps('def5678', '3.2.0')),
		);
	});

	test('changes when any shipped file changes', () => {
		const before = build({ 'unbound.js': 'a();', 'i18n/en.json': '{}' });
		const code = build({ 'unbound.js': 'b();', 'i18n/en.json': '{}' });
		const asset = build({ 'unbound.js': 'a();', 'i18n/en.json': '{"a":1}' });
		const hash = contentHash(before, stamps('abc1234', '3.1.0'));

		expect(contentHash(code, stamps('abc1234', '3.1.0'))).not.toBe(hash);
		expect(contentHash(asset, stamps('abc1234', '3.1.0'))).not.toBe(hash);
	});

	test('ignores the manifest, signatures, source maps, patches and bytecode', () => {
		const bare = build({ 'unbound.js': 'a();', 'unbound.98.bundle': 'bytecode' });
		const full = build({
			'unbound.js': 'a();',
			'unbound.98.bundle': 'recompiled bytecode',
			'manifest.json': '{"buildTime":"now"}',
			'unbound.js.sig': 'sig',
			'unbound.98.bundle.map': '{}',
			'patches/unbound.98.bundle.patch': 'patch',
		});

		expect(contentHash(full, stamps('abc1234', '3.1.0'))).toBe(
			contentHash(bare, stamps('abc1234', '3.1.0')),
		);
	});
});
