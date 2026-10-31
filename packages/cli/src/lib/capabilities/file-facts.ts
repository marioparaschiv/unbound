import type { NativePluginCapability, NativePluginPlatform } from '@unbound-app/types/native';
import { NATIVE_PLUGIN_METHOD_CAPABILITIES } from '@unbound-app/types/native-methods';
import { NATIVE_PLUGIN_PLATFORMS } from '@unbound-app/types/native';
import { relative, sep } from 'node:path';
import { realpathSync } from 'node:fs';
import ts from 'typescript';

import type { BridgeTypes } from '~/lib/capabilities/bridge-types';

export type BridgeCall = {
	method: string;
	capability: NativePluginCapability;
	site: string;
};

export type DynamicAccess = {
	reason: string;
	site: string;
};

export type ImportEdge = {
	path: string;
	site: string;
};

export type PlatformHandler = {
	platform: NativePluginPlatform;
	file: string;
	declaredIn: string;
};

export type FileFacts = {
	calls: BridgeCall[];
	dynamic: DynamicAccess[];
	imports: ImportEdge[];
	handlers: PlatformHandler[];
};

export type FactsContext = {
	program: ts.Program;
	bridge: BridgeTypes;
	siteRoot: string;
};

const METHOD_CAPABILITIES: Record<string, NativePluginCapability> =
	NATIVE_PLUGIN_METHOD_CAPABILITIES;
const PLATFORMS: readonly string[] = NATIVE_PLUGIN_PLATFORMS;
const DEFINE_PLATFORM = 'definePlatform';
const NODE_MODULES = `${sep}node_modules${sep}`;

/**
 * @description Resolves a path through symlinks, so a workspace package and its link name one file.
 * @param path The path to resolve.
 * @returns The real path, or the path itself when it does not exist.
 */
export function realPath(path: string): string {
	try {
		return realpathSync(path);
	} catch {
		return path;
	}
}

/**
 * @description Reads a source file's bridge calls, dynamic bridge accesses, runtime imports of the
 * addon's own files, and the Platform handlers it passes to `definePlatform`.
 * @param file The source file.
 * @param context The program, its bridge types and the directory sites are named from.
 * @returns The file's facts.
 */
