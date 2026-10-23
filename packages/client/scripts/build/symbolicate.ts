import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping';
import { basename, dirname, join, relative } from 'node:path';
import { readFileSync } from 'node:fs';

// Hermes prints a release frame as `address at <source URL>:<line>:<bytecode offset>`; the offset is the bundle map's column.
const FRAME = /address at ([^\s()]+):(\d+):(\d+)/g;

// The loader evaluates the bundle with the source URL `unbound`; the Hermes CLI uses the file name instead.
const SOURCE_URL = 'unbound';

// `unbound.js.map` lists its sources relative to the dist directory it was built into.
const CLIENT_ROOT = join(import.meta.dir, '..', '..');
const CLIENT_DIST = join(CLIENT_ROOT, 'dist');

/**
 * @description Rewrites each frame of one bytecode bundle in a Hermes stack trace to the source position it was compiled from.
 * @param trace The stack trace, as Hermes printed it.
 * @param bundle The bundle that threw, e.g. `dist/unbound.98.bundle`, with its `.map` and `unbound.js.map` beside it.
 * @returns The trace with that bundle's frames rewritten to paths relative to `packages/client`; other frames are left as printed.
 */
export function symbolicate(trace: string, bundle: string): string {
	const bytecode = new TraceMap(readFileSync(`${bundle}.map`, 'utf8'));
	const chunks = new Map<string, TraceMap>();

	function chunkMap(file: string): TraceMap {
		let map = chunks.get(file);

		if (!map) {
			map = new TraceMap(readFileSync(join(dirname(bundle), `${file}.map`), 'utf8'));
			chunks.set(file, map);
		}

		return map;
	}

	return trace.replace(FRAME, (frame, url: string, line: string, column: string) => {
		if (url !== SOURCE_URL && basename(url) !== basename(bundle)) {
			return frame;
		}

		const chunk = originalPositionFor(bytecode, { line: Number(line), column: Number(column) });

		if (!chunk.source) {
			return frame;
		}

		const original = originalPositionFor(chunkMap(chunk.source), chunk);

		if (!original.source) {
			return frame;
		}

		const source = relative(CLIENT_ROOT, join(CLIENT_DIST, original.source));

		return `${source}:${original.line}:${original.column + 1}`;
	});
}

if (import.meta.main) {
	const bundle = process.argv[2];

	if (!bundle) {
		throw new Error(
			'Usage: bun run symbolicate <path to unbound.<version>.bundle> < trace.txt',
		);
	}

	process.stdout.write(symbolicate(await Bun.stdin.text(), bundle));
}
