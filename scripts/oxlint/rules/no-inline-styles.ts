import type { NodeOf, Rule } from '../rule';

import isTestFile from '../is-test-file.ts';

type Expression = NodeOf<'ExpressionStatement'>['expression'];

type Property = NodeOf<'ObjectExpression'>['properties'][number];

const STYLE_FILE = /\.style\.[cm]?[jt]sx?$/;

// `style`, `contentContainerStyle`, `nameStyle` and the like.
function isStyleAttribute(node: NodeOf<'JSXAttribute'>): boolean {
	const { name } = node;

	return name.type === 'JSXIdentifier' && (name.name === 'style' || name.name.endsWith('Style'));
}

// A value fixed at authoring time: `12`, `'center'`, `-1`, `'hidden' as const`.
function isStatic(node: Expression): boolean {
	switch (node.type) {
		case 'Literal':
			return true;
		case 'TemplateLiteral':
			return node.expressions.length === 0;
		case 'UnaryExpression':
			return isStatic(node.argument);
		case 'TSAsExpression':
		case 'TSSatisfiesExpression':
			return isStatic(node.expression);
		default:
			return false;
	}
}

function isStaticProperty(property: Property): boolean {
	return property.type === 'Property' && isStatic(property.value);
}

// Static values inline are what belongs in the style file; per-render values such as `{ width }` may stay.
function hasStaticStyle(node: Expression): boolean {
	switch (node.type) {
		case 'ObjectExpression':
			return node.properties.some(isStaticProperty);
		case 'ArrayExpression':
			return node.elements.some(
				(element) =>
					element !== null && element.type !== 'SpreadElement' && hasStaticStyle(element),
			);
		case 'ConditionalExpression':
			return hasStaticStyle(node.consequent) || hasStaticStyle(node.alternate);
		case 'LogicalExpression':
			return hasStaticStyle(node.left) || hasStaticStyle(node.right);
		case 'ArrowFunctionExpression':
			return node.body.type !== 'BlockStatement' && hasStaticStyle(node.body);
		default:
			return false;
	}
}

function isThemeColors(node: NodeOf<'MemberExpression'>): boolean {
	const { object, property } = node;

	if (object.type !== 'Identifier' || object.name !== 'Theme') {
		return false;
	}

	return node.computed
		? property.type === 'Literal' && property.value === 'colors'
		: property.type === 'Identifier' && property.name === 'colors';
}

function isUseToken(node: NodeOf<'CallExpression'>): boolean {
	const { callee } = node;

	if (callee.type === 'Identifier') {
		return callee.name === 'useToken';
	}

	return (
		callee.type === 'MemberExpression' &&
		!callee.computed &&
		callee.property.type === 'Identifier' &&
		callee.property.name === 'useToken'
	);
}

const noInlineStyles: Rule = {
	meta: {
		type: 'problem',
		messages: {
			inline: "Move styles into the component's .style.ts with Discord.createStyles; React Native drops inline theme tokens. (AGENTS.md)",
		},
	},
	create(context) {
		if (isTestFile(context.filename) || STYLE_FILE.test(context.filename)) {
			return {};
		}

		return {
			JSXAttribute(node) {
				const { value } = node;

				if (!isStyleAttribute(node) || value?.type !== 'JSXExpressionContainer') return;

				const { expression } = value;

				if (expression.type !== 'JSXEmptyExpression' && hasStaticStyle(expression)) {
					context.report({ node, messageId: 'inline' });
				}
			},
			MemberExpression(node) {
				if (isThemeColors(node)) {
					context.report({ node, messageId: 'inline' });
				}
			},
			CallExpression(node) {
				if (isUseToken(node)) {
					context.report({ node, messageId: 'inline' });
				}
			},
		};
	},
};

export default noInlineStyles;
