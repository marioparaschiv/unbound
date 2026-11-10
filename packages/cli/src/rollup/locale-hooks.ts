import { parseSync, type ESTree } from 'rolldown/utils';
import { extname, relative, sep } from 'node:path';
import MagicString from 'magic-string';
import type { Plugin } from 'rollup';

import { collectNames, isFunction, walkScopes, type Reference } from './estree-scope.ts';
import { readBuildEnv } from './build-env.ts';
import { LOCALE_MODULE } from './locales.ts';

type AnyFunction = ESTree.Function | ESTree.ArrowFunctionExpression;

/** A component or hook that reads the plugin's strings, and the line it starts on. */
export type LocaleReader = { name: string; start: number };

/** What {@link injectLocaleHooks} did to one module. */
export type LocaleHookResult = {
	/** The source with `useMessages()` added, or `undefined` when nothing changed. */
	output: MagicString | undefined;
	injected: LocaleReader[];
	/** Class components that read strings; they cannot call hooks. */
	classReaders: LocaleReader[];
};

type Owner =
	| { kind: 'target'; node: AnyFunction; name: string }
	| { kind: 'helper'; name: string }
	| { kind: 'class'; name: string; start: number }
	| { kind: 'none' };

type LocaleImports = {
	declaration: ESTree.ImportDeclaration;
	strings: Set<string>;
	hook: string | undefined;
};

const LANGS: Record<string, 'js' | 'jsx' | 'ts' | 'tsx'> = {
	'.js': 'jsx',
	'.jsx': 'jsx',
	'.mjs': 'jsx',
	'.ts': 'ts',
	'.mts': 'ts',
	'.tsx': 'tsx',
};

const WRAPPERS = new Set(['memo', 'forwardRef']);
const STRING_EXPORTS = new Set(['messages', 'format']);
const HOOK_EXPORT = 'useMessages';

function isUpper(char: string | undefined): boolean {
	return char !== undefined && char >= 'A' && char <= 'Z';
}

// React's rules-of-hooks: a component is PascalCase; a hook is `use` alone or `use` then a capital or digit.
function isComponentOrHookName(name: string): boolean {
	const next = name[3];

	return (
		isUpper(name[0]) ||
		(name.startsWith('use') &&
			(next === undefined || isUpper(next) || (next >= '0' && next <= '9')))
	);
}

function wrapperName(callee: ESTree.Node): string | undefined {
	if (callee.type === 'Identifier') {
		return callee.name;
	}

	if (
		callee.type === 'MemberExpression' &&
		!callee.computed &&
		callee.property.type === 'Identifier'
	) {
		return callee.property.name;
	}

	return undefined;
}

function declaredName(ancestors: readonly ESTree.Node[], index: number): string | undefined {
	for (let i = index; i >= 0; i--) {
		const node = ancestors[i];

		if (node?.type === 'VariableDeclarator' && node.id.type === 'Identifier') {
			return node.id.name;
		}
	}

	return undefined;
}

/**
 * @description Names a function React treats as a component or hook: a PascalCase or `use*` function declaration or
 * const, or the function passed straight to `memo` or `forwardRef`.
 * @param fn The function.
 * @param ancestors The nodes above it, program first.
 * @returns Its name, or `undefined` when React's rules-of-hooks would not count it.
 */
export function componentOrHookName(
	fn: AnyFunction,
	ancestors: readonly ESTree.Node[],
): string | undefined {
	const parent = ancestors.at(-1);

	if (fn.type === 'FunctionDeclaration') {
		return fn.id && isComponentOrHookName(fn.id.name) ? fn.id.name : undefined;
	}

	if (
		parent?.type === 'VariableDeclarator' &&
		parent.init === fn &&
		parent.id.type === 'Identifier'
	) {
		return isComponentOrHookName(parent.id.name) ? parent.id.name : undefined;
	}

	if (parent?.type === 'CallExpression' && parent.arguments[0] === fn) {
		const wrapper = wrapperName(parent.callee);

		if (wrapper && WRAPPERS.has(wrapper)) {
			return `${wrapper}(${declaredName(ancestors, ancestors.length - 2) ?? 'anonymous'})`;
		}
	}

	return undefined;
}

