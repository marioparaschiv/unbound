import type { ComponentType } from 'react';

/** The core settings store; each addon's settings store is named after the addon id. */
export const CORE_SETTINGS_STORE = 'unbound';

/** The screen descriptor a settings route entry renders. */
export type SettingsScreen = {
	route: string;
	/** Discord's navigator renders the screen with its own route props, so any component fits. */
	getComponent: () => ComponentType<never>;
};

/** A registered Unbound settings entry, mirroring Discord's `SETTING_RENDERER_CONFIG` route shape. */
export type SettingsEntry = {
	type: 'route';
	key: string;
	useTitle: () => string;
	usePredicate?: () => boolean;
	parent: string | null;
	section?: string;
	excludeFromDisplay?: boolean;
	IconComponent?: ComponentType;
	screen: SettingsScreen;
};

/** A JSON value held in a settings store. */
export type SettingsValue = string | number | boolean | null | SettingsValue[] | SettingsObject;

/** A settings store, or a nested group of settings within one. */
export type SettingsObject = { [key: string]: SettingsValue };
