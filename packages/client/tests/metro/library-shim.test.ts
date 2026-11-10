import { beforeEach, describe, expect, mock, test } from 'bun:test';

type Library = {
	format: () => string;
};

type SearchOptions = {
	esModules?: boolean;
};

const svg = { __esModule: true, default: 'Svg', Svg: 'Svg', Path: 'Path' };
const moment: (() => string) & Library = Object.assign(() => 'now', {
	format: () => 'YYYY',
	isMoment: () => true,
});
// Comes first in the registry, like Discord's wrappers whose default re-exports a library.
const wrapper = { __esModule: true, default: { Svg: 'wrapped', Path: 'wrapped' } };
const registry: MetroExport[] = [wrapper, svg, moment];
const searches: string[][] = [];

function matches(exports: MetroExport, props: string[]) {
	return props.every((prop) => exports?.[prop] !== void 0);
}

// Mirrors `findByProps`: a module also matches through its default export unless `esModules` is off.
mock.module('~/metro/finders', () => ({
	finder:
		() =>
		(...args: [...string[], SearchOptions]) => {
			const props = args.slice(0, -1) as string[];
			const { esModules = true } = args.at(-1) as SearchOptions;

			searches.push(props);

			return registry.find(
				(mdl) => matches(mdl, props) || (esModules && matches(mdl.default, props)),
			);
		},
}));

const { createLibraryShim } = await import('~/metro/library-shim');

// Mirrors rolldown's interop for a default or namespace import of a CommonJS module.
function toESM(mdl: MetroExport) {
	const target = Object.create(Object.getPrototypeOf(mdl));
	const esModule = mdl.__esModule && Object.prototype.hasOwnProperty.call(mdl, 'default');

	if (!esModule) {
		Object.defineProperty(target, 'default', { value: mdl, enumerable: true });
	}

	for (const key of Object.getOwnPropertyNames(mdl)) {
		Object.defineProperty(target, key, { get: () => mdl[key], enumerable: true });
	}

	return target;
}

beforeEach(() => {
	searches.length = 0;
});

describe('a library shim', () => {
	test('finds nothing when created or imported', () => {
		toESM(createLibraryShim(['Svg', 'Path']));

		expect(searches).toEqual([]);
	});

	test("reads an ES module's default and named exports once they are used", () => {
		const imported = toESM(createLibraryShim(['Svg', 'Path']));

		expect([imported.default, imported.Path]).toEqual(['Svg', 'Path']);
		expect(searches).toEqual([['Svg', 'Path']]);
	});

	test("finds the library by its own exports, not a wrapper's default that re-exports them", () => {
		expect(createLibraryShim(['Svg', 'Path']).Path).toBe('Path');
	});

	test('makes a CommonJS module its own default export', () => {
		const imported = toESM(createLibraryShim(['isMoment']));

		expect(imported.default()).toBe('now');
		expect(imported.format()).toBe('YYYY');
	});

	test('reads exports straight from the shim, as plugin imports do', () => {
		const shim = createLibraryShim(['Svg', 'Path']);

		expect([shim.default, shim.Path]).toEqual(['Svg', 'Path']);
	});
});
