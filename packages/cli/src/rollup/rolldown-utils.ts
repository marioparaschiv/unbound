import type * as RolldownUtils from 'rolldown/utils';

export type { ESTree, ParseResult } from 'rolldown/utils';

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

/** Rolldown's ESTree visitor, created on first use like {@link parseSync}. */
export class Visitor {
	readonly #inner: RolldownUtils.Visitor;

	constructor(visitor: RolldownUtils.VisitorObject) {
		this.#inner = new (load().Visitor)(visitor);
	}

	visit(program: RolldownUtils.ESTree.Program): void {
		this.#inner.visit(program);
	}
}
