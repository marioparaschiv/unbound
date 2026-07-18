import { Project, Node, SyntaxKind } from 'ts-morph';

import { relativeSpecifier, type ModuleEntry } from './paths';

/**
 * @description Tests whether a JSDocable node carries an `@internal` tag in its leading documentation.
 * @param node The node to inspect.
 * @returns `true` when the node is tagged `@internal`.
 */
export function isInternal(node: Node): boolean {
	if (!Node.isJSDocable(node)) return false;

	return node
		.getJsDocs()
		.some((doc) => doc.getTags().some((tag) => tag.getTagName() === 'internal'));
}

/**
 * @description Recursively removes `@internal`-tagged declarations from a statement container,
 * descending into `declare global`/module bodies and pruning `@internal` interface members. An
 * `@internal` declaration is retained when a surviving (non-`@internal`) statement in the same
 * container still references its name - a public type may keep a bare backing declaration structurally
 * alive (e.g. `MetroFilter` referencing the internal `[CACHE_KEY]` symbol), and removing it would
 * leave a dangling reference. Keeping such a declaration is not a leak: it wears no `export` modifier.
 * @param container A source file or module body exposing `getStatements`.
 * @param internalNames Collects the names of removed top-level declarations so namespace re-export
 * lists referencing them can be pruned afterwards.
 * @param retainedInternalNames Collects the names of `@internal` declarations that were kept as
 * ambient backing declarations. They are retained for structural type resolution only, never to be
 * re-exported, so namespace re-export lists referencing them must still be pruned.
 */
export function stripInternal(
	container: Node,
	internalNames: Set<string>,
	retainedInternalNames: Set<string>,
) {
	if (!Node.isStatemented(container)) return;

	const candidates = new Map<Node, string[]>();
	const survivors: Node[] = [];

	for (const statement of container.getStatements()) {
		if (isInternal(statement)) {
			candidates.set(statement, declaredNames(statement));
			continue;
		}

		survivors.push(statement);

		if (Node.isModuleDeclaration(statement)) {
			const body = statement.getBody();
			if (body) stripInternal(body, internalNames, retainedInternalNames);
		}

		if (Node.isInterfaceDeclaration(statement)) {
			for (const member of statement.getMembers()) {
				if (isInternal(member)) member.remove();
			}
		}
	}

	const referenced = collectReferencedNames(survivors);

	for (const [statement, names] of candidates) {
		if (names.some((name) => referenced.has(name))) {
			// A retained backing declaration must not be part of the module's public surface: drop its
			// `export` so it stays an ambient `declare`, matching how the same symbol appears in the
			// bundles that never re-export it (e.g. `metro/filters.d.ts`, root `index.d.ts`).
			if (Node.isModifierable(statement)) statement.toggleModifier('export', false);

			for (const name of names) retainedInternalNames.add(name);

			continue;
		}

		for (const name of names) internalNames.add(name);

		statement.remove();
	}
}

/**
 * @description Collects every top-level declaration name that the given statements reference. Uses
 * the same reference classification as the root tree-shaker: aliased/import specifier names and a
 * declaration's own name node don't count, but a computed `[X]` property name is a real reference.
 * @param statements The surviving statements to scan for references.
 * @returns The set of referenced identifier texts.
 */
export function collectReferencedNames(statements: Node[]): Set<string> {
	const referenced = new Set<string>();

	for (const statement of statements) {
		for (const reference of statement.getDescendantsOfKind(SyntaxKind.Identifier)) {
			if (!isReference(reference)) continue;

			referenced.add(reference.getText());
		}
	}

	return referenced;
}

/**
 * @description Reports whether an identifier is the declared name of its parent (a parameter,
 * a property/method signature, a property/variable name, ...) rather than a reference to a
 * declaration. ts-morph exposes the declared name via `getNameNode`, so an identifier that is
 * exactly its parent's name node is a declaration name. A computed `[X]` property name is a real
 * reference to `X`, so it is excluded.
 * @param reference The identifier to classify.
 */
