import { createElement, useEffect, useState } from 'react';

import type { SettingsPayload } from '../src/storage';
import type { MemoryStorage } from './memory-storage';
import type { FakeModule } from './fake-metro';

/**
 * One node of a settings schema, as `@unbound-app/settings/schema`'s builders produce it once read as JSON. The
 * options a builder copies that only the panel reads, such as `placeholder` or `run`, stay untyped.
 */
export type SchemaNode = FakeModule & {
	kind: string;
	displayAs?: string;
	title?: string;
	default?: SettingValue;
	minimum?: number;
	maximum?: number;
	multipleOf?: number;
	minLength?: number;
	maxLength?: number;
	alpha?: boolean;
	minItems?: number;
	maxItems?: number;
	options?: SchemaChoice[];
	of?: SchemaNode;
	properties?: Record<string, SchemaNode>;
};

/** One option of a choice setting. */
export type SchemaChoice = { const: string; title?: string };

/** What `defineSettings` takes besides the settings. */
export type DefineOptions = { title?: string };

/** What `defineSettings` returns: the schema of a plugin's settings.ts. */
export type SettingsSchema = SchemaNode & {
	kind: 'settings';
	properties: Record<string, SchemaNode>;
};

/** A value one setting holds. */
export type SettingValue = string | number | boolean | string[];

/** A plugin's settings as an object: reads apply defaults, writes are validated and saved. Sections nest. */
export type SettingsValues = { [key: string]: SettingValue | SettingsValues };

/** The fake `@unbound-app/settings`, bound to a memory Bucket. */
export type FakeSettings = {
	schema: SettingsSchema;
	settings: SettingsValues;
	/** Reads a setting, a section, or a section's setting by dot-separated key, and re-renders when it changes. */
	useSetting: (key: string) => SettingValue | SettingsValues;
	/** Puts every setting back to its default. */
	resetSettings: () => void;
	/** Saves a setting by dot-separated key; throws when the schema rejects the value. */
	set: (key: string, value: SettingValue) => void;
	SettingsPanel: () => ReturnType<typeof createElement>;
	getSettingsPanel: () => ReturnType<typeof createElement>;
};

/** A builder's options: the plugin's generated typings check them; here they are read as plain JSON. */
type Options = FakeModule;

const COMMON = ['title', 'subtitle', 'hidden', 'requiresRestart'];
const CONDITIONS = ['visibleWhen', 'disabledWhen'];
const STRING = ['minLength', 'maxLength', 'placeholder', 'alpha', 'presets', 'palette', 'maxSize'];

// Mirrors the build's builders: the JSON keeps these options, and a predicate becomes `{ predicate: true }`.
function meta(kind: string, displayAs: string, options: Options, keys: string[] = []): SchemaNode {
	const picked: SchemaNode = { kind, displayAs };

	for (const key of [...COMMON, ...keys, 'default']) {
		if (options[key] !== undefined) {
			picked[key] = options[key];
		}
	}

	for (const key of CONDITIONS) {
		const condition = options[key];

		if (condition !== undefined) {
			picked[key] = typeof condition === 'function' ? { predicate: true } : condition;
		}
	}

	return picked;
}

function numeric(kind: string, options: Options): SchemaNode {
	const ranged = options.min !== undefined && options.max !== undefined;

	return {
		...meta(kind, options.displayAs ?? (ranged ? 'slider' : 'input'), options, ['units']),
		...(typeof options.min === 'number' ? { minimum: options.min } : {}),
		...(typeof options.max === 'number' ? { maximum: options.max } : {}),
		...(typeof options.step === 'number' ? { multipleOf: options.step } : {}),
	};
}

function choices(options: Options): SchemaChoice[] {
	const labels: Options =
		typeof options.options === 'object' && options.options ? options.options : {};
	const entries = Object.entries(labels);

	return entries.map(([value, label]) =>
		typeof label === 'string' ? { const: value, title: label } : { const: value, ...label },
	);
}

