import type {
	SettingSchema,
	SettingsSchema,
	SettingsValue,
	SettingValue,
} from '@unbound-app/types/settings';
import {
	isSettingsGroup,
	isSettingValue,
	settingEntries,
} from '@unbound-app/contracts/settings-schema';
import { createLogger } from '@unbound-app/logger';
import { useEffect, useState } from 'react';

import type { Bucket, SettingsPayload } from '~/storage/api';

const logger = createLogger('Storage', 'Define');

/** A plugin's settings as an object: reads apply defaults, writes are validated and saved. Sections are nested objects. */
export type SettingsValues = { [key: string]: SettingValue | SettingsValues };

/** What reading a key gives: a setting's value, or a section's values. */
export type SettingRead = SettingValue | SettingsValues;

/** What `storage.define` returns: a schema's settings, bound to one Bucket. */
export type DefinedSettings = {
	/** The schema the settings were defined with. */
	schema: SettingsSchema;
	/** The settings as an object; assign a property, a section's too, to save it. */
	values: SettingsValues;
	/** Reads a setting by its dot-separated key; a stored value the schema rejects is logged, removed and read as the default. */
	get: (key: string) => SettingValue;
	/** Saves a setting by its dot-separated key; throws when the schema rejects the value. */
	set: (key: string, value: SettingValue) => void;
	/** Puts every setting back to its default, leaving other keys of the Bucket alone. */
	reset: () => void;
	/** React hook that reads a setting, or a section as an object, and re-renders when it changes. */
	useSetting: (key: string) => SettingValue | SettingsValues;
	/** React hook that re-renders on any change to the settings while `enabled`, and returns a number that changes with them. */
	useVersion: (enabled?: boolean) => number;
};

/** Subscribes to the changes of the settings' Bucket; returns the unsubscribe. */
export type BucketSubscribe = (callback: (payload: SettingsPayload) => void) => () => void;

/**
 * @description Tells whether a change of the Bucket reaches a key: the key itself, a section holding it, or a setting inside it.
 * @param payload The change.
 * @param key A dot-separated setting or section key.
 * @returns Whether it does.
 */
export function affects(payload: SettingsPayload, key: string): boolean {
	return (
		payload.key === null ||
		payload.key === key ||
		key.startsWith(`${payload.key}.`) ||
		payload.key.startsWith(`${key}.`)
	);
}

// A secret's value never reaches a log or an error.
function shown(setting: SettingSchema, value: SettingsValue | undefined): string {
	return setting.kind === 'string' && setting.displayAs === 'secret'
		? 'the secret'
		: JSON.stringify(value);
}

function shallowEqual(left: SettingRead, right: SettingRead): boolean {
	if (Object.is(left, right)) {
		return true;
	}

	if (typeof left !== 'object' || typeof right !== 'object' || !left || !right) {
		return false;
	}

	const keys = Object.keys(left);

	return (
		keys.length === Object.keys(right).length &&
		keys.every((key) => Object.is(Reflect.get(left, key), Reflect.get(right, key)))
	);
}

/**
 * @description Binds a settings schema to a Bucket: defaults apply on read, and each write is checked against the schema.
 * @param schema The settings schema, the JSON a plugin's settings.ts evaluates to.
 * @param bucket The Bucket the settings are saved in.
 * @param subscribe Listens to the Bucket's changes, for the hooks.
 * @returns The settings.
 */
export function createDefinedSettings(
	schema: SettingsSchema,
	bucket: Bucket,
	subscribe: BucketSubscribe,
): DefinedSettings {
	const fields = new Map<string, SettingSchema>(
		settingEntries(schema).map(({ path, field }) => [path, field]),
	);
	const sections = new Map(
		Object.entries(schema.properties).flatMap(([key, node]) =>
			isSettingsGroup(node) ? [[key, node] as const] : [],
		),
	);
	const reported = new Set<string>();

	function field(key: string): SettingSchema {
		const found = fields.get(key);

		if (!found) {
			throw new TypeError(`Failed to find setting ${key}: it is not in the schema.`);
		}

		return found;
	}

	function get(key: string): SettingValue {
		const setting = field(key);
		const stored = bucket.get<SettingsValue | undefined>(key, undefined);

		if (stored === undefined) {
			return setting.default;
		}

		if (isSettingValue(setting, stored)) {
			return stored;
		}

		if (!reported.has(key)) {
			reported.add(key);
			logger.error(
				`Failed to read setting ${key}: ${shown(setting, stored)} does not match its schema, so it is reset.`,
			);
		}

		bucket.remove(key);

		return setting.default;
	}

	function set(key: string, value: SettingValue) {
		const setting = field(key);

		if (!isSettingValue(setting, value)) {
			throw new TypeError(
				`Failed to set setting ${key}: ${shown(setting, value)} does not match its schema.`,
			);
		}

		bucket.set(key, value);
	}

	function reset() {
		for (const key of fields.keys()) bucket.remove(key);
	}

	function read(key: string): SettingValue | SettingsValues {
		const section = sections.get(key);

		if (!section) {
			return get(key);
		}

		// A snapshot, so a component holding it sees a stable object until a field changes.
		return Object.fromEntries(
			Object.keys(section.properties).flatMap((child) =>
				fields.has(`${key}.${child}`) ? [[child, get(`${key}.${child}`)]] : [],
			),
		);
	}

	function useSetting(key: string): SettingValue | SettingsValues {
		const [value, setValue] = useState(() => read(key));

		useEffect(
			() =>
				subscribe((payload) => {
					if (!affects(payload, key)) return;

					const next = read(key);

					setValue((previous) => (shallowEqual(previous, next) ? previous : next));
				}),
			[key],
		);

		return value;
	}

	function useVersion(enabled = true): number {
		const [version, setVersion] = useState(0);

		useEffect(
			() => (enabled ? subscribe(() => setVersion((previous) => previous + 1)) : undefined),
			[enabled],
		);

		return version;
	}

	function view(prefix: string, properties: SettingsSchema['properties']): SettingsValues {
		const views = new Map<string, SettingsValues>();
		const pathOf = (key: string) => (prefix ? `${prefix}.${key}` : key);
		const stored = (key: PropertyKey): key is string =>
			typeof key === 'string' && fields.has(pathOf(key));

		function readProperty(key: string): SettingValue | SettingsValues | undefined {
			const node = properties[key];

			if (!node || !isSettingsGroup(node)) {
				return stored(key) ? get(pathOf(key)) : undefined;
			}

			let section = views.get(key);

			if (!section) {
				section = view(pathOf(key), node.properties);
				views.set(key, section);
			}

			return section;
		}

		const keys = () =>
			Object.keys(properties).filter((key) => stored(key) || sections.has(pathOf(key)));

		return new Proxy<SettingsValues>(
			{},
			{
				get: (_target, key) => (typeof key === 'string' ? readProperty(key) : undefined),
				set(_target, key, value) {
					if (!stored(key)) {
						throw new TypeError(
							`Failed to set setting ${pathOf(String(key))}: it is not a setting.`,
						);
					}

					set(pathOf(key), value);

					return true;
				},
				has: (_target, key) => typeof key === 'string' && keys().includes(key),
				ownKeys: keys,
				getOwnPropertyDescriptor: (_target, key) =>
					typeof key === 'string' && keys().includes(key)
						? {
								value: readProperty(key),
								writable: true,
								enumerable: true,
								configurable: true,
							}
						: undefined,
			},
		);
	}

	return { schema, values: view('', schema.properties), get, set, reset, useSetting, useVersion };
}
