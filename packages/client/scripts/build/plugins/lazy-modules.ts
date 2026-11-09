import { transformAsync, types as t, type NodePath, type PluginObj } from '@babel/core';
import { basename, join, sep } from 'node:path';
import { parseAst } from 'rolldown/parseAst';
import type { Plugin } from 'rolldown';

/** How an imported binding reaches its module: through a proxy object, or a memoised getter call. */
export type LazyMode = 'proxy' | 'getter';

const PREFIX = '\0lazy:';
const SOURCE = /\/src\/.*\.[jt]sx?$/;
// Developer-only modules leave the default bundle by dead-code elimination, which a lazy `require` would defeat.
const NEVER_LAZY = /\.dev\.tsx?$|\.test\.tsx?$/;

/**
 * @description Reads the lazy-module mode from `UNBOUND_LAZY_MODULES`; unset or `0` keeps every import eager.
 * @returns The mode, or `undefined` for eager imports.
 */
export function lazyMode(): LazyMode | undefined {
	const value = process.env.UNBOUND_LAZY_MODULES;

	if (value === 'proxy' || value === '1') {
		return 'proxy';
	}

	if (value === 'getter') {
		return 'getter';
	}
}

/**
 * @description Defers every client module until an importer first reads one of its bindings. Each named,
 * default or namespace import of a client module becomes one handle to that module, and every reference reads
 * through it; `export * as name from` becomes a lazy namespace. Side-effect imports and re-exports stay eager.
 * @param root The client package root.
 * @param mode How references reach the module.
 * @returns A rolldown plugin that must run after TypeScript and JSX are compiled away.
 */
export default function lazyModules(root: string, mode: LazyMode): Plugin {
	const src = join(root, 'src') + sep;
	const registry = join(src, 'metro', 'lazy-registry.ts');

	function isLazyTarget(path: string | undefined): path is string {
		return Boolean(
			path?.startsWith(src) &&
			SOURCE.test(path) &&
			!NEVER_LAZY.test(path) &&
			path !== registry,
		);
	}

	return {
		name: 'lazy-modules',
		resolveId(id) {
			return id.startsWith(PREFIX) ? id : null;
		},
		load(id) {
			if (!id.startsWith(PREFIX)) return null;

			const [kind, target] = id.slice(PREFIX.length).split('|') as [string, string];
			const load = `() => require(${JSON.stringify(target)})`;

			if (kind === 'getter') {
				return `let mdl;\nexport default function lazy() { return mdl ??= (${load})(); }\n`;
			}

			return `import { createLazyModule } from ${JSON.stringify(registry)};\nexport default /* @__PURE__ */ createLazyModule(${load});\n`;
		},
		transform: {
			filter: { id: { include: SOURCE, exclude: /node_modules/ } },
			async handler(code, id) {
				if (id === registry || !id.startsWith(src)) return null;

				const program = parseAst(code, { lang: 'js' }, id);
				const targets = new Map<string, string>();

				for (const node of program.body) {
					const source =
						node.type === 'ImportDeclaration' ||
						(node.type === 'ExportNamedDeclaration' && node.source)
							? node.source?.value
							: node.type === 'ExportAllDeclaration' && node.exported
								? node.source.value
								: void 0;

					if (typeof source !== 'string' || targets.has(source)) {
						continue;
					}

					const resolved = await this.resolve(source, id);

					if (resolved && !resolved.external && isLazyTarget(resolved.id)) {
						targets.set(source, resolved.id);
					}
				}

				if (!targets.size) return null;

				const result = await transformAsync(code, {
					filename: id,
					configFile: false,
					babelrc: false,
					sourceType: 'module',
					sourceMaps: true,
					plugins: [lazyImports(targets, mode)],
				});

				return result?.code ? { code: result.code, map: result.map } : null;
			},
		},
	};
}

/**
 * @description The Babel pass behind {@link lazyModules}: rewrites imports of `targets` into lazy handles.
 * @param targets Each import specifier to defer, mapped to the module it resolves to.
 * @param mode How references reach the module.
 * @returns The Babel plugin.
 */
