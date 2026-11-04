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

/** A value one schema-declared setting holds. */
export type SettingPrimitive = string | number | boolean;

/** A value any schema-declared setting holds. */
export type SettingValue = SettingPrimitive | string[];

/**
 * When a row shows or is enabled: a boolean setting's dot-separated key, or a predicate the build lifted
 * out of settings.ts into the plugin bundle, where the panel finds it by the setting's key.
 */
export type SettingCondition = string | { predicate: true };

/** What every setting and section carries. Labels are message keys of the plugin's `i18n/en-US.json`. */
export type SettingCommon = {
	/** The message key of the row's label or the section's title; only a hidden setting may omit it. */
	title?: string;
	/** The message key of the row's sub-label. */
	subtitle?: string;
	/** Stored and typed, but not drawn in the generated panel. */
	hidden?: boolean;
	/** Draws the row only while this holds. */
	visibleWhen?: SettingCondition;
	/** Draws the row disabled while this holds. */
	disabledWhen?: SettingCondition;
	/** Changing the setting shows a hint to restart Discord. */
	requiresRestart?: boolean;
};

/** One option of a `choice` setting. */
export type SettingChoice = {
	/** The value stored when the option is picked. */
	const: string;
	/** The message key of the option's label. */
	title: string;
	/** The message key of the text under the option; only a radio group shows it. */
	subtitle?: string;
};

/** The displays of a `string` setting that pick a Discord entity by its id. */
export type EntityDisplay = 'user' | 'channel' | 'guild' | 'role';

/** How a `string` setting displays; each validates the text its own way. */
export type StringDisplay =
	| 'input'
	| 'multiline'
	| 'secret'
	| 'url'
	| 'color'
	| 'image'
	| 'font'
	| 'emoji'
	| EntityDisplay;

/** A duration's units, smallest first. */
export type DurationUnit = 'ms' | 's' | 'm' | 'h' | 'd';

/** A string setting: the primitive `array` items can be too. */
export type StringSettingSchema = {
	/** Marks a text setting. */
	kind: 'string';
	/** The row that edits the text, and the validation it applies. */
	displayAs: StringDisplay;
	/** The value before the user changes it. */
	default: string;
	/** The fewest characters the text may have. */
	minLength?: number;
	/** The most characters the text may have. */
	maxLength?: number;
	/** The message key of the text shown while the input is empty. */
	placeholder?: string;
	/** `color`: also takes an alpha channel, `#RRGGBBAA`. */
	alpha?: boolean;
	/** `color`: colors offered first. */
	presets?: string[];
	/** `color`: draws `presets` inline instead of a swatch row. */
	palette?: boolean;
	/** `image`: the largest file accepted, in bytes. */
	maxSize?: number;
};

/** A choice setting: one of its options' keys. */
export type ChoiceSettingSchema = {
	/** Marks a setting that stores one of a fixed set of options. */
	kind: 'choice';
	/** Draws the options as a radio group, a picker sheet or a segmented control. */
	displayAs: 'radio' | 'picker' | 'segmented';
	/** The `const` of the option picked before the user changes it. */
	default: string;
	/** The options, in the order they are drawn. */
	options: SettingChoice[];
};

/** One schema-declared setting, by the primitive it stores. */
export type SettingSchema = SettingCommon &
	(
		| { kind: 'boolean'; displayAs: 'switch' | 'checkbox'; default: boolean }
		| {
				kind: 'number' | 'integer';
				displayAs: 'input' | 'slider' | 'stepper' | 'duration';
				/** A `duration` is in milliseconds. */
				default: number;
				minimum?: number;
				maximum?: number;
				/** The slider's or stepper's step; values must be a multiple of it. */
				multipleOf?: number;
				/** `duration`: the units offered. */
				units?: DurationUnit[];
		  }
		| StringSettingSchema
		| ChoiceSettingSchema
		| {
				kind: 'array';
				displayAs: 'list' | 'checkboxes' | EntityDisplay;
				default: string[];
				/** What each item is: a string, or one of a choice's options. */
				of: Omit<StringSettingSchema, 'default'> | Omit<ChoiceSettingSchema, 'default'>;
				minItems?: number;
				maxItems?: number;
		  }
	);

/** A button row: it stores nothing, and calls the export `action` of the plugin's `src/actions.ts`. */
export type ButtonSchema = SettingCommon & {
	kind: 'button';
	displayAs: 'button' | 'danger';
	action: string;
	/** The message key of a confirmation asked before `run`. */
	confirm?: string;
};

/** A nested object: its settings, drawn as their own section titled by `title`. */
export type SettingsGroupSchema = SettingCommon & {
	kind: 'section';
	displayAs: 'group' | 'collapsible';
	properties: Record<string, SettingSchema | ButtonSchema>;
};

/** A plugin's settings schema, the JSON its settings.ts `defineSettings(...)` evaluates to at build time. */
export type SettingsSchema = {
	/** Marks the schema's root. */
	kind: 'settings';
	/** The message key of the title of the section holding the top-level settings. */
	title?: string;
	/** The settings, buttons and sections by key, in the order they are drawn. */
	properties: Record<string, SettingSchema | ButtonSchema | SettingsGroupSchema>;
};
