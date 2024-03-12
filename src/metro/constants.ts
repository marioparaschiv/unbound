export const data = {
	cache: [],
	patchedMoment: false,
	patchedThemes: false,
	patchedNativeRequire: false,
	listeners: new Set<(mdl: any) => void>()
};

export function isInvalidExport(mdl: any) {
	return (
		!mdl ||
		mdl === window ||
		mdl[Symbol()] === null ||
		typeof mdl === 'boolean' ||
		typeof mdl === 'number' ||
		typeof mdl === 'string'
	);
}

export function parseOptions<O, A extends any[] = string[]>(
	args: [...A, any] | A,
	filter = (last) => typeof last === 'object' && !Array.isArray(last),
	fallback = {}
): [A, O] {
	return [args as A, filter(args[args.length - 1]) ? args.pop() : fallback];
}

export function deenumerate(id: string | number) {
	Object.defineProperty(modules, id, {
		value: modules[id],
		enumerable: false,
		configurable: true,
		writable: true
	});
}