import { mkdtempSync, writeFileSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { resolveOutDir, readJson } from '../src/paths';

function tempFile(name: string, content: string): string {
	const dir = mkdtempSync(join(tmpdir(), 'sdk-generate-'));
	const path = join(dir, name);

	writeFileSync(path, content);

	return path;
}

describe('resolveOutDir', () => {
	test('resolves a nested directory inside the root', () => {
		expect(resolveOutDir('/repo', 'packages/api/src')).toBe('/repo/packages/api/src');
	});

	test('rejects the root itself', () => {
		expect(() => resolveOutDir('/repo', '.')).toThrow('inside the repository');
	});

	test('rejects paths escaping the root', () => {
		expect(() => resolveOutDir('/repo', '..')).toThrow('inside the repository');
		expect(() => resolveOutDir('/repo', '/elsewhere')).toThrow('inside the repository');
	});

	test('rejects sibling directories sharing the root as a prefix', () => {
		expect(() => resolveOutDir('/repo', '../repo-backup')).toThrow('inside the repository');
	});
});

describe('readJson', () => {
	test('parses a JSON object', () => {
		const path = tempFile('manifest.json', '{"version":"1.0.0"}');

		expect(readJson(path).version).toBe('1.0.0');
	});

	test('names the file on malformed JSON', () => {
		const path = tempFile('broken.json', '{nope');

		expect(() => readJson(path)).toThrow(path);
	});

	test('rejects non-object JSON', () => {
		const path = tempFile('scalar.json', '42');

		expect(() => readJson(path)).toThrow('object');
	});
});
