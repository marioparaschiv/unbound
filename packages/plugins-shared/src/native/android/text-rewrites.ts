import {
	addHost,
	disposeTextRewrites,
	installTextRewrites,
	putImage,
	putRule,
	reapply,
	refresh,
	removeGroup,
	removeImage,
	removeRule,
	updateAnchor,
} from '@unbound-plugins/shared/native/android/text-rewrite-worklets';
import type {
	NativeBridge,
	NativeJavaReference,
	NativeJavaValue,
	NativeUIScope,
} from '@unbound-app/api/native';
import type {
	TextRewriteAnchor,
	TextRewriteEdit,
} from '@unbound-plugins/shared/native/android/text-edits';

export type { TextRewriteAnchor, TextRewriteEdit };

const MINIMUM_API = [1, 4, 0];
const MAX_IMAGES = 128;

let nextConnection = 0;

export type TextRewriteNative = Pick<NativeBridge, 'apiVersion' | 'java' | 'hooks' | 'ui'>;

export type TextRewriteOptions = {
	/** The plugin's name, for logs. */
	label: string;
	/** Called when a shown text has no free group of host views. */
	onNeedsHost?: (rendered: string) => void;
};

export type TextRewrites = {
	put(original: string, rendered: string, edits: TextRewriteEdit[]): boolean;
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
	dispose(): void;
};

/**
 * @description Checks whether the loader's bridge rewrites hooked arguments and implements Java interfaces, which text rewrites need.
 * @param apiVersion The native bridge's API version.
 * @returns Whether it is 1.4.0 or newer.
 */
export function supportsTextRewrites(apiVersion: string): boolean {
	const parts = apiVersion.split('.').map(Number);

	for (const [index, minimum] of MINIMUM_API.entries()) {
		const part = parts[index] ?? 0;

		if (part !== minimum) {
			return part > minimum;
		}
	}

	return true;
}

function tagged(reference: NativeJavaReference): NativeJavaValue {
	const { type, value, id } = reference as { type?: unknown; value?: unknown; id?: unknown };

	if (type === 'handle' && typeof value === 'string') {
		return { type: 'handle', value };
	}

	return { type: 'handle', value: String(id) };
}

/**
 * @description Rewrites the text of one Android text view class while Discord sets it, on the UI thread, and moves, shows and hides the plugin's host views in the same frame, so a recycled chat row never shows Discord's original text or another message's view.
 * @param native The plugin's native bridge.
 * @param watchedClass The text view class whose text is rewritten, such as Discord's message content view.
 * @param options The plugin's name for logs, and what to do when a shown text has no free group of host views.
 * @returns The rewrites, or `null` when the loader cannot rewrite hooked arguments or implement Java interfaces.
 */
export function connectTextRewrites(
	native: TextRewriteNative,
	watchedClass: string,
	options: TextRewriteOptions,
): TextRewrites | null {
	const { ui } = native;

	if (!ui || !native.java || !native.hooks || !supportsTextRewrites(native.apiVersion))
		return null;

	const stateKey = `__unboundTextRewrites:${options.label}:${nextConnection++}`;
	const rules = new Map<string, string>();
	const images = new Map<string, NativeJavaReference>();
	const hosts = new Set<NativeJavaReference>();
	const needsHost = ui.callback((rendered: string) => options.onNeedsHost?.(rendered));
	const scope: NativeUIScope = ui.createScope();
	let disposed = false;

	ui.run(installTextRewrites, scope, { stateKey, watchedClass, label: options.label }, needsHost);

	return {
		put(original, rendered, edits) {
			if (disposed) {
				return false;
			}

			const existing = rules.get(original);

			if (existing !== undefined && existing !== rendered) {
				return false;
			}

			rules.delete(original);
			rules.set(original, rendered);
			ui.run(putRule, stateKey, original, rendered, edits);

			return true;
		},
		remove(original) {
			if (!rules.delete(original)) return;

			ui.run(removeRule, stateKey, original);
		},
		putImage(key, bitmap) {
			if (disposed) return;

			images.delete(key);
			images.set(key, bitmap);
			ui.run(putImage, stateKey, key, tagged(bitmap));

			if (images.size <= MAX_IMAGES) return;

			const oldest = images.keys().next().value!;

			images.delete(oldest);
			ui.run(removeImage, stateKey, oldest);
		},
		hasImage: (key) => images.has(key),
		addHost(groupId, rendered, host, anchor) {
			if (disposed) return;

			hosts.add(host);
			ui.run(addHost, stateKey, groupId, rendered, tagged(host), anchor);
		},
		updateAnchor(host, anchor) {
			if (!disposed) {
				ui.run(updateAnchor, stateKey, tagged(host), anchor);
			}
		},
		removeGroup(groupId) {
			if (!disposed) {
				ui.run(removeGroup, stateKey, groupId);
			}
		},
		reapply(textView) {
			if (!disposed) {
				ui.run(reapply, stateKey, tagged(textView));
			}
		},
		refresh(rendered) {
			if (!disposed) {
				ui.run(refresh, stateKey, rendered);
			}
		},
		refreshAll() {
			if (!disposed) {
				ui.run(refresh, stateKey);
			}
		},
		dispose() {
			if (disposed) return;

			disposed = true;
			ui.run(disposeTextRewrites, stateKey);
			rules.clear();
			images.clear();
			hosts.clear();
		},
	};
}

export default { connectTextRewrites, supportsTextRewrites };
