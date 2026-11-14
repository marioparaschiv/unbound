import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { brotliDecompressSync, type BrotliOptions } from 'node:zlib';
import { describe, expect, test } from 'bun:test';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createPatches, patchPath } from '../patches';

const sha512 = (text: string) => createHash('sha512').update(text).digest('hex');

const oldBundle = `${'const shared = "unchanged code";\n'.repeat(400)}old tail`;
const newBundle = `${'const shared = "unchanged code";\n'.repeat(400)}new tail`;

function build() {
	const dir = mkdtempSync(join(tmpdir(), 'patches-'));

	writeFileSync(join(dir, 'unbound.98.bundle'), newBundle);
	writeFileSync(join(dir, 'devtools.98.bundle'), 'devtools');
	writeFileSync(
		join(dir, 'manifest.json'),
		JSON.stringify({
			revision: 'new',
			sha512: {
				'unbound.98.bundle': sha512(newBundle),
				'devtools.98.bundle': sha512('devtools'),
			},
		}),
	);

	return dir;
}

function served(files: Record<string, string>) {
	return async (url: string) => {
		const body = files[url];

		return body === undefined ? new Response('missing', { status: 404 }) : new Response(body);
	};
}

describe('createPatches', () => {
	test('writes a patch the old bundle turns back into the new one, and lists its base', async () => {
		const dir = build();
		const fetcher = served({
			'https://cdn.test/beta/old/manifest.json': JSON.stringify({
				sha512: {
					'unbound.98.bundle': sha512(oldBundle),
					'devtools.98.bundle': sha512('old devtools'),
				},
			}),
			'https://cdn.test/beta/old/unbound.98.bundle': oldBundle,
		});

		expect(
			await createPatches({
				dir,
				baseUrl: 'https://cdn.test/beta/',
				revisions: ['old', 'gone'],
				fetcher,
			}),
		).toBe(1);

		const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));

		expect(manifest.patches).toEqual({ 'unbound.98.bundle': [sha512(oldBundle)] });

		const patch = readFileSync(join(dir, patchPath('unbound.98.bundle', sha512(oldBundle))));
		const options: BrotliOptions & { dictionary: Buffer } = {
			dictionary: Buffer.from(oldBundle),
		};
		const restored = brotliDecompressSync(patch, options);

		expect(restored.toString()).toBe(newBundle);
		expect(patch.length).toBeLessThan(newBundle.length / 10);
	});

	test('skips a base bundle that does not match its manifest', async () => {
		const dir = build();
		const fetcher = served({
			'https://cdn.test/beta/old/manifest.json': JSON.stringify({
				sha512: { 'unbound.98.bundle': sha512(oldBundle) },
			}),
			'https://cdn.test/beta/old/unbound.98.bundle': 'tampered',
		});

		expect(
			await createPatches({
				dir,
				baseUrl: 'https://cdn.test/beta',
				revisions: ['old'],
				fetcher,
			}),
		).toBe(0);
		expect(
			JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')).patches,
		).toBeUndefined();
		expect(existsSync(join(dir, 'patches'))).toBe(false);
	});
});
