import type { NodeOf, Rule } from './rule';

import propertyName from './property-name.ts';

type CallNode = NodeOf<'CallExpression'>;

type Options = { lazyByDefault?: boolean };

const LOOKUPS_BY_NAMESPACE = new Map([
	[
		'metro',
		new Set([
			'find',
			'findByProps',
			'findByName',
			'findByFilePath',
			'findByPrototypes',
			'findStore',
		]),
	],
	['flux', new Set(['getStore'])],
]);

const SUBPATH_NAMESPACES = new Map([
	['@unbound-app/api/metro', 'metro'],
	['@unbound-app/api/flux', 'flux'],
]);

const FUNCTIONS = new Set(['FunctionDeclaration', 'FunctionExpression', 'ArrowFunctionExpression']);

function isInFunction(call: CallNode): boolean {
	for (let node = call.parent; node.type !== 'Program'; node = node.parent) {
		if (FUNCTIONS.has(node.type)) {
			return true;
		}
	}

	return false;
}

function isLookup(namespace: string | undefined, name: string | undefined): boolean {
	return Boolean(namespace && name && LOOKUPS_BY_NAMESPACE.get(namespace)?.has(name));
}

function identifierOrLastKey(node: CallNode['callee']): string | undefined {
	if (node.type === 'Identifier') {
		return node.name;
	}

	return node.type === 'MemberExpression' ? propertyName(node) : undefined;
}

function isLazy(call: CallNode, lazyByDefault: boolean): boolean {
	const last = call.arguments.at(-1);

	if (last?.type !== 'ObjectExpression') {
		return lazyByDefault;
	}

	const option = last.properties.find(
		(property) =>
			property.type === 'Property' &&
			!property.computed &&
			property.key.type === 'Identifier' &&
			property.key.name === 'lazy',
	);

	if (!option || option.type !== 'Property') {
		return lazyByDefault;
	}

	return option.value.type === 'Literal' && option.value.value === true;
}

const noModuleScopeLookup: Rule = {
	meta: {
		type: 'problem',
		schema: [
			{
				type: 'object',
				properties: { lazyByDefault: { type: 'boolean' } },
				additionalProperties: false,
			},
		],
		messages: {
			eager: '`{{call}}` searches every Discord module while the addon loads. Pass `{ lazy: true }` or move the lookup into the function that uses it.',
		},
	},
	create(context) {
		const [options] = context.options as [Options | undefined];
		const lazyByDefault = options?.lazyByDefault ?? false;

		const importedLookups = new Map<string, string>();

		return {
			Program(program) {
				for (const statement of program.body) {
					if (statement.type !== 'ImportDeclaration') {
						continue;
					}

					const namespace = SUBPATH_NAMESPACES.get(statement.source.value);

					for (const specifier of statement.specifiers) {
						if (specifier.type !== 'ImportSpecifier') {
							continue;
						}

						const { imported: source } = specifier;
						const name = source.type === 'Identifier' ? source.name : source.value;

						if (isLookup(namespace, name)) {
							importedLookups.set(specifier.local.name, name);
						}
					}
				}
			},
			CallExpression(node) {
				const { callee } = node;
				let call: string | undefined;

				if (callee.type === 'Identifier' && importedLookups.has(callee.name)) {
					call = callee.name;
				} else if (callee.type === 'MemberExpression') {
					const namespace = identifierOrLastKey(callee.object);
					const name = propertyName(callee);

					if (isLookup(namespace, name)) {
						call = `${namespace}.${name}`;
					}
				}

				if (!call || isLazy(node, lazyByDefault) || isInFunction(node)) return;

				context.report({ node, messageId: 'eager', data: { call } });
			},
		};
	},
};

export default noModuleScopeLookup;
