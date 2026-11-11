import { mkdtempSync, writeFileSync } from 'node:fs';
import { describe, expect, test } from 'bun:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { readJson } from '~/json';

function tempFile(name: string, content: string): string {
	const dir = mkdtempSync(join(tmpdir(), 'sdk-generate-'));
	const path = join(dir, name);

	writeFileSync(path, content);

	return path;
}

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
