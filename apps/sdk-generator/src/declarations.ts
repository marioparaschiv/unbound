import { Node, SyntaxKind } from 'ts-morph';

/**
 * @description Tests whether a JSDocable node carries an `@internal` tag in its leading documentation.
 * @returns `true` when the node is tagged `@internal`.
 */
export function isInternal(node: Node): boolean {
	if (!Node.isJSDocable(node)) {
		return false;
	}

	return node
		.getJsDocs()
		.some((doc) => doc.getTags().some((tag) => tag.getTagName() === 'internal'));
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
			if (!isReference(reference)) {
				continue;
			}

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
 */
function isDeclarationName(reference: Node): boolean {
	const parent = reference.getParent() as { getNameNode?: () => Node | undefined };

	if (typeof parent.getNameNode !== 'function') {
		return false;
	}

	if (parent.getNameNode() !== reference) {
		return false;
	}

	return !Node.isComputedPropertyName(reference.getParent());
}

/**
 * @description Reports whether an identifier is a genuine reference to a declaration rather than a
 * binding or specifier name. An aliased export specifier (`X as Y`) references only `X`; an import
 * specifier's names are re-bindings, not references; a declaration's own name node is not a
 * reference. A computed `[X]` property name stays a reference (handled by `isDeclarationName`).
 */
function isReference(reference: Node): boolean {
	const parent = reference.getParent();

	if (Node.isExportSpecifier(parent)) {
		if (parent.getAliasNode() === reference) {
			return false;
		}
	} else if (Node.isImportSpecifier(parent)) {
		return false;
	} else if (isDeclarationName(reference)) {
		return false;
	}

	return true;
}

/**
 * @description Lists the binding names a top-level declaration introduces.
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
 * @description Tests whether a declaration introduces a runtime value (a `const`, function, class or enum)
 * rather than only a type.
 * @returns `true` when the statement declares a value.
 */
export function declaresValue(statement: Node): boolean {
	return (
		Node.isVariableStatement(statement) ||
		Node.isFunctionDeclaration(statement) ||
		Node.isClassDeclaration(statement) ||
		Node.isEnumDeclaration(statement)
	);
}

/**
 * @description Lists the names a statement container exports from its own statements: declarations
 * wearing an `export` modifier plus `export { A as B }` specifiers, under their exported alias.
 * Re-exports from other modules count (they are part of the surface); `export *` cannot be
 * enumerated statically and is ignored.
 * @param container A source file or module body exposing `getStatements`.
 * @returns The set of exported names.
 */
export function exportedNames(container: Node): Set<string> {
	const names = new Set<string>();

	if (!Node.isStatemented(container)) {
		return names;
	}

	for (const statement of container.getStatements()) {
		if (Node.isExportDeclaration(statement)) {
			for (const specifier of statement.getNamedExports()) {
				names.add(specifier.getAliasNode()?.getText() ?? specifier.getName());
			}

			const namespaceExport = statement.getNamespaceExport();

			if (namespaceExport) {
				names.add(namespaceExport.getName());
			}

			continue;
		}

		if (Node.isExportable(statement) && statement.hasExportKeyword()) {
			for (const name of declaredNames(statement)) names.add(name);
		}
	}

	return names;
}
