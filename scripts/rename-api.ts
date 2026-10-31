import { relative, resolve } from 'node:path';
import { Node, Project, ts } from 'ts-morph';
import type { SourceFile } from 'ts-morph';
import { parseArgs } from 'node:util';
import { statSync } from 'node:fs';

import { API_RENAMES, type ApiRename } from './api-renames';

export type RenameResult = { text: string; applied: ApiRename[]; manual: string[] };

type Edit = { start: number; end: number; text: string; rename?: ApiRename };

type PassState = {
	byFrom: Map<string, ApiRename>;
	manual: Set<string>;
	rebound: Set<string>;
};

const root = resolve(import.meta.dir, '..');
const API = '@unbound-app/api';
const DEFAULT_PATHS = ['packages/plugins', 'packages/plugins-shared', 'packages/cli/templates'];
const MAX_PASSES = 10;

function join(prefix: string, name: string): string {
	return prefix ? `${prefix}.${name}` : name;
}

function parentOf(path: string): string {
	return path.slice(0, Math.max(0, path.lastIndexOf('.')));
}

function lastOf(path: string): string {
	return path.slice(path.lastIndexOf('.') + 1);
}

// Mirrors the rollup globals: `@unbound-app/api/metro/filters` is `window.unbound.metro.filters`.
function modulePath(specifier: string): string | undefined {
	if (specifier === API) {
		return '';
	}

	if (specifier.startsWith(`${API}/`)) {
		return specifier.slice(API.length + 1).replaceAll('/', '.');
	}

	return undefined;
}

function apiImports(source: ts.SourceFile): ts.ImportDeclaration[] {
	return source.statements.filter(
		(statement): statement is ts.ImportDeclaration =>
			ts.isImportDeclaration(statement) &&
			ts.isStringLiteral(statement.moduleSpecifier) &&
			modulePath(statement.moduleSpecifier.text) !== undefined,
	);
}

function visitExports(file: SourceFile, prefix: string, paths: Set<string>): void {
	for (const [name, declarations] of file.getExportedDeclarations()) {
		const path = join(prefix, name);

		paths.add(path);

		for (const declaration of declarations) {
			if (Node.isSourceFile(declaration)) {
				visitExports(declaration, path, paths);
			}
		}
	}
}

/**
 * @description Lists every dotted path the generated SDK exports, such as `metro.filters.byProps`.
 * @param entry The SDK's root declaration file.
 * @returns Each exported namespace and member as a dotted path from the API root.
 */
export function sdkPaths(
	entry: string = resolve(root, 'packages/api/src/index.d.ts'),
): Set<string> {
	const paths = new Set<string>();
	const project = new Project({ skipAddingFilesFromTsConfig: true });

	visitExports(project.addSourceFileAtPath(entry), '', paths);

	return paths;
}