export function readFileFacts(file: ts.SourceFile, context: FactsContext): FileFacts {
	const { program, bridge } = context;
	const checker = program.getTypeChecker();
	const facts: FileFacts = { calls: [], dynamic: [], imports: [], handlers: [] };
	const path = realPath(file.fileName);

	function site(node: ts.Node): string {
		const { line } = file.getLineAndCharacterOfPosition(node.getStart(file));

		return `${relative(context.siteRoot, path).split(sep).join('/')}:${line + 1}`;
	}

	function record(namespace: string, member: string, node: ts.Node) {
		const method = `${namespace}.${member}`;
		const capability = METHOD_CAPABILITIES[method];

		if (capability) {
			facts.calls.push({ method, capability, site: site(node) });
		}
	}

	function dynamic(reason: string, node: ts.Node) {
		const text = node.getText(file).replace(/\s+/g, ' ').slice(0, 80);

		facts.dynamic.push({ reason: `${reason} (\`${text}\`)`, site: site(node) });
	}

	function addImport(specifier: string, node: ts.Node) {
		const resolved = ts.resolveModuleName(
			specifier,
			file.fileName,
			program.getCompilerOptions(),
			ts.sys,
		).resolvedModule?.resolvedFileName;

		if (!resolved || resolved.endsWith('.d.ts')) return;

		const target = realPath(resolved);

		if (target.includes(NODE_MODULES)) return;

		facts.imports.push({ path: target, site: site(node) });
	}

	function visitImport(node: ts.Node) {
		if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
			if (!isTypeOnlyImport(node.importClause)) {
				addImport(node.moduleSpecifier.text, node);
			}

			return;
		}

		if (
			ts.isExportDeclaration(node) &&
			!node.isTypeOnly &&
			node.moduleSpecifier &&
			ts.isStringLiteral(node.moduleSpecifier)
		) {
			addImport(node.moduleSpecifier.text, node);
		}

		if (!ts.isCallExpression(node) || !isModuleLoad(node)) return;

		const [argument] = node.arguments;

		if (argument && ts.isStringLiteralLike(argument)) {
			addImport(argument.text, node);
		} else {
			dynamic('loads a module by a computed path', node);
		}
	}

	function visitDefinePlatform(node: ts.CallExpression) {
		const [argument] = node.arguments;

		if (!argument || !ts.isObjectLiteralExpression(argument)) {
			dynamic(`passes ${DEFINE_PLATFORM} something other than an object literal`, node);

			return;
		}

		for (const property of argument.properties) {
			const handler = readHandler(property);

			if (handler) {
				facts.handlers.push({ ...handler, declaredIn: path });
			} else {
				dynamic(
					`passes ${DEFINE_PLATFORM} a handler that is not an ios or android binding imported from another file`,
					property,
				);
			}
		}
	}

	function readHandler(property: ts.ObjectLiteralElementLike) {
		const key = property.name && ts.isIdentifier(property.name) ? property.name.text : '';
		const value = ts.isShorthandPropertyAssignment(property)
			? property.name
			: ts.isPropertyAssignment(property)
				? property.initializer
				: undefined;

		if (!isPlatform(key) || !value || !ts.isIdentifier(value)) return;

		let symbol = ts.isShorthandPropertyAssignment(property)
			? checker.getShorthandAssignmentValueSymbol(property)
			: checker.getSymbolAtLocation(value);

		if (symbol && symbol.flags & ts.SymbolFlags.Alias) {
			symbol = checker.getAliasedSymbol(symbol);
		}

		const declaration = symbol?.declarations?.[0];

		if (!declaration || declaration.getSourceFile() === file) return;

		return { platform: key, file: realPath(declaration.getSourceFile().fileName) };
	}

	function visitAccess(node: ts.Node) {
		if (ts.isPropertyAccessExpression(node)) {
			const namespace = bridge.namespaceOfMember(checker.getSymbolAtLocation(node.name));

			if (namespace) {
				record(namespace, node.name.text, node);
			}
		}

		if (ts.isElementAccessExpression(node)) {
			const namespace = bridge.namespaceOfType(checker.getTypeAtLocation(node.expression));

			if (namespace === undefined) return;

			const argument = node.argumentExpression;

			if (ts.isStringLiteralLike(argument)) {
				record(namespace, argument.text, node);
			} else {
				dynamic('reads a bridge member by a computed name', node);
			}
		}

		if (!ts.isObjectBindingPattern(node)) return;

		const namespace = bridge.namespaceOfType(checker.getTypeAtLocation(node));

		if (namespace === undefined) return;

		for (const element of node.elements) {
			const key = element.propertyName ?? element.name;

			if (element.dotDotDotToken) {
				dynamic('collects bridge members into a rest object', element);
			} else if (ts.isIdentifier(key) || ts.isStringLiteralLike(key)) {
				record(namespace, key.text, element);
			} else {
				dynamic('destructures a bridge member by a computed name', element);
			}
		}
	}

	function visitLostBridge(node: ts.Node) {
		if (
			(ts.isSpreadElement(node) || ts.isSpreadAssignment(node)) &&
			bridge.namespaceOfType(checker.getTypeAtLocation(node.expression)) !== undefined
		) {
			dynamic('spreads a bridge', node);
		}

		if (
			ts.isForInStatement(node) &&
			bridge.namespaceOfType(checker.getTypeAtLocation(node.expression)) !== undefined
		) {
			dynamic('iterates a bridge with for...in', node.expression);
		}

		if (
			!(ts.isIdentifier(node) || ts.isPropertyAccessExpression(node)) ||
			!ts.isExpression(node) ||
			(ts.isPropertyAccessExpression(node.parent) && node.parent.name === node)
		) {
			return;
		}

		const namespace = bridge.namespaceOfType(checker.getTypeAtLocation(node));

		if (namespace === undefined) return;

		const parent = node.parent;
		const target = ts.isAsExpression(parent)
			? checker.getTypeFromTypeNode(parent.type)
			: checker.getContextualType(node);

		if (!target) return;

		if (bridge.isOpaque(target)) {
			dynamic('passes a bridge where its type is lost', node);

			return;
		}

		if (
			!(target.flags & ts.TypeFlags.TypeParameter) &&
			!isBindingPattern(ts.isVariableDeclaration(parent) ? parent.name : parent) &&
			bridge.namespaceOfType(target) === undefined &&
			!(namespace === '' && bridge.isBridgeContainer(target))
		) {
			dynamic(
				`passes a bridge as ${checker.typeToString(target)}, which is not an SDK bridge type`,
				node,
			);
		}
	}

	function visit(node: ts.Node) {
		visitImport(node);

		if (ts.isCallExpression(node) && calleeName(node) === DEFINE_PLATFORM) {
			visitDefinePlatform(node);
		}

		visitAccess(node);
		visitLostBridge(node);
		ts.forEachChild(node, visit);
	}

	visit(file);

	return facts;
}

function isPlatform(value: string): value is NativePluginPlatform {
	return PLATFORMS.includes(value);
}

function isBindingPattern(node: ts.Node): boolean {
	return ts.isObjectBindingPattern(node) || ts.isArrayBindingPattern(node);
}

function isTypeOnlyImport(clause: ts.ImportClause | undefined): boolean {
	if (!clause) {
		return false;
	}

	if (clause.isTypeOnly) {
		return true;
	}

	const bindings = clause.namedBindings;

	return (
		!clause.name &&
		bindings !== undefined &&
		ts.isNamedImports(bindings) &&
		bindings.elements.every((element) => element.isTypeOnly)
	);
}

function isModuleLoad(node: ts.CallExpression): boolean {
	return (
		node.expression.kind === ts.SyntaxKind.ImportKeyword ||
		(ts.isIdentifier(node.expression) && node.expression.text === 'require')
	);
}

function calleeName(node: ts.CallExpression): string | undefined {
	const callee = node.expression;

	if (ts.isIdentifier(callee)) {
		return callee.text;
	}

	return ts.isPropertyAccessExpression(callee) ? callee.name.text : undefined;
}

export default { realPath, readFileFacts };
