import type { NodeOf, Rule } from '../rule';

import propertyName from '../property-name.ts';

type CallNode = NodeOf<'CallExpression'>;

type Options = { lazyByDefault?: boolean };

// The calls that search Discord's modules, keyed by the API namespace that owns them.
const LOOKUPS = new Map([
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
	return Boolean(namespace && name && LOOKUPS.get(namespace)?.has(name));
}

// `metro`, or the `metro` key of another object such as `unbound.metro`.
function namespaceOf(node: CallNode['callee']): string | undefined {
	if (node.type === 'Identifier') {
		return node.name;
	}

	return node.type === 'MemberExpression' ? propertyName(node) : undefined;
}

// `{ lazy: true }` as the last argument makes the lookup lazy; a missing `lazy` key falls back to the default.
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

		// Local names of lookups imported from an API subpath, such as `import { findByProps } from '@unbound-app/api/metro'`.
		const imported = new Map<string, string>();

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
							imported.set(specifier.local.name, name);
						}
					}
				}
			},
			CallExpression(node) {
				const { callee } = node;
				let call: string | undefined;

				if (callee.type === 'Identifier' && imported.has(callee.name)) {
					call = callee.name;
				} else if (callee.type === 'MemberExpression') {
					const namespace = namespaceOf(callee.object);
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