function planEdits(source: ts.SourceFile, state: PassState): Edit[] {
	const bindings = new Map<string, string>();
	const pending = new Set<string>();
	const edits: Edit[] = [];
	let identifiers: Set<string> | undefined;

	for (const declaration of apiImports(source)) {
		const base = modulePath((declaration.moduleSpecifier as ts.StringLiteral).text) ?? '';
		const named = declaration.importClause?.namedBindings;

		if (!named) {
			continue;
		}

		if (ts.isNamespaceImport(named)) {
			bindings.set(named.name.text, base);

			continue;
		}

		for (const element of named.elements) {
			const local = element.name.text;
			const path = join(base, (element.propertyName ?? element.name).text);
			const rename = state.byFrom.get(path);

			bindings.set(local, path);

			if (!rename) {
				continue;
			}

			if (parentOf(rename.to) !== parentOf(path)) {
				state.manual.add(`import of ${path} (move it to ${rename.to})`);

				continue;
			}

			const name = lastOf(rename.to);

			edits.push({
				start: element.getStart(source),
				end: element.end,
				text: `${element.isTypeOnly ? 'type ' : ''}${name === local ? name : `${name} as ${local}`}`,
				rename,
			});
		}
	}

	function pathOf(node: ts.Expression): string | undefined {
		if (ts.isIdentifier(node)) {
			return bindings.get(node.text) ?? (node.text === 'unbound' ? '' : undefined);
		}

		if (!ts.isPropertyAccessExpression(node)) {
			return undefined;
		}

		if (
			ts.isIdentifier(node.expression) &&
			node.expression.text === 'window' &&
			node.name.text === 'unbound'
		) {
			return '';
		}

		const base = pathOf(node.expression);

		return base === undefined ? undefined : join(base, node.name.text);
	}

	function namesInFile(): Set<string> {
		if (identifiers) {
			return identifiers;
		}

		const found = new Set<string>();

		function collect(node: ts.Node): void {
			if (ts.isIdentifier(node)) {
				found.add(node.text);
			}

			ts.forEachChild(node, collect);
		}

		collect(source);
		identifiers = found;

		return found;
	}

	// The local name bound to a top-level namespace, adding `import { name } from '@unbound-app/api'` when none exists.
	function namespaceBinding(name: string): string | undefined {
		for (const [local, path] of bindings) {
			if (path === name) {
				return local;
			}
		}

		if (pending.has(name)) {
			return name;
		}

		if (namesInFile().has(name)) {
			return undefined;
		}

		const imports = apiImports(source);
		const target = imports.find(
			(declaration) =>
				(declaration.moduleSpecifier as ts.StringLiteral).text === API &&
				!declaration.importClause?.isTypeOnly &&
				declaration.importClause?.namedBindings &&
				ts.isNamedImports(declaration.importClause.namedBindings) &&
				declaration.importClause.namedBindings.elements.length,
		);
		const elements = target?.importClause?.namedBindings as ts.NamedImports | undefined;
		const lastElement = elements?.elements.at(-1);
		const anchor = source.statements.find(ts.isImportDeclaration)?.getStart(source) ?? 0;

		pending.add(name);
		edits.push(
			lastElement
				? { start: lastElement.end, end: lastElement.end, text: `, ${name}` }
				: { start: anchor, end: anchor, text: `import { ${name} } from '${API}';\n` },
		);

		return name;
	}

	function renameAccess(node: ts.PropertyAccessExpression, rename: ApiRename): Edit | undefined {
		if (parentOf(rename.to) === parentOf(rename.from)) {
			return {
				start: node.name.getStart(source),
				end: node.name.end,
				text: lastOf(rename.to),
				rename,
			};
		}

		let base: ts.Expression = node;

		while (ts.isPropertyAccessExpression(base) && pathOf(base.expression) !== undefined) {
			base = base.expression;
		}

		const [head, ...rest] = rename.to.split('.');
		let text = `${base.getText(source)}.${rename.to}`;

		if (pathOf(base) !== '') {
			const local = namespaceBinding(head);

			if (!local) {
				state.manual.add(`${rename.from} (the name ${head} is taken)`);

				return undefined;
			}

			if (ts.isIdentifier(base)) {
				state.rebound.add(base.text);
			}

			text = [local, ...rest].join('.');
		}

		return { start: node.getStart(source), end: node.end, text, rename };
	}

	function visit(node: ts.Node): void {
		if (ts.isPropertyAccessExpression(node)) {
			const path = pathOf(node);
			const rename = path === undefined ? undefined : state.byFrom.get(path);
			const edit = rename ? renameAccess(node, rename) : undefined;

			if (edit) {
				edits.push(edit);

				return;
			}
		}

		ts.forEachChild(node, visit);
	}

	visit(source);

	return edits;
}

function applyEdits(text: string, edits: Edit[]): [string, Edit[]] {
	const applied: Edit[] = [];
	let floor = text.length;

	for (const edit of edits.toSorted((a, b) => b.start - a.start)) {
		if (edit.end > floor) {
			continue;
		}

		text = text.slice(0, edit.start) + edit.text + text.slice(edit.end);
		floor = edit.start;
		applied.push(edit);
	}

	return [text, applied];
}

function isReference(node: ts.Identifier): boolean {
	const { parent } = node;

	return !(
		ts.isImportSpecifier(parent) ||
		(ts.isPropertyAccessExpression(parent) && parent.name === node) ||
		(ts.isPropertyAssignment(parent) && parent.name === node) ||
		(ts.isQualifiedName(parent) && parent.right === node)
	);
}

function countReferences(source: ts.SourceFile, name: string): number {
	let count = 0;

	function visit(node: ts.Node): void {
		if (ts.isIdentifier(node) && node.text === name && isReference(node)) {
			count++;
		}

		ts.forEachChild(node, visit);
	}

	visit(source);

	return count;
}

