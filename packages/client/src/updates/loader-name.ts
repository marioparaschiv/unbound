import type { InstallKind } from '~/updates/install-kind';
import { messages } from '~/i18n/api';

/**
 * @description Names the loader the way this device installed it: a sideloaded app updates as a whole IPA.
 * @param kind How the loader was installed, if known.
 * @returns The name the updater shows for the loader.
 */
export function loaderName(kind: InstallKind | undefined): string {
	return kind === 'ipa' ? messages.UNBOUND_UPDATES_LOADER_IPA : messages.UNBOUND_UPDATES_LOADER;
}

export default loaderName;