// A same-file function a component may call: declared at the top of the module, directly or through an export.
function topLevelName(fn: AnyFunction, above: readonly ESTree.Node[]): string | undefined {
	const outer = above.filter(
		(node) =>
			node.type !== 'ExportNamedDeclaration' && node.type !== 'ExportDefaultDeclaration',
	);

	if (fn.type === 'FunctionDeclaration' && outer.length === 1 && fn.id) {
		return fn.id.name;
	}

	const [, declaration, declarator] = outer;

	if (
		outer.length === 3 &&
		declaration?.type === 'VariableDeclaration' &&
		declarator?.type === 'VariableDeclarator' &&
		declarator.init === fn &&
		declarator.id.type === 'Identifier'
	) {
		return declarator.id.name;
	}

	return undefined;
}

// The innermost component or hook around a read, else its class, else the top-level function holding it.
function ownerOf(ancestors: readonly ESTree.Node[]): Owner {
	let outermost: number | undefined;

	for (let index = ancestors.length - 1; index >= 0; index--) {
		const node = ancestors[index];

		if (!node || !isFunction(node)) {
			continue;
		}

		const name = componentOrHookName(node, ancestors.slice(0, index));

		if (name) {
			return { kind: 'target', node, name };
		}

		outermost = index;
	}

	const classNode = ancestors.findLast(
		(node) => node.type === 'ClassDeclaration' || node.type === 'ClassExpression',
	);

	if (classNode?.type === 'ClassDeclaration' || classNode?.type === 'ClassExpression') {
		return {
			kind: 'class',
			name: classNode.id?.name ?? 'anonymous class',
			start: classNode.start,
		};
	}

	const fn = outermost === undefined ? undefined : ancestors[outermost];

	if (fn && outermost !== undefined && isFunction(fn)) {
		const name = topLevelName(fn, ancestors.slice(0, outermost));

		if (name) {
			return { kind: 'helper', name };
		}
	}

	return { kind: 'none' };
}

function importedName(specifier: ESTree.ImportSpecifier): string {
	return specifier.imported.type === 'Identifier'
		? specifier.imported.name
		: specifier.imported.value;
}

function findLocaleImports(program: ESTree.Program): LocaleImports | undefined {
	let found: LocaleImports | undefined;

	for (const statement of program.body) {
		if (statement.type !== 'ImportDeclaration' || statement.importKind === 'type') {
			continue;
		}

		if (statement.source.value !== LOCALE_MODULE) {
			continue;
		}

		found ??= { declaration: statement, strings: new Set(), hook: void 0 };

		for (const specifier of statement.specifiers) {
			if (specifier.type !== 'ImportSpecifier' || specifier.importKind === 'type') {
				continue;
			}

			const imported = importedName(specifier);

			if (STRING_EXPORTS.has(imported)) {
				found.strings.add(specifier.local.name);
			}

			if (imported === HOOK_EXPORT) {
				found.hook = specifier.local.name;
			}
		}
	}

	return found;
}

function innermostFunction(ancestors: readonly ESTree.Node[]): ESTree.Node | undefined {
	return ancestors.findLast((node) => isFunction(node));
}

function isCallee(reference: Reference): boolean {
	const parent = reference.ancestors.at(-1);

	return parent?.type === 'CallExpression' && parent.callee === reference.identifier;
}

function freeHookName(program: ESTree.Program): string {
	const taken = collectNames(program);

	for (let index = 1; ; index++) {
		const name = index === 1 ? HOOK_EXPORT : `${HOOK_EXPORT}${index}`;

		if (!taken.has(name)) {
			return name;
		}
	}
}

function insertCall(output: MagicString, fn: AnyFunction, hook: string): void {
	const call = `${hook}();`;
	const { body } = fn;

	if (!body) return;

	if (body.type !== 'BlockStatement') {
		output.appendLeft(body.start, `{ ${call} return `);
		output.appendRight(body.end, '; }');

		return;
	}

	// After any directive prologue, which must stay first to remain a directive.
	const directives = body.body.filter(
		(statement) =>
			statement.type === 'ExpressionStatement' && typeof statement.directive === 'string',
	);
	const last = directives.at(-1);

	output.appendLeft(last ? last.end : body.start + 1, call);
}

/**
 * @description Adds `useMessages()` at the top of each component and hook that reads `messages` or `format` from
 * {@link LOCALE_MODULE}, directly, in a nested callback or through a same-file helper, unless it already calls it.
 * @param code The module's source.
 * @param program The module's program, as `rolldown/utils` parses it.
 * @returns The edited source, the components and hooks that got the call, and the class components that read strings.
 */
