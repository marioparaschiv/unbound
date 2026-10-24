import type { AnyProps } from '@unbound-app/api/metro';
import type { patcher } from '@unbound-app/api';

import { findRenderTarget } from '../react/render-target';
import { whenLoaded } from '../metro/when-loaded';

type Cleanup = () => void;
type Patcher = ReturnType<typeof patcher.createPatcher>;

const DIRECT_SHEETS: readonly (readonly [path: string, key: string])[] = [
	[
		'modules/messages/native/long_press/LongPressMessageActionSheet.tsx',
		'MessageLongPressActionSheet',
	],
];

// UNKNOWN: an action sheet may render any node.
export type SheetRender = (result: unknown) => unknown;

export type ActionSheetHost<P> = {
	// UNKNOWN: Discord passes the key untyped; the patch checks it is a string.
	openLazy: (sheet?: Promise<AnyProps | undefined>, key?: unknown, props?: P) => void;
	hideActionSheet: (key: string) => void;
};

/**
 * @description Lets a plugin change the action sheets Discord opens through `openLazy`, and the sheets it opens without it, such as Android's message long-press sheet, patching each sheet component once.
 * @template P The sheet props the plugin reads.
 * @param Patcher The plugin's patcher.
 * @param ActionSheets Discord's action sheet module.
 * @param onOpen Runs on every opened sheet and returns the render patch for its component, or `undefined` to leave it alone.
 * @returns A function that removes every patch and ignores sheets that finish loading afterwards.
 */
export function patchLazySheets<P>(
	Patcher: Patcher,
	ActionSheets: ActionSheetHost<P>,
	onOpen: (key: string, props: P) => SheetRender | undefined,
): Cleanup {
	const patchedModules = new WeakSet<AnyProps>();
	const unpatches: Cleanup[] = [];

	let disposed = false;

	function patchModule(module: AnyProps | undefined, render: SheetRender) {
		if (disposed || !module || patchedModules.has(module)) return;

		patchedModules.add(module);

		const target = findRenderTarget(module);

		if (!target) return;

		unpatches.push(Patcher.after(target.holder, target.key, ({ result }) => render(result)));
	}

	for (const [path, key] of DIRECT_SHEETS) {
		unpatches.push(
			whenLoaded<AnyProps>(path, (module) => {
				const target = findRenderTarget(module);

				if (disposed || !target || patchedModules.has(module)) return;

				patchedModules.add(module);

				return Patcher.after(target.holder, target.key, ({ args: [props], result }) => {
					const render = props ? onOpen(key, props as P) : undefined;

					return render ? render(result) : result;
				});
			}),
		);
	}

	unpatches.push(
		Patcher.before(ActionSheets, 'openLazy', ({ args: [sheet, key, props] }) => {
			if (typeof key !== 'string' || !sheet?.then || !props) return;

			const render = onOpen(key, props);

			if (!render) return;

			// Discord surfaces a sheet that fails to load; the plugin only skips patching it.
			sheet.then((module) => patchModule(module, render)).catch(() => undefined);
		}),
	);

	return () => {
		disposed = true;

		for (const unpatch of unpatches.splice(0)) unpatch();
	};
}

export default patchLazySheets;
