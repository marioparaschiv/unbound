// A metro module factory is `function(global, require, importDefault, importAll, module, exports, dependencyMap)`,
// which the decompiler prints as `a0` to `a6`.

/** How many parameters a module factory takes. */
export const FACTORY_ARITY = 7;
export const REQUIRE = 1;
export const IMPORT_DEFAULT = 2;
export const IMPORT_ALL = 3;
export const MODULE = 4;
export const EXPORTS = 5;
export const DEPENDENCY_MAP = 6;

/**
 * @description Names a factory parameter the way the decompiled bundle prints it.
 * @param index The parameter's position.
 * @returns The decompiler's name for it, `a<index>`.
 */
export function paramName(index: number): string {
	return `a${index}`;
}

export default {
	FACTORY_ARITY,
	REQUIRE,
	IMPORT_DEFAULT,
	IMPORT_ALL,
	MODULE,
	EXPORTS,
	DEPENDENCY_MAP,
	paramName,
};
