import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { afterAll, describe, expect, test } from 'bun:test';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { lowerChunk } from '../scripts/build/plugins/downlevel';
import { symbolicate } from '../scripts/build/symbolicate';

const root = join(import.meta.dir, '..');
const dist = mkdtempSync(join(tmpdir(), 'unbound-maps-'));

afterAll(() => rmSync(dist, { recursive: true, force: true }));

describe('lowerChunk', () => {
	test('maps lowered code inside the wrapper back to the chunk line it came from', () => {
		const chunk =
			'const a = 1;\nclass Parser {\n\tparse() {\n\t\tthrow new Error(a);\n\t}\n}\n';
		const result = lowerChunk(root, chunk, true);

		if (!result.map) {
			throw new Error('lowerChunk returned no source map.');
		}

		const lines = result.code.split('\n');
		const line = lines.findIndex((text) => text.includes('throw new Error(a)'));
		const position = originalPositionFor(new TraceMap(result.map), {
			line: line + 1,
			column: lines[line]?.indexOf('throw') ?? 0,
		});

		expect(position.line).toBe(4);
	});
});

describe('symbolicate', () => {
	const bundle = join(dist, 'unbound.98.bundle');

	writeFileSync(
		`${bundle}.map`,
		JSON.stringify({ version: 3, sources: ['unbound.js'], names: [], mappings: 'AAAA,UAAU' }),
	);
	writeFileSync(
		join(dist, 'unbound.js.map'),
		JSON.stringify({ version: 3, sources: ['../src/a.ts'], names: [], mappings: 'AAAA,UACE' }),
	);

	test('rewrites frames tagged with the loader source URL or the bundle file name', () => {
		const trace = [
			'Error: x',
			'    at parse (address at unbound:1:10)',
			'    at run (address at /var/mobile/unbound.98.bundle:1:5)',
		].join('\n');

		expect(symbolicate(trace, bundle)).toBe(
			['Error: x', '    at parse (src/a.ts:2:3)', '    at run (src/a.ts:1:1)'].join('\n'),
		);
	});

	test('leaves frames from other bundles as printed', () => {
		const trace = '    at render (address at main.jsbundle:1:10)';

		expect(symbolicate(trace, bundle)).toBe(trace);
	});
});
