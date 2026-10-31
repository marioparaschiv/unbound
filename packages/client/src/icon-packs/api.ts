import type { AddonHandle, PushedManifest } from '@unbound-app/types';

import type { ReloadResult } from '~/addons/addons';
import { icons } from '~/icon-packs/manager';
import { apply, check } from '~/updates/api';

/** Lists every installed icon pack. */
export const getAll: () => AddonHandle[] = icons.getEntities.bind(icons);
/** Reads one installed icon pack by id. */
export const get: (id: string) => AddonHandle | undefined = icons.getEntity.bind(icons);
/** Reports whether an icon pack is enabled. */
export const isEnabled: (id: string) => boolean = icons.isEnabled.bind(icons);
/** Enables an icon pack and applies it. */
export const enable: (id: string) => void | Promise<void> = icons.enable.bind(icons);
/** Disables an icon pack and restores the default icons. */
export const disable: (id: string) => void = icons.disable.bind(icons);
/** Enables a disabled icon pack, or disables an enabled one. */
export const toggle: (id: string) => void = icons.toggle.bind(icons);
/** Installs an icon pack from its manifest URL. */
export const install: (url: string, digest?: string) => Promise<AddonHandle | undefined> =
	icons.install.bind(icons);
/** Removes an installed icon pack. */
export const uninstall: (id: string) => Promise<void> = icons.delete.bind(icons);
/** Swaps an icon pack's files in place, keeping its enabled state. */
export const reload: (
	id: string,
	bundle: string,
	manifest: PushedManifest,
	bytecode?: string,
) => Promise<ReloadResult> = icons.reload.bind(icons);

/**
 * @description Checks for updates, then applies this icon pack's pending update.
 * @param id The icon pack's id.
 * @returns Whether the icon pack now runs a newer version.
 */
export async function update(id: string): Promise<boolean> {
	await check();

	return apply(id);
}

/** @deprecated Use getAll */
export const getEntities = getAll;
/** @deprecated Use get */
export const getEntity = get;
/** @deprecated Use uninstall */
const deprecatedDelete = uninstall;

export { deprecatedDelete as delete };
