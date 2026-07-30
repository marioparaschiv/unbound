import type { ToastOptions } from '@unbound-app/types/toasts';
import type { Addon } from '@unbound-app/types';

/**
 * @description Maps a hot-reloaded addon to the toast the person holding the device sees, naming the
 * plugin so it's clear which reload landed.
 * @param entity The addon that reloaded.
 * @returns The toast options to show.
 */
export function reloadToast(entity: Addon): ToastOptions {
	return {
		id: `reload:${entity.id}`,
		title: 'Hot reload',
		content: `Reloaded ${entity.data.name}.`,
	};
}

/**
 * @description Maps a failed hot reload to its toast, naming the plugin and surfacing the error so the
 * developer sees what broke without leaving the device.
 * @param entity The addon that failed to reload.
 * @param error The failure recorded by the manager.
 * @returns The toast options to show.
 */
export function reloadErrorToast(entity: Addon, error: Error): ToastOptions {
	return {
		id: `reload:${entity.id}`,
		title: 'Hot reload failed',
		content: `${entity.data.name} failed to reload: ${error.message}`,
	};
}

export default { reloadToast, reloadErrorToast };