/** The `setting` builders of `@unbound-app/settings/schema`, one per stored primitive; `displayAs` picks the widget. */
export const setting = createSettingBuilders();

function createSettingBuilders() {
	return {
		boolean: (options: Options = {}) => meta('boolean', options.displayAs ?? 'switch', options),
		number: (options: Options = {}) => numeric('number', options),
		integer: (options: Options = {}) => numeric('integer', options),
		string: (options: Options = {}) =>
			meta('string', options.displayAs ?? 'input', options, STRING),
		choice(options: Options = {}): SchemaNode {
			const list = choices(options);
			const displayAs = options.displayAs ?? (list.length > 5 ? 'picker' : 'radio');

			return { ...meta('choice', displayAs, options), options: list };
		},
		array(options: Options = {}): SchemaNode {
			const of: Options =
				typeof options.of === 'object' && options.of ? { ...options.of } : {};
			const displayAs = options.displayAs ?? (of.kind === 'choice' ? 'checkboxes' : 'list');

			delete of.default;

			return {
				...meta('array', displayAs, options, ['minItems', 'maxItems']),
				of: { ...of, kind: String(of.kind) },
			};
		},
		section: (options: Options, properties: Record<string, SchemaNode>): SchemaNode => ({
			...meta('section', options.displayAs ?? 'group', options),
			properties,
		}),
		action: (options: Options) =>
			meta('action', options.displayAs ?? 'button', options, ['run', 'confirm']),
	};
}

/**
 * @description Declares a plugin's settings: the default export of its settings.ts.
 * @param properties The settings, sections and actions, built with {@link setting}.
 * @param options The message key of the title of the section holding the top-level settings.
 * @returns The schema.
 */
export function defineSettings(
	properties: Record<string, SchemaNode>,
	options: DefineOptions = {},
): SettingsSchema {
	return {
		kind: 'settings',
		...(options.title === undefined ? {} : { title: options.title }),
		properties,
	};
}

function isMultiple(value: number, step: number): boolean {
	const ratio = value / step;

	return Math.abs(ratio - Math.round(ratio)) < 1e-9;
}

// Mirrors the client's `isSettingValue` for the checks a test can trip: the primitive, its range and its length.
function isValue(field: SchemaNode, value: unknown): value is SettingValue {
	switch (field.kind) {
		case 'boolean':
			return typeof value === 'boolean';
		case 'string':
			return (
				typeof value === 'string' &&
				value.length >= (field.minLength ?? 0) &&
				value.length <= (field.maxLength ?? Infinity)
			);
		case 'choice':
			return (field.options ?? []).some((choice) => choice.const === value);
		case 'array':
			return (
				Array.isArray(value) &&
				value.length >= (field.minItems ?? 0) &&
				value.length <= (field.maxItems ?? Infinity) &&
				new Set(value).size === value.length &&
				value.every((item) => !field.of || isValue(field.of, item))
			);
		default:
			return (
				typeof value === 'number' &&
				Number.isFinite(value) &&
				(field.kind !== 'integer' || Number.isInteger(value)) &&
				value >= (field.minimum ?? -Infinity) &&
				value <= (field.maximum ?? Infinity) &&
				(field.multipleOf === undefined || isMultiple(value, field.multipleOf))
			);
	}
}

// A setting whose builder took no default, such as an entity picker, reads empty.
function emptyValue(field: SchemaNode): SettingValue {
	switch (field.kind) {
		case 'boolean':
			return false;
		case 'string':
			return '';
		case 'choice':
			return field.options?.[0]?.const ?? '';
		case 'array':
			return [];
		default:
			return 0;
	}
}

function entries(schema: SettingsSchema): [string, SchemaNode][] {
	return Object.entries(schema.properties)
		.flatMap(([key, node]): [string, SchemaNode][] =>
			node.kind === 'section'
				? Object.entries(node.properties ?? {}).map(([child, field]) => [
						`${key}.${child}`,
						field,
					])
				: [[key, node]],
		)
		.filter(([, field]) => field.kind !== 'action');
}

