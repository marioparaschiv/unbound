import type { NativeJavaBridge, NativeJavaReference } from '@unbound-app/api/native';

import { javaFlag, javaReference, javaString } from './java-values';

export const TEXT_REWRITES_CLASS = 'app.unbound.android.TextRewrites';

export type TextRewriteEdit = {
	start: number;
	end: number;
	text: string;
	spacerOffset?: number;
	width?: number;
	height?: number;
	clearFrom?: number;
	clearTo?: number;
	collapseNext?: boolean;
	imageKey?: string;
	imageOffset?: number;
	imageSize?: number;
	stretchFrom?: number;
	stretchTo?: number;
	stretchClasses?: string[];
};

export type TextRewriteAnchor = {
	placeholder: number;
	width: number;
	height: number;
	pinTop?: boolean;
	offsetY?: number;
};

export type TextRewrites = {
	put(original: string, rendered: string, edits: TextRewriteEdit[]): void;
	remove(original: string): void;
	putImage(key: string, bitmap: NativeJavaReference): void;
	hasImage(key: string): boolean;
	addHost(
		groupId: string,
		rendered: string,
		host: NativeJavaReference,
		anchor: TextRewriteAnchor,
	): void;
	updateAnchor(host: NativeJavaReference, anchor: TextRewriteAnchor): void;
	removeGroup(groupId: string): void;
	reapply(textView: NativeJavaReference): void;
	refresh(rendered: string): void;
	refreshAll(): void;
};

/**
 * @description Connects to the loader's native text rewrites. They apply a plugin's text edits while Discord sets a message's text, and move, show, hide and position the plugin's host views in the same step, so a recycled chat row never shows Discord's original text or another message's view.
 * @param java The plugin's Java bridge.
 * @param watchedClass The text view class whose text is rewritten, such as Discord's message content view.
 * @returns The rewrites, or `null` when the installed loader predates them.
 */
export function connectTextRewrites(
	java: Pick<NativeJavaBridge, 'getClass' | 'getField' | 'invoke'>,
	watchedClass: string,
): TextRewrites | null {
	let instance: NativeJavaReference | null = null;

	try {
		instance = javaReference(java.getField(java.getClass(TEXT_REWRITES_CLASS), 'INSTANCE'));
	} catch {
		return null;
	}

	if (!instance) return null;

	const target = instance;

	function call(method: string, args: Parameters<NativeJavaBridge['invoke']>[2]) {
		java.invoke(target, method, args);
	}

	call('watch', [javaString(watchedClass)]);

	return {
		put: (original, rendered, edits) =>
			call('put', [
				javaString(original),
				javaString(rendered),
				javaString(JSON.stringify(edits)),
			]),
		remove: (original) => call('remove', [javaString(original)]),
		putImage: (key, bitmap) => call('putImage', [javaString(key), bitmap]),
		hasImage: (key) => javaFlag(java.invoke(target, 'hasImage', [javaString(key)])),
		addHost: (groupId, rendered, host, anchor) =>
			call('addHost', [
				javaString(groupId),
				javaString(rendered),
				host,
				javaString(JSON.stringify(anchor)),
			]),
		updateAnchor: (host, anchor) =>
			call('updateAnchor', [host, javaString(JSON.stringify(anchor))]),
		removeGroup: (groupId) => call('removeGroup', [javaString(groupId)]),
		reapply: (textView) => call('reapply', [textView]),
		refresh: (rendered) => call('refresh', [javaString(rendered)]),
		refreshAll: () => call('refreshAll', []),
	};
}

export default { connectTextRewrites, TEXT_REWRITES_CLASS };
