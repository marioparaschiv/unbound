import {
	findElement,
	isElementNode,
	type ElementNode,
} from '@unbound-plugins/shared/react/find-element';
import type { AnyProps } from '@unbound-app/api/metro';
import { createElement } from 'react';

import { getSheetKind, parseExpression, type Expression, type ExpressionKind } from '~/expression';
import ExpressionActionBar from '~/components/expression-action-bar';
import { ActionSheets, Patcher } from '~/modules';

export type ExpressionSheetPatches = ReturnType<typeof createExpressionSheetPatches>;

// UNKNOWN: a render result can be any React node.
function findChildren(node: unknown, depth: number = 0): unknown[] | null {
	if (depth > 12 || !isElementNode(node)) return null;

	if (Array.isArray(node)) return node;

	const { props } = node;

	if (Array.isArray(props?.children)) return props.children;

	return findChildren(props?.children, depth + 1);
}

// UNKNOWN: a child can be any React node.
function isActionBar(child: unknown): boolean {
	return isElementNode(child) && child.type === ExpressionActionBar;
}

// UNKNOWN: a render result can be any React node.
function appendActionBar(result: unknown, expression: Expression, sheetKey: string): void {
	const children = findChildren(result);

	if (!children || children.some(isActionBar)) return;

	children.push(
		createElement(ExpressionActionBar, {
			expression,
			key: 'unbound.expression-tools-action',
			sheetKey,
		}),
	);
}

function isDetailSheet({ props }: ElementNode): boolean {
	// The shared element props do not declare these, so `in` narrows them.
	if (!props || !('emojiNode' in props) || !('nonce' in props)) return false;

	return Boolean(props.emojiNode) && props.nonce !== undefined;
}

/**
 * @description Creates the patches that add the action bar to emoji and sticker detail sheets. Discord creates these components lazily, so each one is patched when it first appears.
 * @returns Functions that patch a sheet module or a detail element once, and `dispose`, which removes every patch and ignores sheets that load later.
 */
export function createExpressionSheetPatches() {
	const patched = new WeakSet<object>();
	const unpatches: (() => void)[] = [];
	let disposed = false;

	function afterOnce(
		owner: AnyProps,
		method: string,
		callback: Parameters<typeof Patcher.after<AnyProps, string>>[2],
	) {
		if (disposed || patched.has(owner) || typeof owner[method] !== 'function') return;

		patched.add(owner);
		unpatches.push(Patcher.after(owner, method, callback));
	}

	function patchDetailSheet(detail: AnyProps, expression: Expression, sheetKey: string) {
		afterOnce(detail, 'type', ({ result }) => appendActionBar(result, expression, sheetKey));
	}

	function patchExpressionSheet(module: AnyProps, kind: ExpressionKind, sheetKey: string) {
		afterOnce(module, 'default', ({ args: [props], result }) => {
			const expression = parseExpression(kind, props);

			if (!expression || !result || typeof result !== 'object') return;

			appendActionBar(result, expression, sheetKey);
			afterOnce(result, 'type', ({ result: content }) => {
				const detail = findElement(content, isDetailSheet);

				if (detail) patchDetailSheet(detail, expression, sheetKey);

				appendActionBar(content, expression, sheetKey);
			});
		});
	}

	function dispose() {
		disposed = true;

		for (const unpatch of unpatches.splice(0)) unpatch();
	}

	return { patchExpressionSheet, patchDetailSheet, dispose };
}

/**
 * @description Watches `openLazy` for emoji and sticker sheets, and patches each sheet's component once it loads.
 * @param sheets The patches that add the action bar to a loaded sheet.
 * @returns A function that removes the patch.
 */
export function patchActionSheets(sheets: ExpressionSheetPatches): () => void {
	return Patcher.before(ActionSheets, 'openLazy', ({ args: [load, key] }) => {
		if (typeof key !== 'string' || !load?.then) return;

		const kind = getSheetKind(key);

		if (!kind) return;

		load.then((module?: AnyProps) => {
			if (module && typeof module === 'object')
				sheets.patchExpressionSheet(module, kind, key);
		}).catch(() => undefined);
	});
}

export default { createExpressionSheetPatches, patchActionSheets };
