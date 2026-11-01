import type { ComponentType, ReactNode } from 'react';

/** The core settings store; each addon's settings store is named after the addon id. */
export const CORE_SETTINGS_STORE = 'unbound';

/** The screen descriptor a settings route entry renders. */
export type SettingsScreen = {
	/** The navigator route name; Unbound sets it to the entry's `key`. */
	route: string;
	/** Discord's navigator renders the screen with its own route props, so any component fits. */
	getComponent: () => ComponentType<never>;
};

/** A registered Unbound settings entry, mirroring Discord's `SETTING_RENDERER_CONFIG` route shape. */
export type SettingsEntry = {
	/** Always `'route'`: the entry opens its own screen. */
	type: 'route';
	/** Unique id of the entry. Registering an existing key replaces that entry and logs a warning. */
	key: string;
	/** A hook returning the row and screen title. */
	useTitle: () => string;
	/** A hook returning whether Discord shows the row; omitted, it always shows. */
	usePredicate?: () => boolean;
	/** The key of the parent entry; `null` for an entry at the top of the settings overview. */
	parent: string | null;
	/** The label of the overview section the row belongs to; Unbound's own entries use `'Unbound'`. */
	section?: string;
	/** Keeps the route registered but leaves its row out of the settings overview. */
	excludeFromDisplay?: boolean;
	/** The icon drawn at the start of the row. */
	IconComponent?: ComponentType;
	/** A hook returning what the row shows at its end, such as a count. */
	useTrailing?: () => ReactNode;
	/** The screen the row opens. */
	screen: SettingsScreen;
};

/** A JSON value held in a settings store. */
export type SettingsValue = string | number | boolean | null | SettingsValue[] | SettingsObject;

/** A settings store, or a nested group of settings within one. */
export type SettingsObject = { [key: string]: SettingsValue };
