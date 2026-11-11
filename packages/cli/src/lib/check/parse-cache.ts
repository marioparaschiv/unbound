import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { extname } from 'node:path';

import { parseSync, type ParseResult } from '~/rollup/rolldown-utils';
import type { Site } from '~/lib/capabilities/file-facts';

/** oxc parse results by file extension and content hash. */
export type ParseCache = Map<string, ParseResult>;

/** A file parsed once per content: its text, the oxc result, and offset-to-position lookup. */
export type ParsedFile = {
	source: string;
	result: ParseResult;
	/** Turns an offset into a 1-based line and column in `file`. */
	locate: (offset: number) => Pick<Site, 'line' | 'column'>;
};

/**
 * @description Reads and parses a JavaScript or TypeScript file with oxc, reusing the last parse of
 * the same content, so a `--watch` re-run parses only the files that changed.
 * @param cache The cache to read and fill.
 * @param path The file's absolute path; its extension picks the language.
 * @returns The parsed file.
 */
export function parseFile(cache: ParseCache, path: string): ParsedFile {
	const source = readFileSync(path, 'utf8');
	const key = `${extname(path)}\0${createHash('sha1').update(source).digest('hex')}`;
	let result = cache.get(key);

	if (!result) {
		result = parseSync(path, source);
		cache.set(key, result);
	}

	return { source, result, locate: (offset) => locate(source, offset) };
}

/**
 * @description Turns an offset in a text into its 1-based line and column.
 * @param source The text.
 * @param offset The offset, in UTF-16 code units.
 * @returns The line and column.
 */
export function locate(source: string, offset: number): Pick<Site, 'line' | 'column'> {
	let line = 1;
	let start = 0;

	for (let index = source.indexOf('\n'); index !== -1 && index < offset;) {
		line++;
		start = index + 1;
		index = source.indexOf('\n', start);
	}

	return { line, column: offset - start + 1 };
}

export default { parseFile, locate };