export function lazyImports(targets: Map<string, string>, mode: LazyMode): PluginObj {
	return {
		name: 'lazy-imports',
		visitor: {
			Program(program) {
				for (const statement of program.get('body')) {
					if (statement.isImportDeclaration()) {
						deferImport(statement, targets, mode);
					} else if (
						statement.isExportAllDeclaration() ||
						statement.isExportNamedDeclaration()
					) {
						deferNamespaceExport(statement, targets);
					}
				}
			},
		},
	};
}

function handleFor(statement: NodePath, target: string, kind: LazyMode) {
	const handle = statement.scope.generateUidIdentifier(
		`lazy_${basename(target).replace(/\W/g, '_')}`,
	);
	const declaration = t.importDeclaration(
		[t.importDefaultSpecifier(handle)],
		t.stringLiteral(`${PREFIX}${kind}|${target}`),
	);

	return { handle, declaration };
}

function deferImport(
	statement: NodePath<t.ImportDeclaration>,
	targets: Map<string, string>,
	mode: LazyMode,
) {
	const { node } = statement;
	const target = targets.get(node.source.value);

	// A side-effect import runs its module for the effect, so it stays eager.
	if (!target || node.importKind === 'type' || node.specifiers.length === 0) return;

	const bindings = node.specifiers.map((specifier) => ({
		specifier,
		binding: statement.scope.getBinding(specifier.local.name),
	}));

	// `export { name }` of an imported binding re-exports the live binding, which a handle cannot stand in for.
	const reexported = bindings.some(({ binding }) =>
		binding?.referencePaths.some((path) => path.parentPath?.isExportSpecifier()),
	);

	if (reexported) return;

	const { handle, declaration } = handleFor(statement, target, mode);

	for (const { specifier, binding } of bindings) {
		for (const reference of binding?.referencePaths ?? []) {
			replaceReference(reference, read(handle, specifier, mode));
		}
	}

	statement.replaceWith(declaration);
}

// `export * as name from './module'` becomes a lazy namespace; the other re-exports stay eager.
function deferNamespaceExport(
	statement: NodePath<t.ExportAllDeclaration | t.ExportNamedDeclaration>,
	targets: Map<string, string>,
) {
	const { node } = statement;
	const [specifier, ...rest] = 'specifiers' in node ? node.specifiers : [];
	const target = node.source ? targets.get(node.source.value) : void 0;

	if (!target || rest.length || !t.isExportNamespaceSpecifier(specifier)) return;

	const { handle, declaration } = handleFor(statement, target, 'proxy');

	statement.replaceWithMultiple([
		declaration,
		t.exportNamedDeclaration(null, [t.exportSpecifier(handle, specifier.exported)]),
	]);
}

function read(
	handle: t.Identifier,
	specifier: t.ImportDeclaration['specifiers'][number],
	mode: LazyMode,
): t.Expression {
	const mdl = mode === 'getter' ? t.callExpression(t.cloneNode(handle), []) : t.cloneNode(handle);

	if (t.isImportNamespaceSpecifier(specifier)) {
		return mdl;
	}

	const name = t.isImportDefaultSpecifier(specifier)
		? 'default'
		: t.isIdentifier(specifier.imported)
			? specifier.imported.name
			: specifier.imported.value;

	return t.isValidIdentifier(name)
		? t.memberExpression(mdl, t.identifier(name))
		: t.memberExpression(mdl, t.stringLiteral(name), true);
}

function replaceReference(reference: NodePath, value: t.Expression) {
	const parent = reference.parentPath;

	// `name()` must not call the export with the module as `this`.
	if (
		(parent?.isCallExpression() && parent.node.callee === reference.node) ||
		(parent?.isTaggedTemplateExpression() && parent.node.tag === reference.node)
	) {
		reference.replaceWith(t.sequenceExpression([t.numericLiteral(0), value]));

		return;
	}

	if (
		parent?.isObjectProperty() &&
		parent.node.shorthand &&
		parent.node.value === reference.node
	) {
		parent.node.shorthand = false;
	}

	reference.replaceWith(value);
}