export function isDeclarationName(reference: Node): boolean {
	const parent = reference.getParent() as { getNameNode?: () => Node | undefined };
	if (typeof parent.getNameNode !== 'function') return false;
	if (parent.getNameNode() !== reference) return false;

	return !Node.isComputedPropertyName(reference.getParent());
}

/**
 * @description Reports whether an identifier is a genuine reference to a declaration rather than a
 * binding or specifier name. An aliased export specifier (`X as Y`) references only `X`; an import
 * specifier's names are re-bindings, not references; a declaration's own name node is not a
 * reference. A computed `[X]` property name stays a reference (handled by `isDeclarationName`).
 * @param reference The identifier to classify.
 */
export function isReference(reference: Node): boolean {
	const parent = reference.getParent();

	if (Node.isExportSpecifier(parent)) {
		if (parent.getAliasNode() === reference) return false;
	} else if (Node.isImportSpecifier(parent)) {
		return false;
	} else if (isDeclarationName(reference)) {
		return false;
	}

	return true;
}

/**
 * @description Lists the binding names a top-level declaration introduces.
 * @param statement The declaration to inspect.
 * @returns The declared identifier names (empty for anonymous statements).
 */
export function declaredNames(statement: Node): string[] {
	if (Node.isVariableStatement(statement)) {
		return statement.getDeclarations().map((declaration) => declaration.getName());
	}

	if (
		Node.isFunctionDeclaration(statement) ||
		Node.isClassDeclaration(statement) ||
		Node.isInterfaceDeclaration(statement) ||
		Node.isTypeAliasDeclaration(statement) ||
		Node.isEnumDeclaration(statement)
	) {
		const name = statement.getName();
		return name ? [name] : [];
	}

	return [];
}

/**
 * @description Collapses the flattened `declare namespace X { export { ... } }` blocks that
 * `dts-bundle-generator` emits for a folder module's nested `export * as X` re-exports back into
 * `export * as X from './X'` re-exports of the already-emitted child files. The block's backing
 * declarations - top-level `declare`s that exist only to feed the namespace - are removed once no
 * surviving statement references them. This is the per-folder analogue of the re-export root: metro's
 * `common`/`stores`/`api`/`filters` become imports of their own files instead of inlined copies.
 * @param sourceFile The parsed module bundle to rewrite.
 * @param outPath The module's absolute output path (a folder module's `index.d.ts`).
 * @param children The nested subpath entries whose parent is this module, keyed for namespace lookup.
 */
export function collapseNamespaces(
	sourceFile: Node,
	outPath: string,
	children: Map<string, ModuleEntry>,
) {
	if (!Node.isStatemented(sourceFile)) return;

	const collapsed = new Set<string>();
	const backingNames = new Set<string>();

	for (const statement of sourceFile.getStatements()) {
		if (!Node.isModuleDeclaration(statement)) continue;

		const child = children.get(statement.getName());
		if (!child) continue;

		const body = statement.getBody();
		if (body && Node.isStatemented(body)) {
			for (const inner of body.getStatements()) {
				if (!Node.isExportDeclaration(inner)) continue;

				for (const specifier of inner.getNamedExports()) {
					backingNames.add(specifier.getName());
				}
			}
		}

		collapsed.add(statement.getName());
		statement.remove();
	}

	if (collapsed.size === 0) return;

	// Drop the aggregate `export { api, common, ... }` specifiers for the collapsed namespaces, and any
	// now-orphaned backing declaration no surviving statement still references.
	const survivors = sourceFile
		.getStatements()
		.filter((statement) => !Node.isExportDeclaration(statement));

	const referenced = collectReferencedNames(survivors);

	for (const statement of sourceFile.getStatements()) {
		if (Node.isExportDeclaration(statement) && !statement.getModuleSpecifier()) {
			for (const specifier of statement.getNamedExports()) {
				if (collapsed.has(specifier.getName())) specifier.remove();
			}

			if (statement.getNamedExports().length === 0) statement.remove();

			continue;
		}

		const names = declaredNames(statement);
		if (names.length === 0) continue;
		if (names.some((name) => !backingNames.has(name) || referenced.has(name))) continue;

		statement.remove();
	}

	const lines = [...collapsed]
		.sort()
		.map((name) => {
			const specifier = relativeSpecifier(outPath, children.get(name)!.out);
			return `export * as ${name} from '${specifier}';`;
		})
		.join('\n');

	sourceFile.insertStatements(sourceFile.getStatements().length, lines);
}