// Drops a namespace import the rewrite left unused, such as `metro` once `metro.findStore` became `flux.getStore`.
function removeUnused(text: string, fileName: string, name: string): string {
	const source = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true);

	if (countReferences(source, name)) {
		return text;
	}

	for (const declaration of apiImports(source)) {
		const named = declaration.importClause?.namedBindings;

		if (!named || !ts.isNamedImports(named)) {
			continue;
		}

		const elements = named.elements;
		const index = elements.findIndex((element) => element.name.text === name);

		if (index < 0) {
			continue;
		}

		if (elements.length === 1 && !declaration.importClause?.name) {
			const end = text[declaration.end] === '\n' ? declaration.end + 1 : declaration.end;

			return text.slice(0, declaration.getStart(source)) + text.slice(end);
		}

		const [start, end] =
			index < elements.length - 1
				? [elements[index].getStart(source), elements[index + 1].getStart(source)]
				: [elements[index - 1].end, elements[index].end];

		return text.slice(0, start) + text.slice(end);
	}

	return text;
}

/**
 * @description Rewrites old public API names to new ones wherever a file reaches them through a namespace.
 * @param text The file's source text.
 * @param fileName The file's name, which picks TS or TSX parsing.
 * @param renames The renames to apply.
 * @returns The rewritten text, each rename applied once per site, and the sites that need a manual edit.
 */
export function renameApi(
	text: string,
	fileName: string,
	renames: readonly ApiRename[],
): RenameResult {
	const state: PassState = {
		byFrom: new Map(renames.map((rename) => [rename.from, rename])),
		manual: new Set(),
		rebound: new Set(),
	};
	const applied: ApiRename[] = [];

	for (let pass = 0; pass < MAX_PASSES; pass++) {
		const source = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true);
		const edits = planEdits(source, state);

		if (!edits.length) {
			break;
		}

		const [next, done] = applyEdits(text, edits);

		text = next;

		for (const edit of done) {
			if (edit.rename) {
				applied.push(edit.rename);
			}
		}
	}

	for (const name of state.rebound) {
		text = removeUnused(text, fileName, name);
	}

	return { text, applied, manual: [...state.manual] };
}

function sourceFiles(paths: string[]): string[] {
	const files = new Set<string>();
	const glob = new Bun.Glob('**/*.{ts,tsx}');

	for (const path of paths) {
		if (statSync(path).isFile()) {
			files.add(path);

			continue;
		}

		for (const file of glob.scanSync({ cwd: path, absolute: true })) {
			if (!file.includes('/node_modules/') && !file.includes('/dist/')) {
				files.add(file);
			}
		}
	}

	return [...files].sort();
}

function tally(renames: ApiRename[]): string[] {
	const counts = new Map<string, number>();

	for (const { from, to } of renames) {
		const key = `${from} → ${to}`;

		counts.set(key, (counts.get(key) ?? 0) + 1);
	}

	return [...counts].map(([key, count]) => `${key} (${count})`);
}

async function main(): Promise<void> {
	const { values, positionals } = parseArgs({
		allowPositionals: true,
		options: { write: { type: 'boolean' }, check: { type: 'boolean' } },
	});
	const sdk = sdkPaths();
	const ready = API_RENAMES.filter((rename) => sdk.has(rename.to));
	const waiting = API_RENAMES.filter((rename) => !sdk.has(rename.to));
	const paths = positionals.length
		? positionals.map((path) => resolve(path))
		: DEFAULT_PATHS.map((path) => resolve(root, path));
	let changed = 0;
	let renamed = 0;
	let left = 0;

	for (const file of sourceFiles(paths)) {
		const text = await Bun.file(file).text();
		const result = renameApi(text, file, ready);
		const later = renameApi(result.text, file, waiting);
		const manual = [...result.manual, ...later.manual];
		const name = relative(process.cwd(), file);

		const lines = [
			...tally(result.applied),
			...tally(later.applied).map((line) => `waits for the SDK: ${line}`),
			...manual.map((line) => `needs a manual edit: ${line}`),
		];

		for (const line of lines) {
			console.log(`${name}: ${line}`);
		}

		renamed += result.applied.length;
		left += later.applied.length + manual.length;

		if (result.text === text) {
			continue;
		}

		changed++;

		if (values.write) {
			await Bun.write(file, result.text);
		}
	}

	console.log(
		`${renamed} renames in ${changed} files ${values.write ? 'written' : '(dry run, pass --write to apply)'}; ${left} old names wait for the SDK or a manual edit.`,
	);

	if (values.check && left + (values.write ? 0 : renamed) > 0) {
		process.exitCode = 1;
	}
}

if (import.meta.main) {
	await main();
}
