import { join, relative, sep } from 'node:path';

import { diagnostic, type Diagnostic } from '~/lib/check/diagnostic';
import { parseFile, type ParsedFile } from '~/lib/check/parse-cache';
import { listSourceFiles } from '~/lib/checks/source-files';
import { Visitor } from '~/rollup/rolldown-utils';
import type { Check } from '~/lib/check/check';

const UI_SELECTOR =
	/^(set(Frame|Bounds|Center|Hidden|Alpha|Transform|BackgroundColor|Text|AttributedText|NeedsLayout|NeedsDisplay|Image|Font|TextColor|Tag|ClipsToBounds|ContentOffset|ContentInset)|layoutSubviews|layoutIfNeeded|addSubview|insertSubview|removeFromSuperview|bringSubviewToFront|sendSubviewToBack|frame|bounds|center|subviews|superview|window|sizeThatFits|becomeFirstResponder|resignFirstResponder|reloadData|endEditing)(:|$)/;

type Range = [number, number];

type FunctionNode = { start: number; end: number; body?: unknown };

// UNKNOWN: oxc nodes are read structurally here.
function isWorkletBody(body: unknown): boolean {
	const statements = Reflect.get(Object(body), 'body');
	const [first] = Array.isArray(statements) ? statements : [];

	return Reflect.get(Object(first), 'directive') === 'worklet';
}

// UNKNOWN: oxc nodes are read structurally here.
function stringValue(node: unknown): string | undefined {
	const value = Reflect.get(Object(node), 'value');

	return Reflect.get(Object(node), 'type') === 'Literal' && typeof value === 'string'
		? value
		: undefined;
}

// UNKNOWN: oxc nodes are read structurally here.
function isMainThreadOption(node: unknown): boolean {
	const properties = Reflect.get(Object(node), 'properties');

	return (
		Array.isArray(properties) &&
		properties.some(
			(property) =>
				Reflect.get(Object(Reflect.get(Object(property), 'key')), 'name') === 'thread' &&
				String(stringValue(Reflect.get(Object(property), 'value'))).startsWith('main'),
		)
	);
}

/**
 * @description Finds synchronous `objc.call` and `objc.invoke` calls with a UIKit view selector outside a worklet,
 * which run on Discord's JavaScript thread, where UIKit must not be touched.
 * @param parsed The parsed file.
 * @param file The file relative to the addon, for the diagnostics.
 * @returns One warning per call.
 */
export function findOffMainUiCalls(parsed: ParsedFile, file: string): Diagnostic[] {
	const worklets: Range[] = [];
	const calls: { start: number; selector: string }[] = [];

	function functionVisitor(node: FunctionNode) {
		if (isWorkletBody(node.body)) {
			worklets.push([node.start, node.end]);
		}
	}

	const visitor = new Visitor({
		FunctionDeclaration: functionVisitor,
		FunctionExpression: functionVisitor,
		ArrowFunctionExpression: functionVisitor,
		CallExpression(node) {
			const { callee } = node;

			if (
				callee.type !== 'MemberExpression' ||
				callee.property.type !== 'Identifier' ||
				!['call', 'invoke'].includes(callee.property.name) ||
				callee.object.type !== 'Identifier' ||
				callee.object.name !== 'objc'
			) {
				return;
			}

			const selector = stringValue(node.arguments[1]);
			const options = callee.property.name === 'invoke' ? node.arguments[3] : undefined;

			if (selector && UI_SELECTOR.test(selector) && !isMainThreadOption(options)) {
				calls.push({ start: node.start, selector });
			}
		},
	});

	visitor.visit(parsed.result.program);

	return calls
		.filter(({ start }) => !worklets.some(([from, to]) => start >= from && start < to))
		.map(({ start, selector }) =>
			diagnostic({
				file,
				...parsed.locate(start),
				severity: 'warning',
				message: `objc ${selector} touches UIKit from the JavaScript thread`,
				fix: "use objc.invokeAsync, pass { thread: 'main' }, or move it into a 'worklet' run with native.ui",
			}),
		);
}

export const mainThreadUiCheck: Check = {
	id: 'main-thread-ui',
	/**
	 * @description Warns about UIKit view calls a plugin makes on Discord's JavaScript thread.
	 * @param context The addon to check.
	 * @returns One warning per call.
	 */
	run({ addon, cache }) {
		return listSourceFiles(join(addon.dir, 'src')).flatMap((path) =>
			findOffMainUiCalls(
				parseFile(cache.parse, path),
				relative(addon.dir, path).split(sep).join('/'),
			),
		);
	},
};

export default { findOffMainUiCalls, mainThreadUiCheck };