function affects(payload: SettingsPayload, key: string): boolean {
	return (
		payload.key === null ||
		payload.key === key ||
		key.startsWith(`${payload.key}.`) ||
		payload.key.startsWith(`${key}.`)
	);
}

/**
 * @description Binds a settings schema to a memory Bucket, as the client's `storage.define` does: defaults apply on
 * read, and each write is checked against the schema.
 * @param schema The schema settings.ts evaluated to.
 * @param storage The memory storage holding the Bucket.
 * @param bucketName The Bucket, the plugin's id.
 * @returns The settings, their hook, reset and panel.
 */
export function createFakeSettings(
	schema: SettingsSchema,
	storage: MemoryStorage,
	bucketName: string,
): FakeSettings {
	const bucket = storage.getBucket(bucketName);
	const fields = new Map(entries(schema));

	function field(key: string): SchemaNode {
		const found = fields.get(key);

		if (!found) {
			throw new TypeError(`Failed to find setting ${key}: it is not in the schema.`);
		}

		return found;
	}

	function get(key: string): SettingValue {
		const setting = field(key);
		const stored = bucket.get<unknown>(key, undefined);

		return isValue(setting, stored) ? stored : (setting.default ?? emptyValue(setting));
	}

	function set(key: string, value: SettingValue) {
		if (!isValue(field(key), value)) {
			throw new TypeError(
				`Failed to set setting ${key}: ${JSON.stringify(value)} does not match its schema.`,
			);
		}

		bucket.set(key, value);
	}

	function view(prefix: string, properties: Record<string, SchemaNode>): SettingsValues {
		const sections = new Map<string, SettingsValues>();
		const pathOf = (key: PropertyKey) => (prefix ? `${prefix}.${String(key)}` : String(key));
		const owns = (key: PropertyKey) =>
			typeof key === 'string' && Object.hasOwn(properties, key);

		function read(key: string) {
			const node = properties[key];

			if (node?.kind !== 'section') {
				return get(pathOf(key));
			}

			let section = sections.get(key);

			if (!section) {
				section = view(pathOf(key), node.properties ?? {});
				sections.set(key, section);
			}

			return section;
		}

		return new Proxy<SettingsValues>(
			{},
			{
				get: (_target, key) => (owns(key) ? read(String(key)) : undefined),
				set(_target, key, value: SettingValue) {
					const node = typeof key === 'string' ? properties[key] : undefined;

					if (!node || node.kind === 'section') {
						throw new TypeError(
							`Failed to set setting ${pathOf(key)}: it is not a setting.`,
						);
					}

					set(pathOf(key), value);

					return true;
				},
				has: (_target, key) => owns(key),
				ownKeys: () => Object.keys(properties),
				getOwnPropertyDescriptor: (_target, key) =>
					owns(key)
						? {
								value: read(String(key)),
								writable: true,
								enumerable: true,
								configurable: true,
							}
						: undefined,
			},
		);
	}

	const values = view('', schema.properties);

	function read(key: string): SettingValue | SettingsValues {
		if (fields.has(key)) {
			return get(key);
		}

		const section = values[key];

		if (section === undefined) {
			throw new TypeError(`Failed to find setting ${key}: it is not in the schema.`);
		}

		return section;
	}

	function SettingsPanel() {
		return createElement('SettingsPanel', { schema });
	}

	return {
		schema,
		settings: values,
		set,
		useSetting(key) {
			const [, forceUpdate] = useState({});

			useEffect(
				() =>
					storage.onChange(
						(payload) => payload.store === bucketName && affects(payload, key),
						() => forceUpdate({}),
					),
				[key],
			);

			return read(key);
		},
		resetSettings() {
			for (const key of fields.keys()) bucket.remove(key);
		},
		SettingsPanel,
		getSettingsPanel: () => createElement(SettingsPanel),
	};
}