export function injectLocaleHooks(code: string, program: ESTree.Program): LocaleHookResult {
	const imports = findLocaleImports(program);
	const classReaders: LocaleReader[] = [];

	if (!imports?.strings.size) {
		return { output: void 0, injected: [], classReaders };
	}

	const owners = new Map<string, Owner[]>();
	const callingHook = new Set<ESTree.Node>();

	walkScopes(program, {
		reference(reference) {
			if (reference.scope?.kind !== 'program') return;

			const { name } = reference.identifier;

			if (name === imports.hook && isCallee(reference)) {
				const fn = innermostFunction(reference.ancestors);

				if (fn) {
					callingHook.add(fn);
				}
			}

			owners.set(name, [...(owners.get(name) ?? []), ownerOf(reference.ancestors)]);
		},
	});

	const targets = new Map<AnyFunction, string>();
	const pending = [...imports.strings];
	const seen = new Set(pending);

	// Follows same-file helpers transitively: a component that calls one that reads strings reads them too.
	for (let name = pending.pop(); name !== undefined; name = pending.pop()) {
		for (const owner of owners.get(name) ?? []) {
			if (owner.kind === 'target') {
				targets.set(owner.node, owner.name);
			} else if (owner.kind === 'helper' && !seen.has(owner.name)) {
				seen.add(owner.name);
				pending.push(owner.name);
			} else if (
				owner.kind === 'class' &&
				!classReaders.some((known) => known.start === owner.start)
			) {
				classReaders.push({ name: owner.name, start: owner.start });
			}
		}
	}

	const injected = [...targets].filter(([fn]) => !callingHook.has(fn));

	if (!injected.length) {
		return { output: void 0, injected: [], classReaders };
	}

	const output = new MagicString(code);
	let hook = imports.hook;

	if (!hook) {
		hook = freeHookName(program);

		const last = imports.declaration.specifiers.findLast(
			(specifier) => specifier.type === 'ImportSpecifier',
		);

		if (!last) {
			return { output: void 0, injected: [], classReaders };
		}

		output.appendLeft(
			last.end,
			hook === HOOK_EXPORT ? `, ${HOOK_EXPORT}` : `, ${HOOK_EXPORT} as ${hook}`,
		);
	}

	for (const [fn] of injected) insertCall(output, fn, hook);

	return {
		output,
		injected: injected.map(([fn, name]) => ({ name, start: fn.start })),
		classReaders,
	};
}

function isPluginSource(id: string, pluginRoot: string): boolean {
	const path = relative(pluginRoot, id);

	return (
		!id.startsWith('\0') &&
		extname(id) in LANGS &&
		!path.startsWith('..') &&
		!path.split(sep).includes('node_modules')
	);
}

function lineOf(code: string, offset: number): number {
	let line = 1;

	for (let index = 0; index < offset; index++)
		if (code.charCodeAt(index) === 10) {
			line++;
		}

	return line;
}

/**
 * @description Adds `useMessages()` to every plugin component and hook that reads its strings, so each re-renders on
 * a locale change. Runs before swc, so React Refresh signatures include the added hook. Warns on class components
 * that read strings, and logs each addition when `UNBOUND_VERBOSE=1`.
 * @param pluginRoot The plugin's directory; only its own sources are transformed.
 * @returns The rollup plugin.
 */
export function localeHooks(pluginRoot: string): Plugin {
	const { verbose } = readBuildEnv();

	return {
		name: 'unbound-locale-hooks',
		transform(code, id) {
			if (!isPluginSource(id, pluginRoot)) return null;

			const parsed = parseSync(id, code, { lang: LANGS[extname(id)], sourceType: 'module' });

			// swc reports syntax errors with better context than this pass could.
			if (parsed.errors.length) return null;

			const { output, injected, classReaders } = injectLocaleHooks(code, parsed.program);
			const file = relative(pluginRoot, id);

			for (const reader of classReaders) {
				this.warn(
					`${file}:${lineOf(code, reader.start)} ${reader.name} reads messages or format from ${LOCALE_MODULE}, but a class component cannot call useMessages(), so it will not re-render on a locale change.`,
				);
			}

			if (!output) return null;

			if (verbose) {
				for (const { name, start } of injected) {
					this.info(`${file}:${lineOf(code, start)} ${name} ← useMessages()`);
				}
			}

			return {
				code: output.toString(),
				map: output.generateMap({ hires: true, source: id, includeContent: true }),
			};
		},
	};
}

export default { componentOrHookName, injectLocaleHooks, localeHooks };
