import type {
	NativeFabricBridge,
	NativeFabricSurface,
	NativeJavaBridge,
	NativeJavaHandle,
	NativeJavaHooksBridge,
	NativeJavaReference,
} from '@unbound-app/api/native';

import {
	connectTextRewrites,
	TEXT_REWRITES_CLASS,
	type TextRewriteAnchor,
	type TextRewriteEdit,
	type TextRewrites,
} from './text-rewrites';
import { javaReference, javaText } from './java-values';

const NEEDS_HOST_PARAMETERS = ['android.widget.TextView', 'java.lang.String'];
const MAX_GROUPS_PER_TEXT = 4;
const INITIAL_GROUPS = 2;
const MAX_DEFINITIONS = 48;

export type InlineSlot = TextRewriteAnchor & {
	surfaceId: string;
};

export type InlineDefinition = {
	original: string;
	rendered: string;
	edits: TextRewriteEdit[];
	slots: InlineSlot[];
	textView: NativeJavaReference;
};

type Group = {
	id: string;
	hosts: NativeJavaHandle[];
	mounts: Promise<NativeFabricSurface | null>[];
};

type Entry = InlineDefinition & {
	groups: Group[];
};

export type InlineSurfaces = {
	define(definition: InlineDefinition): void;
	isDefined(rendered: string): boolean;
	definitions(): InlineDefinition[];
	dispose(): Promise<void>;
};

export type InlineSurfaceNative = {
	java: NativeJavaBridge;
	hooks: NativeJavaHooksBridge;
	fabric: NativeFabricBridge;
};

export type InlineSurfaceOptions = {
	watchedClass: string;
	surfaceModule: string;
	groupPrefix: string;
};

function anchorOf(slot: InlineSlot): TextRewriteAnchor {
	return {
		placeholder: slot.placeholder,
		width: slot.width,
		height: slot.height,
		pinTop: slot.pinTop,
		offsetY: slot.offsetY,
	};
}

function sameAnchors(left: InlineSlot[], right: InlineSlot[]): boolean {
	return (
		left.length === right.length &&
		left.every((slot, index) => JSON.stringify(slot) === JSON.stringify(right[index]))
	);
}

/**
 * @description Shows React surfaces inside reserved room in Discord's Android message text through the loader's native text rewrites. Each rendered text gets groups of mounted hosts that the loader moves into whichever chat row shows that text, while Discord binds the row, so cards and embeds stay in place while the chat scrolls.
 * @param native The plugin's Java, hook and Fabric bridges.
 * @param options The text view class to rewrite, the registered surface to mount, and a prefix for group IDs.
 * @returns The inline surfaces, or `null` when the installed loader has no native text rewrites.
 */
export function createInlineSurfaces(
	native: InlineSurfaceNative,
	options: InlineSurfaceOptions,
): InlineSurfaces | null {
	const { java, hooks, fabric } = native;
	const rewrites: TextRewrites | null = connectTextRewrites(java, options.watchedClass);

	if (!rewrites) return null;

	const active = rewrites;
	const entries = new Map<string, Entry>();
	let nextGroup = 0;
	let disposed = false;

	function createGroup(entry: Entry) {
		if (disposed || entry.groups.length >= MAX_GROUPS_PER_TEXT) return;

		const context = javaReference(java.invoke(entry.textView, 'getContext', []));
		const group: Group = { id: `${options.groupPrefix}-${nextGroup++}`, hosts: [], mounts: [] };

		for (const [index, slot] of entry.slots.entries()) {
			const host = java.construct('android.widget.FrameLayout', context ? [context] : []);
			const mount = fabric
				.mountAsync(host, options.surfaceModule, { surfaceId: slot.surfaceId })
				.catch(() => null);

			group.hosts.push(host);
			group.mounts.push(mount);
			void mount.then(() => {
				const current = entry.slots[index];

				if (!disposed && current && entry.groups.includes(group)) {
					active.addHost(group.id, entry.rendered, host, anchorOf(current));
				}
			});
		}

		entry.groups.push(group);
	}

	async function removeGroup(group: Group) {
		active.removeGroup(group.id);

		for (const mount of group.mounts) {
			const surface = await mount;

			if (surface) {
				await fabric.unmountAsync(surface).catch(() => undefined);
			}
		}
	}

	function evict(entry: Entry) {
		entries.delete(entry.rendered);
		active.remove(entry.original);

		for (const group of entry.groups) void removeGroup(group);
	}

	const token = hooks.hook(
		TEXT_REWRITES_CLASS,
		'needsHost',
		NEEDS_HOST_PARAMETERS,
		{ notify: true },
		({ args }) => {
			const rendered = javaText(args[1]);
			const entry = rendered ? entries.get(rendered) : undefined;

			if (entry) {
				createGroup(entry);
			}
		},
	);

	return {
		define(definition) {
			if (disposed) return;

			const existing = entries.get(definition.rendered);

			active.put(definition.original, definition.rendered, definition.edits);

			if (existing) {
				const resized = !sameAnchors(existing.slots, definition.slots);

				Object.assign(existing, definition);
				entries.delete(definition.rendered);
				entries.set(definition.rendered, existing);

				if (resized) {
					for (const group of existing.groups) {
						for (const [index, host] of group.hosts.entries()) {
							const slot = definition.slots[index];

							if (slot) {
								active.updateAnchor(host, anchorOf(slot));
							}
						}
					}

					active.refresh(definition.rendered);
				}

				active.reapply(definition.textView);

				return;
			}

			const entry: Entry = { ...definition, groups: [] };

			entries.set(definition.rendered, entry);

			if (entries.size > MAX_DEFINITIONS) {
				evict(entries.values().next().value!);
			}

			for (let index = 0; index < INITIAL_GROUPS; index++) createGroup(entry);

			active.reapply(definition.textView);
		},
		isDefined: (rendered) => entries.has(rendered),
		definitions: () => [...entries.values()],
		async dispose() {
			disposed = true;
			hooks.remove(token);

			const groups = [...entries.values()].flatMap((entry) => {
				active.remove(entry.original);

				return entry.groups;
			});

			entries.clear();
			active.refreshAll();
			await Promise.all(groups.map(removeGroup));
		},
	};
}

export default { createInlineSurfaces };