/**
 * @description Removes every top-level declaration that `dts-bundle-generator` inlined from a hoisted
 * library (its name is owned by a hoist file per `ownerByName`) and replaces the ones still referenced
 * by surviving declarations with `import type { ... } from '<rel>'`, one import per owning hoist file.
 * Unused inlined declarations are dropped outright. This guarantees a library type such as `Falsy`
 * (from `@unbound-app/types`) or `IEventEmitter` (from `tseep`) is never declared or re-exported by a
 * module it does not own - it can only be imported where genuinely used. A file never imports from
 * itself.
 * @param sourceFile The parsed module bundle to rewrite.
 * @param outPath The module's absolute output path, used to resolve relative hoist-file specifiers.
 * @param ownerByName The map attributing each hoisted declaration name to its owning hoist file.
 * @param usedOwners Collects the hoist-file paths actually imported from, so orphan files aren't emitted.
 */
export function hoistLibraries(
	sourceFile: Node,
	outPath: string,
	ownerByName: Map<string, string>,
	usedOwners: Set<string>,
) {
	if (!Node.isStatemented(sourceFile)) return;

	const hoisted: Node[] = [];
	const survivors: Node[] = [];

	for (const statement of sourceFile.getStatements()) {
		const names = declaredNames(statement);
		const isHoisted =
			names.length > 0 &&
			names.every(
				(name) => ownerByName.get(name) !== void 0 && ownerByName.get(name) !== outPath,
			);

		if (isHoisted) {
			hoisted.push(statement);
		} else {
			survivors.push(statement);
		}
	}

	if (hoisted.length === 0) return;

	const referenced = collectReferencedNames(survivors);
	const importsByOwner = new Map<string, Set<string>>();

	for (const statement of hoisted) {
		for (const name of declaredNames(statement)) {
			if (!referenced.has(name)) continue;

			const owner = ownerByName.get(name)!;
			const bucket = importsByOwner.get(owner) ?? new Set<string>();
			bucket.add(name);
			importsByOwner.set(owner, bucket);
			usedOwners.add(owner);
		}

		statement.remove();
	}

	const lines = [...importsByOwner.entries()]
		.map(([owner, names]) => {
			const specifier = relativeSpecifier(outPath, owner);
			return `import type { ${[...names].sort().join(', ')} } from '${specifier}';`;
		})
		.sort();

	if (lines.length > 0) sourceFile.insertStatements(0, lines.join('\n'));
}

/**
 * @description Parses a per-module bundle, strips its `@internal` declarations, collapses nested
 * namespace re-exports into imports of their child files, hoists inlined library declarations into
 * per-library imports, and returns the cleaned text.
 * @param text The raw bundle text.
 * @param outPath The module's absolute output path, used to resolve relative specifiers.
 * @param children The nested subpath entries whose parent is this module.
 * @param ownerByName The map attributing each hoisted declaration name to its owning hoist file.
 * @param usedOwners Collects the hoist-file paths actually imported from, so orphan files aren't emitted.
 * @returns The stripped, collapsed, hoisted module text.
 */
export function strip(
	text: string,
	outPath: string,
	children: Map<string, ModuleEntry>,
	ownerByName: Map<string, string>,
	usedOwners: Set<string>,
): string {
	const project = new Project({ useInMemoryFileSystem: true });
	const sourceFile = project.createSourceFile('bundle.d.ts', text);

	stripInternal(sourceFile, new Set<string>(), new Set<string>());
	collapseNamespaces(sourceFile, outPath, children);
	hoistLibraries(sourceFile, outPath, ownerByName, usedOwners);

	return sourceFile.getFullText();
}
