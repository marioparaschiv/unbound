import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

import { MANIFEST_FILE, SIGNATURE_SUFFIX } from './sign';

// The manifest records the hash, patches are made from it, and source maps never ship.
const SKIPPED_DIRECTORIES = ['patches'];
const SKIPPED_SUFFIXES = ['.map', SIGNATURE_SUFFIX];
// Bytecode embeds its source's hash, so every revision changes it. The JavaScript it was compiled from covers it;
// CI publishes compiler changes itself.
const BYTECODE = /\.\d+\.bundle$/;

function shippedFiles(dir: string, prefix = ''): string[] {
	const files: string[] = [];

	for (const entry of readdirSync(join(dir, prefix), { withFileTypes: true })) {
		const path = prefix ? `${prefix}/${entry.name}` : entry.name;

		if (entry.isDirectory()) {
			if (!SKIPPED_DIRECTORIES.includes(path)) {
				files.push(...shippedFiles(dir, path));
			}
		} else if (
			path !== MANIFEST_FILE &&
			!BYTECODE.test(path) &&
			!SKIPPED_SUFFIXES.some((suffix) => path.endsWith(suffix))
		) {
			files.push(path);
		}
	}

	return files.sort();
}

function replaceAll(bytes: Buffer, from: Buffer, to: Buffer): Buffer {
	const parts: Buffer[] = [];
	let start = 0;

	for (let index = bytes.indexOf(from); index !== -1; index = bytes.indexOf(from, start)) {
		parts.push(bytes.subarray(start, index), to);
		start = index + from.length;
	}

	return start === 0 ? bytes : Buffer.concat([...parts, bytes.subarray(start)]);
}

/**
 * @description Hashes every file a build ships, bytecode through its JavaScript, with its per-build stamps put back
 * to their placeholders, so two builds of the same code hash alike despite their own revision and version.
 * @param dir The build directory.
 * @param stamps Each placeholder and the value the build stamped in its place.
 * @returns The SHA-256, in hex.
 */
export function contentHash(dir: string, stamps: Record<string, string>): string {
	const hash = createHash('sha256');
	const replacements = Object.entries(stamps)
		.filter(([, value]) => value !== '')
		.map(([placeholder, value]) => [Buffer.from(value), Buffer.from(placeholder)] as const);

	for (const file of shippedFiles(dir)) {
		let bytes: Buffer = readFileSync(join(dir, file));

		for (const [value, placeholder] of replacements)
			bytes = replaceAll(bytes, value, placeholder);

		hash.update(`${file}\0${bytes.length}\0`).update(bytes);
	}

	return hash.digest('hex');
}

export default contentHash;
