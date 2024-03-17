import Themes from '@managers/themes';

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

export function initializeModule(id) {
	try {
		const orig = Function.prototype.toString;
		Object.defineProperty(Function.prototype, 'toString', {
			value: orig,
			configurable: true,
			writable: false
		});

		__r(id);

		Object.defineProperty(Function.prototype, 'toString', {
			value: orig,
			configurable: true,
			writable: true
		});

		return true;
	} catch {
		deenumerate(id);
		return false;
	}
}

export function handleFixes(mdl) {
	if (!data.patchedNativeRequire && mdl.default?.name === 'requireNativeComponent') {
		const orig = mdl.default;

		mdl.default = function requireNativeComponent(...args) {
			try {
				return orig(...args);
			} catch {
				return args[0];
			}
		};

		data.patchedNativeRequire = true;
	}

	if (!data.patchedMoment && mdl.defineLocale) {
		const defineLocale = mdl.defineLocale;

		mdl.defineLocale = function (...args) {
			try {
				const locale = mdl.locale();
				defineLocale.apply(this, args);
				mdl.locale(locale);
			} catch (e) {
				console.error('Failed to define moment locale:', e.message);
			}
		};

		data.patchedMoment = true;
	}

	if (!data.patchedThemes && mdl.SemanticColor) {
		try {
			Themes.initialize(mdl);
		} catch (e) {
			console.error('Failed to patch themes:', e.message);
		}

		data.patchedThemes = true;
	}
}