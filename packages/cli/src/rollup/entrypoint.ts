import type { OutputAsset, OutputBundle, OutputChunk, Plugin } from 'rollup';
import { decode, encode } from '@jridgewell/sourcemap-codec';

const LEADING = /^\s*(?:var\s+[A-Za-z_$][\w$]*\s*=\s*)?/;
const TRAILING = /;?\s*$/;
const PREFIX = '({__plugin:null,__load(){if(this.__plugin)return this.__plugin;this.__plugin=';
const SUFFIX = ';return this.__plugin;}})';

type Shift = { lines: number; column: number };

function removedShift(removed: string): Shift {
	const lines = removed.split('\n');

	return { lines: lines.length - 1, column: lines.at(-1)?.length ?? 0 };
}

/**
 * @description Moves a chunk's source map to match code that lost a removed prefix and gained an added one.
 * @param mappings The chunk's encoded mappings.
 * @param removed What was cut from the start of the code.
 * @param added What was put in front of the code.
 * @returns The moved mappings.
 */
export function shiftMappings(mappings: string, removed: string, added: string): string {
	const shift = removedShift(removed);
	const lines = decode(mappings).slice(shift.lines);
	const [first = []] = lines;

	lines[0] = first
		.filter(([column]) => column >= shift.column)
		.map(
			([column, ...rest]) =>
				[column - shift.column + added.length, ...rest] as (typeof first)[number],
		);

	return encode(lines);
}

function moveMap(bundle: OutputBundle, chunk: OutputChunk, removed: string) {
	if (!chunk.map) return;

	chunk.map.mappings = shiftMappings(chunk.map.mappings, removed, PREFIX);

	const asset = bundle[`${chunk.fileName}.map`] as OutputAsset | undefined;

	if (asset?.type === 'asset') {
		asset.source = chunk.map.toString();
	}
}

/**
 * @description Rewrites each chunk into the object expression the client evaluates: `__load()` runs the plugin's
 * module once and returns its named exports, which the client reads as `start`, `stop` and `SettingsPanel`. The
 * chunk's source map moves with it, so crash stacks still map to the plugin's sources.
 * @returns The rollup plugin.
 */
export function hermesExpressionEntrypoint(): Plugin {
	return {
		name: 'hermes-expression-entrypoint',
		generateBundle(_outputOptions, bundle) {
			for (const chunk of Object.values(bundle)) {
				if (chunk.type !== 'chunk') {
					continue;
				}

				const removed = LEADING.exec(chunk.code)?.[0] ?? '';
				const code = chunk.code.slice(removed.length).replace(TRAILING, '');

				moveMap(bundle, chunk, removed);
				chunk.code = `${PREFIX}${code}${SUFFIX}`;
			}
		},
	};
}

export default hermesExpressionEntrypoint;
