import { describe, expect, test } from 'bun:test';
import { transformSync } from '@babel/core';

import { lazyImports, type LazyMode } from './lazy-modules';

function lazify(code: string, mode: LazyMode = 'proxy') {
	const targets = new Map([['./a', '/src/a.ts']]);

	return transformSync(code, {
		configFile: false,
		babelrc: false,
		sourceType: 'module',
		plugins: [lazyImports(targets, mode)],
	})!.code!;
}

describe('lazyImports', () => {
	test('reads named, default and namespace imports through one handle', () => {
		const out = lazify(
			"import a, { b as c, d } from './a';\nimport * as ns from './a';\nexport function f() { return [a, c, d, ns]; }",
		);

		expect(out).toContain('import _lazy_a_ts from "\\0lazy:proxy|/src/a.ts"');
		expect(out).toContain(
			'return [_lazy_a_ts["default"], _lazy_a_ts.b, _lazy_a_ts.d, _lazy_a_ts2]',
		);
		expect(out).not.toContain("from './a'");
	});

	test('calls an export without the module as this', () => {
		expect(lazify("import { b } from './a';\nb(1);\nb`x`;")).toContain(
			'(0, _lazy_a_ts.b)(1);\n(0, _lazy_a_ts.b)`x`;',
		);
	});

	test('expands a shorthand property', () => {
		expect(lazify("import { b } from './a';\nconst o = { b };")).toContain(
			'const o = {\n  b: _lazy_a_ts.b\n};',
		);
	});

	test('leaves shadowed names alone', () => {
		expect(lazify("import { b } from './a';\nfunction g(b) { return b; }\nb;")).toContain(
			'function g(b) {\n  return b;\n}\n_lazy_a_ts.b;',
		);
	});

	test('keeps side-effect imports, re-exported bindings and other modules eager', () => {
		const code =
			"import './a';\nimport { b } from './a';\nexport { b };\nimport { c } from './other';\nc;";

		expect(lazify(code)).toBe(code);
	});

	test('calls the getter in getter mode', () => {
		expect(lazify("import { b } from './a';\nb.c;", 'getter')).toContain('_lazy_a_ts().b.c;');
	});

	test('turns a namespace re-export into a lazy namespace', () => {
		expect(lazify("export * as api from './a';")).toBe(
			'import _lazy_a_ts from "\\0lazy:proxy|/src/a.ts";\nexport { _lazy_a_ts as api };',
		);
	});
});
