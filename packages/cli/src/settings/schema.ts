// Behind `@unbound-app/settings/schema`: runs only while the build evaluates settings.ts. Generated typings type each option.
import Type, { type TSchema, type TSchemaOptions } from 'typebox';
import type { SettingValue } from '@unbound-app/types/settings';

type OptionLabel = string | { title: string; subtitle?: string };

/** A settings.ts predicate: it reads every setting and says whether a row shows or is enabled. */
type Predicate = (settings: never) => boolean;

/** Every builder's options; the generated typings narrow them per builder and `displayAs`. */
export type BuilderOptions = {
	title?: string;
	subtitle?: string;
	hidden?: boolean;
	requiresRestart?: boolean;
	visibleWhen?: string | Predicate;
	disabledWhen?: string | Predicate;
	displayAs?: string;
	default?: SettingValue;
	min?: number;
	max?: number;
	step?: number;
	units?: string[];
	minLength?: number;
	maxLength?: number;
	placeholder?: string;
	alpha?: boolean;
	presets?: string[];
	palette?: boolean;
	maxSize?: number;
	options?: Record<string, OptionLabel>;
	of?: TSchema;
	minItems?: number;
	maxItems?: number;
	action?: string;
	confirm?: string;
	tone?: string;
};

/** The options of `defineSettings`. */
export type DefineOptions = { title?: string };

function defined(values: TSchemaOptions): TSchemaOptions {
	return Object.fromEntries(Object.entries(values).filter(([, value]) => value !== undefined));
}

// A predicate cannot be JSON: the build lifts its source out of settings.ts, and the JSON only marks it.
function condition(value: string | Predicate | undefined) {
	return typeof value === 'function' ? { predicate: true } : value;
}

function meta(
	kind: string,
	displayAs: string,
	options: BuilderOptions,
	extra: TSchemaOptions = {},
): TSchemaOptions {
	return {
		kind,
		displayAs,
		...defined({
			title: options.title,
			subtitle: options.subtitle,
			hidden: options.hidden,
			requiresRestart: options.requiresRestart,
			visibleWhen: condition(options.visibleWhen),
			disabledWhen: condition(options.disabledWhen),
			default: options.default,
			...extra,
		}),
	};
}

function numeric(kind: string, options: BuilderOptions): TSchemaOptions {
	const ranged = options.min !== undefined && options.max !== undefined;

	return meta(kind, options.displayAs ?? (ranged ? 'slider' : 'input'), options, {
		minimum: options.min,
		maximum: options.max,
		multipleOf: options.step,
		units: options.units,
	});
}

function choices({ options = {} }: BuilderOptions) {
	return Object.entries(options).map(([value, label]) =>
		typeof label === 'string' ? { const: value, title: label } : { const: value, ...label },
	);
}

/**
 * @description Builds a `boolean` setting.
 * @param options Its labels, default and display.
 * @returns Its schema.
 */
function boolean(options: BuilderOptions): TSchema {
	return Type.Boolean(meta('boolean', options.displayAs ?? 'switch', options));
}

/**
 * @description Builds a `number` setting.
 * @param options Its labels, default, range and display.
 * @returns Its schema.
 */
function number(options: BuilderOptions): TSchema {
	return Type.Number(numeric('number', options));
}

/**
 * @description Builds a whole-number setting.
 * @param options Its labels, default, range and display.
 * @returns Its schema.
 */
function integer(options: BuilderOptions): TSchema {
	return Type.Integer(numeric('integer', options));
}

/**
 * @description Builds a `string` setting, or with no options an `array` item.
 * @param options Its labels, default, display and the display's options.
 * @returns Its schema.
 */
function string(options: BuilderOptions = {}): TSchema {
	return Type.String(
		meta(
			'string',
			options.displayAs ?? 'input',
			{ default: '', ...options },
			{
				minLength: options.minLength,
				maxLength: options.maxLength,
				placeholder: options.placeholder,
				alpha: options.alpha,
				presets: options.presets,
				palette: options.palette,
				maxSize: options.maxSize,
			},
		),
	);
}

/**
 * @description Builds a setting holding one of its options' keys, or with only `options` an `array` item.
 * @param options Its labels, default, options and display.
 * @returns Its schema.
 */
function choice(options: BuilderOptions): TSchema {
	const list = choices(options);
	// Up to five options read best as a radio group; more fit a sheet.
	const displayAs = options.displayAs ?? (list.length > 5 ? 'picker' : 'radio');

	return Type.Union(
		list.map((option) => Type.Literal(option.const)),
		meta('choice', displayAs, options, { options: list }),
	);
}

/**
 * @description Builds a list setting of `of` items.
 * @param options Its labels, item, limits and display.
 * @returns Its schema.
 */
function array(options: BuilderOptions): TSchema {
	// The item's own default means nothing inside a list.
	const item = Object.fromEntries(
		Object.entries(options.of ?? {}).filter(([key]) => key !== 'default'),
	);
	const displayAs = options.displayAs ?? (item.kind === 'choice' ? 'checkboxes' : 'list');

	return Type.Array(
		Type.Unknown(),
		meta(
			'array',
			displayAs,
			{ default: [], ...options },
			{
				minItems: options.minItems,
				maxItems: options.maxItems,
				of: item,
			},
		),
	);
}

/**
 * @description Builds a section of settings.
 * @param options Its labels and display.
 * @param properties Its settings and buttons.
 * @returns Its schema.
 */
function section(options: BuilderOptions, properties: Record<string, TSchema>): TSchema {
	return Type.Object(properties, meta('section', options.displayAs ?? 'group', options));
}

/**
 * @description Builds a button row that runs an export of src/actions.ts; it stores nothing.
 * @param options Its labels, action, confirmation and display.
 * @returns Its schema.
 */
function button(options: BuilderOptions): TSchema {
	return Type.Null(
		meta('button', options.displayAs ?? 'button', options, {
			action: options.action,
			confirm: options.confirm,
		}),
	);
}

/**
 * @description Builds a notice row that shows a message in its panel; it stores nothing.
 * @param options Its labels, tone and `visibleWhen`.
 * @returns Its schema.
 */
function notice(options: BuilderOptions): TSchema {
	return Type.Null(meta('notice', 'notice', options, { tone: options.tone ?? 'info' }));
}

/** The setting builders, one per stored primitive; `displayAs` picks the widget. */
export const setting = { boolean, number, integer, string, choice, array, section, button, notice };

/**
 * @description Declares a plugin's settings: the default export of its settings.ts.
 * @param properties The settings, sections and buttons, built with {@link setting}.
 * @param options The message key of the title of the section holding the top-level settings.
 * @returns The TypeBox object schema, marked as a settings schema.
 */
export function defineSettings(
	properties: Record<string, TSchema>,
	options: DefineOptions = {},
): TSchema {
	return Type.Object(properties, defined({ kind: 'settings', title: options.title }));
}

export default { defineSettings, setting };
