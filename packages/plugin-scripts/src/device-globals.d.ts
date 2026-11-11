// Device scripts read the generated SDK's `unbound` global, which `@unbound-app/api/global` declares.
import type { AddonHandle, PluginContext } from '@unbound-app/api/global';
import type { ComponentType } from 'react';

declare global {
	/**
	 * What the client's `Addon` gives first-party device tooling beyond {@link AddonHandle}
	 * (`packages/client/src/addons/addon.ts`): the SDK leaves these out so plugins never read them.
	 */
	type DeviceAddon = AddonHandle & {
		/** The bundle source, hashed to tell whether a plugin changed since the last run. */
		readonly bundle: string;
		/** The running plugin's native bridge, which the loader self-test hooks through. */
		readonly context: PluginContext | undefined;
		/** The settings panel the plugin exports, only while it is running. */
		readonly SettingsPanel: ComponentType | undefined;
	};

	type DeviceMessage = {
		id: string;
		content?: string;
		author?: { bot?: boolean };
	};

	function gc(): void;
}

/** The message list the fixture scripts read, which the SDK leaves for plugins to declare. */
type MessageStore = {
	getMessages(channel: string): { toArray?: () => DeviceMessage[] } | undefined;
};

declare module '@unbound-app/api/flux' {
	interface FluxStores {
		Message: MessageStore;
	}
}
