import {
	contextObjectMarker,
	functionHooks,
	gestureBuilderMethods,
	gestureObjects,
	hookArguments,
	layoutAnimationModifiers,
	layoutAnimations,
	objectHooks,
	workletClassMarker,
} from './worklet-callbacks.ts';
import { parseSync, Visitor, type ESTree } from './rolldown-utils.ts';

type Language = 'js' | 'jsx' | 'ts' | 'tsx';

/**
 * @description Checks whether the Reanimated plugin would transform a module, so only those pay for the Babel pass. Mirrors the plugin's own matching: callees by name, not by import.
 * @param code The module's source.
 * @param id The module's path, which picks the parser language.
 * @returns Whether the module has a `'worklet'` directive, an auto-workletized callback, a worklet class or a worklet context object.
 */
export function needsWorklets(code: string, id: string): boolean {
	const { program, errors } = parseSync(id, code, {
		lang: languageOf(id),
		preserveParens: false,
	});

	// Babel reports the syntax error with the module's own location.
	if (errors.length) {
		return true;
	}

	let found = false;

	new Visitor({
		ExpressionStatement(node) {
			found ||= node.directive === 'worklet';
		},
		CallExpression(node) {
			found ||= isAutoworkletizedCall(node);
		},
		ObjectExpression(node) {
			found ||= node.properties.some(isContextObjectMarker);
		},
		PropertyDefinition(node) {
			found ||= isIdentifierNamed(node.key, workletClassMarker);
		},
	}).visit(program);

	return found;
}

function languageOf(id: string): Language {
	if (/\.[cm]?ts$/.test(id)) {
		return 'ts';
	}

	return id.endsWith('.tsx') ? 'tsx' : 'jsx';
}

function isAutoworkletizedCall(node: ESTree.CallExpression) {
	return isHookCall(node) || isGestureCallbackCall(node) || isLayoutCallbackCall(node);
}

function isHookCall(node: ESTree.CallExpression) {
	const name = calleeName(node.callee);
	const indices = name === undefined ? undefined : hookArguments.get(name);

	if (!name || !indices) {
		return false;
	}

	const functions = functionHooks.has(name);
	const objects = objectHooks.has(name);

	return indices.some((index) => isWorkletizable(node.arguments[index], functions, objects));
}

function isGestureCallbackCall(node: ESTree.CallExpression) {
	const callee = unwrapSequence(node.callee);

	return (
		callee.type === 'MemberExpression' &&
		isIdentifierIn(callee.property, gestureBuilderMethods) &&
		isGestureChain(callee.object) &&
		node.arguments.some((argument) => isWorkletizable(argument, true, true))
	);
}

function isLayoutCallbackCall(node: ESTree.CallExpression) {
	const { callee } = node;

	return (
		callee.type === 'MemberExpression' &&
		isIdentifierNamed(callee.property, 'withCallback') &&
		isLayoutAnimation(callee.object) &&
		node.arguments.some((argument) => isWorkletizable(argument, true, false))
	);
}

// `Gesture.Pan()` or a builder call chained on one, as in `Gesture.Pan().minDistance(1)`.
function isGestureChain(node: ESTree.Expression): boolean {
	if (node.type !== 'CallExpression' || node.callee.type !== 'MemberExpression') {
		return false;
	}

	const { object, property } = node.callee;

	return (
		(isIdentifierNamed(object, 'Gesture') && isIdentifierIn(property, gestureObjects)) ||
		isGestureChain(object)
	);
}

// `FadeIn`, `new FadeIn()` or a modifier chained on one, as in `FadeIn.duration(300)`.
function isLayoutAnimation(node: ESTree.Expression): boolean {
	if (node.type === 'Identifier') {
		return layoutAnimations.has(node.name);
	}

	if (node.type === 'NewExpression') {
		return isIdentifierIn(node.callee, layoutAnimations);
	}

	return (
		node.type === 'CallExpression' &&
		node.callee.type === 'MemberExpression' &&
		isIdentifierIn(node.callee.property, layoutAnimationModifiers) &&
		isLayoutAnimation(node.callee.object)
	);
}

// The plugin names `(0, hook)(…)` by its last expression, and `a.hook(…)` or `a[hook](…)` by the property.
function calleeName(callee: ESTree.Expression) {
	const node = unwrapSequence(callee);

	if (node.type === 'Identifier') {
		return node.name;
	}

	if (node.type === 'MemberExpression' && node.property.type === 'Identifier') {
		return node.property.name;
	}

	return undefined;
}

function unwrapSequence(node: ESTree.Expression) {
	return node.type === 'SequenceExpression' ? (node.expressions.at(-1) ?? node) : node;
}

// An identifier may resolve to a worklet the plugin follows through its binding, so it counts.
function isWorkletizable(
	argument: ESTree.Argument | undefined,
	functions: boolean,
	objects: boolean,
) {
	const node = argument && unwrapTypeScript(argument);

	if (!node) {
		return false;
	}

	return (
		node.type === 'Identifier' ||
		(functions &&
			(node.type === 'ArrowFunctionExpression' || node.type === 'FunctionExpression')) ||
		(objects && node.type === 'ObjectExpression')
	);
}

// Over-matches `fn as T` and `fn!`: a false positive only costs a Babel pass.
function unwrapTypeScript(node: ESTree.Argument): ESTree.Argument {
	switch (node.type) {
		case 'TSAsExpression':
		case 'TSSatisfiesExpression':
		case 'TSNonNullExpression':
		case 'TSTypeAssertion':
			return unwrapTypeScript(node.expression);
		default:
			return node;
	}
}

function isContextObjectMarker(property: ESTree.ObjectExpression['properties'][number]) {
	return (
		property.type === 'Property' &&
		property.kind === 'init' &&
		!property.method &&
		isIdentifierNamed(property.key, contextObjectMarker)
	);
}

function isIdentifierNamed(node: ESTree.Node, name: string) {
	return node.type === 'Identifier' && node.name === name;
}

function isIdentifierIn(node: ESTree.Node, names: Set<string>) {
	return node.type === 'Identifier' && names.has(node.name);
}
