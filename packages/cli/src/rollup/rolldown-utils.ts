import type * as RolldownUtils from 'rolldown/utils';
import { createRequire } from 'node:module';

export type { ESTree, ParseResult } from 'rolldown/utils';

// Rollup runs plugins as Node ESM, where `require` is not defined.
const require = createRequire(import.meta.url);

let loaded: typeof RolldownUtils | undefined;

// `rolldown/utils` loads its native binding on import, so it loads on first use instead: the
// device commands never parse, and a compiled `ubd` without the binding still runs them.
function load(): typeof RolldownUtils {
	loaded ??= require('rolldown/utils') as typeof RolldownUtils;

	return loaded;
}

/**
 * @description Parses a module with rolldown's oxc parser, loading the parser on first use.
 * @param args The file name, source and parser options, as `rolldown/utils` takes them.
 * @returns The program, comments and errors.
 */
export function parseSync(
	...args: Parameters<typeof RolldownUtils.parseSync>
): ReturnType<typeof RolldownUtils.parseSync> {
	return load().parseSync(...args);
}

/**
 * @description Transforms a module with rolldown's oxc transformer, loading it on first use.
 * @param args The file name, source and transform options, as `rolldown/utils` takes them.
 * @returns The transformed code.
 */
export function transformSync(
	...args: Parameters<typeof RolldownUtils.transformSync>
): ReturnType<typeof RolldownUtils.transformSync> {
	return load().transformSync(...args);
}

/**
 * Rolldown's ESTree visitor, created when it first visits like {@link parseSync}. No private
 * fields: the CLI's bundled typings cannot declare them on an exported class.
 */
export class Visitor {
	readonly visitor: RolldownUtils.VisitorObject;

	constructor(visitor: RolldownUtils.VisitorObject) {
		this.visitor = visitor;
	}

	visit(program: RolldownUtils.ESTree.Program): void {
		new (load().Visitor)(this.visitor).visit(program);
	}
}
