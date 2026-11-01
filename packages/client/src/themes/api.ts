import type { AddonHandle, PushedManifest } from '@unbound-app/types';

import type { ReloadResult } from '~/addons/addons';
import { apply, check } from '~/updates/api';
import { themes } from '~/themes/manager';

/** Lists every installed theme. */
export const getAll: () => AddonHandle[] = themes.getEntities.bind(themes);
/** Reads one installed theme by id. */
export const get: (id: string) => AddonHandle | undefined = themes.getEntity.bind(themes);
/** Reports whether a theme is enabled. */
export const isEnabled: (id: string) => boolean = themes.isEnabled.bind(themes);
/** Enables a theme and applies it. */
export const enable: (id: string) => void | Promise<void> = themes.enable.bind(themes);
/** Disables a theme and removes it from the app. */
export const disable: (id: string) => void = themes.disable.bind(themes);
/** Enables a disabled theme, or disables an enabled one. */
export const toggle: (id: string) => void = themes.toggle.bind(themes);
/** Installs a theme from its manifest URL. */
export const install: (url: string, digest?: string) => Promise<AddonHandle | undefined> =
	themes.install.bind(themes);
/** Removes an installed theme. */
export const uninstall: (id: string) => Promise<void> = themes.delete.bind(themes);
/** Swaps a theme's files in place, keeping its enabled state. */
export const reload: (
	id: string,
	bundle: string,
	manifest: PushedManifest,
	bytecode?: string,
) => Promise<ReloadResult> = themes.reload.bind(themes);

/**
 * @description Checks for updates, then applies this theme's pending update.
 * @param id The theme's id.
 * @returns Whether the theme now runs a newer version.
 */
export async function update(id: string): Promise<boolean> {
	await check();

	return apply(id);
}
