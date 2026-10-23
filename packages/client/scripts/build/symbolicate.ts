import { TraceMap, originalPositionFor } from '@jridgewell/trace-mapping';
import { basename, join, relative, resolve } from 'node:path';
import { readFileSync } from 'node:fs';

// Hermes prints a release frame as `address at <bundle>:<line>:<bytecode offset>`; the offset is the bundle map's column.
const FRAME = /address at ([^\s()]+):(\d+):(\d+)/g;

/**
 * @description Rewrites each Hermes bytecode frame in a stack trace to the `src/` position it was compiled from.
 * Chains `<bundle>.map` (bytecode to `unbound.js`) with `unbound.js.map` (`unbound.js` to `src/`).
 * @param trace The stack trace, as Hermes printed it.
 * @param dir The build output holding the bundles' maps, e.g. `packages/client/dist`.
 * @returns The trace with every resolvable frame rewritten; unresolvable frames are left as printed.
 */
export function symbolicate(trace: string, dir: string): string {
	const maps = new Map<string, TraceMap>();

	function load(file: string): TraceMap {
		let map = maps.get(file);

		if (!map) {
			map = new TraceMap(readFileSync(join(dir, file), 'utf8'));
			maps.set(file, map);
		}

		return map;
	}

	return trace.replace(FRAME, (frame, bundle: string, line: string, column: string) => {
		const chunk = originalPositionFor(load(`${basename(bundle)}.map`), {
			line: Number(line),
			column: Number(column),
		});

		if (!chunk.source) return frame;

		const original = originalPositionFor(load(`${chunk.source}.map`), chunk);

		if (!original.source) return frame;

		const source = relative(process.cwd(), resolve(dir, original.source));

		return `${source}:${original.line}:${original.column + 1}`;
	});
}

if (import.meta.main) {
	process.stdout.write(symbolicate(await Bun.stdin.text(), process.argv[2] ?? 'dist'));
}
