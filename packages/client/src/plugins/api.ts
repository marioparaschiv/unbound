import type { AddonHandle, PushedManifest } from '@unbound-app/types';

import type { ReloadResult } from '~/addons/addons';
import { apply, check } from '~/updates/api';
import { plugins } from '~/plugins/manager';

/** Lists every installed plugin. */
export const getAll: () => AddonHandle[] = plugins.getEntities.bind(plugins);
/** Reads one installed plugin by id. */
export const get: (id: string) => AddonHandle | undefined = plugins.getEntity.bind(plugins);
/** Reports whether a plugin is enabled. */
export const isEnabled: (id: string) => boolean = plugins.isEnabled.bind(plugins);
/** Enables a plugin and starts it. */
export const enable: (id: string) => void | Promise<void> = plugins.enable.bind(plugins);
/** Disables a plugin and stops it. */
export const disable: (id: string) => void = plugins.disable.bind(plugins);
/** Enables a disabled plugin, or disables an enabled one. */
export const toggle: (id: string) => void = plugins.toggle.bind(plugins);
/** Installs a plugin from its manifest URL. */
export const install: (url: string, digest?: string) => Promise<AddonHandle | undefined> =
	plugins.install.bind(plugins);
/** Stops and removes an installed plugin. */
export const uninstall: (id: string) => Promise<void> = plugins.delete.bind(plugins);
/** Swaps a plugin's bundle in place, keeping its enabled state. */
export const reload: (
	id: string,
	bundle: string,
	manifest: PushedManifest,
	bytecode?: string,
) => Promise<ReloadResult> = plugins.reload.bind(plugins);

/**
 * @description Checks for updates, then applies this plugin's pending update.
 * @param id The plugin's id.
 * @returns Whether the plugin now runs a newer version.
 */
export async function update(id: string): Promise<boolean> {
	await check();

	return apply(id);
}

/** Every installed plugin, keyed by id. */
export const entities: ReadonlyMap<PropertyKey, AddonHandle> = plugins.entities;
/** The error each plugin that failed to load or start threw, keyed by id. */
export const errors: ReadonlyMap<PropertyKey, Error> = plugins.errors;
/** Starts a plugin without changing its enabled state. */
export const start: (id: string) => void | Promise<void> = plugins.start.bind(plugins);
/** Stops a running plugin without changing its enabled state. */
export const stop: (id: string) => void | Promise<void> = plugins.stop.bind(plugins);
