import ts from 'typescript';

export type BridgeTypes = {
	namespaceOfMember(symbol: ts.Symbol | undefined): string | undefined;
	namespaceOfType(type: ts.Type): string | undefined;
	isBridgeContainer(type: ts.Type): boolean;
	isOpaque(type: ts.Type | undefined): boolean;
};

const ROOT_BRIDGE = 'NativePluginBridge';

/**
 * @description Reads the bridge type aliases from `NativePluginBridge` in the program's declaration
 * files, so a member access resolves to its namespace by the type checker rather than by name.
 * @param program The addon's program.
 * @returns The lookups over the program's bridge types.
 */
export function createBridgeTypes(program: ts.Program): BridgeTypes {
	const checker = program.getTypeChecker();
	const aliasNamespaces = readAliasNamespaces(program);
	const namespaces = new Set(aliasNamespaces.values());

	function namespaceOfMember(symbol: ts.Symbol | undefined): string | undefined {
		for (const declaration of symbol?.declarations ?? []) {
			const alias = enclosingAlias(declaration);

			if (alias !== undefined && aliasNamespaces.has(alias)) {
				return aliasNamespaces.get(alias);
			}
		}

		return void 0;
	}

	function namespaceOfType(type: ts.Type): string | undefined {
		const properties = checker.getNonNullableType(type).getProperties();

		if (!properties.length) return;

		const found = new Set(properties.map(namespaceOfMember));

		if (found.size !== 1) return;

		return [...found][0];
	}

	function isBridgeContainer(type: ts.Type): boolean {
		const properties = checker.getNonNullableType(type).getProperties();

		return (
			properties.length > 0 &&
			properties.every((property) => {
				const declaration = property.valueDeclaration ?? property.declarations?.[0];

				if (!declaration) {
					return false;
				}

				const propertyType = checker.getTypeOfSymbolAtLocation(property, declaration);

				return (
					namespaceOfMember(property) !== undefined ||
					Boolean(namespaceOfType(propertyType)) ||
					!namespaces.has(property.name)
				);
			})
		);
	}

	function isOpaque(type: ts.Type | undefined): boolean {
		if (!type) {
			return true;
		}

		if (type.flags & (ts.TypeFlags.Any | ts.TypeFlags.Unknown | ts.TypeFlags.NonPrimitive)) {
			return true;
		}

		return Boolean(type.flags & ts.TypeFlags.Object) && type.getProperties().length === 0;
	}

	return { namespaceOfMember, namespaceOfType, isBridgeContainer, isOpaque };
}

function readAliasNamespaces(program: ts.Program): Map<string, string> {
	const aliases = new Map<string, string>();

	for (const file of program.getSourceFiles()) {
		if (!file.isDeclarationFile) {
			continue;
		}

		ts.forEachChild(file, (node) => {
			if (
				!ts.isTypeAliasDeclaration(node) ||
				node.name.text !== ROOT_BRIDGE ||
				!ts.isTypeLiteralNode(node.type)
			) {
				return;
			}

			aliases.set(ROOT_BRIDGE, '');

			for (const member of node.type.members) {
				if (
					ts.isPropertySignature(member) &&
					member.type &&
					ts.isTypeReferenceNode(member.type) &&
					ts.isIdentifier(member.name)
				) {
					aliases.set(member.type.typeName.getText(file), member.name.text);
				}
			}
		});
	}

	return aliases;
}

function enclosingAlias(declaration: ts.Node): string | undefined {
	let node: ts.Node | undefined = declaration;

	while (node && !ts.isTypeAliasDeclaration(node)) {
		node = node.parent;
	}

	return node && ts.isTypeAliasDeclaration(node) ? node.name.text : undefined;
}

export default { createBridgeTypes };
