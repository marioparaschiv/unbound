import type {
	ButtonSchema,
	NoticeSchema,
	StorelessSchema,
	SettingsObject,
	SettingsValue,
	EntityDisplay,
	SettingSchema,
	SettingsGroupSchema,
	SettingsSchema,
	SettingValue,
	StringSettingSchema,
} from '@unbound-app/types/settings';

/** One setting of a schema, at its dot-separated Bucket key. */
export type SettingEntry = { path: string; field: SettingSchema };

/** One problem with a settings schema, at a dot-separated property path (empty at the root). */
export type SettingsIssue = { path: string; problem: string; fix: string };

/** What {@link readSettingsSchema} found: the supported part of the schema, and every problem. */
export type SettingsSchemaResult = { schema: SettingsSchema; issues: SettingsIssue[] };

type ArrayKind = { kind: 'array' };

type ArraySchema = Extract<SettingSchema, ArrayKind>;

// What a value is checked against: a whole setting, or an array's `of`.
type Item = SettingSchema | ArraySchema['of'];

// The schema arrives as JSON evaluated from a plugin's settings.ts.
type JsonObject = SettingsObject;

type JsonValue = SettingsValue | undefined;

type Spec = { displays: string[]; keys: string[] };

const BUILDERS =
	"setting.boolean/number/integer/string/choice/array/section/button/notice from '@unbound-app/settings/schema'";
const ENTITIES = ['user', 'channel', 'guild', 'role'];
const COMMON = [
	'kind',
	'displayAs',
	'title',
	'subtitle',
	'hidden',
	'requiresRestart',
	'visibleWhen',
	'disabledWhen',
	'default',
];
// TypeBox keywords the builders' schemas carry; the JSON the client reads drops them.
const TYPEBOX = new Set([
	'type',
	'anyOf',
	'items',
	'required',
	'properties',
	'additionalProperties',
	'$schema',
	'$id',
]);
const SPEC: Record<string, Spec> = {
	boolean: { displays: ['switch', 'checkbox'], keys: [] },
	number: {
		displays: ['input', 'slider', 'stepper', 'duration'],
		keys: ['minimum', 'maximum', 'multipleOf', 'units'],
	},
	integer: {
		displays: ['input', 'slider', 'stepper', 'duration'],
		keys: ['minimum', 'maximum', 'multipleOf', 'units'],
	},
	string: {
		displays: [
			'input',
			'multiline',
			'secret',
			'url',
			'color',
			'image',
			'font',
			'emoji',
			...ENTITIES,
		],
		keys: ['minLength', 'maxLength', 'placeholder', 'alpha', 'maxSize'],
	},
	choice: { displays: ['radio', 'picker', 'segmented'], keys: ['options'] },
	array: {
		displays: ['list', 'checkboxes', ...ENTITIES],
		keys: ['of', 'minItems', 'maxItems'],
	},
	button: { displays: ['button', 'danger'], keys: ['action', 'confirm'] },
	notice: { displays: ['notice'], keys: ['tone'] },
};
// Options only some displays take.
const DISPLAY_KEYS: Record<string, string[]> = {
	minLength: ['input', 'multiline'],
	maxLength: ['input', 'multiline'],
	placeholder: ['input', 'multiline', 'secret', 'url'],
	alpha: ['color'],
	maxSize: ['image'],
	units: ['duration'],
};
const SNOWFLAKE = /^\d{17,20}$/;
const URL_PATTERN = /^https?:\/\/[^\s/$.?#][^\s]*$/i;
const EMOJI = /^[^\s:]+(?::\d{17,20})?$/;

function textOf(value: JsonValue): string {
	return typeof value === 'string' ? value : (JSON.stringify(value) ?? 'nothing');
}

function isObject(value: unknown): value is JsonObject {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * @description Tells a nested settings section from a setting or action.
 * @param node A property of a settings schema.
 * @returns Whether it is a section.
 */
export function isSettingsGroup(
	node: SettingSchema | StorelessSchema | SettingsGroupSchema,
): node is SettingsGroupSchema {
	return node.kind === 'section';
}

/**
 * @description Tells an action from a stored setting.
 * @param node A property of a settings schema or section.
 * @returns Whether it is an action.
 */
export function isButton(node: SettingSchema | StorelessSchema): node is ButtonSchema {
	return node.kind === 'button';
}

/**
 * @description Tells a notice from a stored setting or an action.
 * @param node A property of a settings schema or section.
 * @returns Whether it is a notice.
 */
export function isNotice(node: SettingSchema | StorelessSchema): node is NoticeSchema {
	return node.kind === 'notice';
}

/**
 * @description Tells a stored setting from a row that stores nothing, a button or a notice.
 * @param node A property of a settings schema or section.
 * @returns Whether it is a stored setting.
 */
export function isStored(node: SettingSchema | StorelessSchema): node is SettingSchema {
	return !isButton(node) && !isNotice(node);
}

/**
 * @description Tells an http or https URL, as a `displayAs: 'url'` setting holds.
 * @param value The text.
 * @returns Whether it is one.
 */
export function isHttpUrl(value: string): boolean {
	return URL_PATTERN.test(value);
}

/**
 * @description Tells a Discord id, as an entity setting holds.
 * @param value The text.
 * @returns Whether it is one.
 */
export function isSnowflake(value: string): boolean {
	return SNOWFLAKE.test(value);
}

function isEntityDisplay(display: string): display is EntityDisplay {
	return ENTITIES.includes(display);
}

function isMultiple(value: number, step: number): boolean {
	const ratio = value / step;

	return Math.abs(ratio - Math.round(ratio)) < 1e-9;
}

function isStringValue(field: Omit<StringSettingSchema, 'default'>, value: string): boolean {
	const within =
		value.length >= (field.minLength ?? 0) && value.length <= (field.maxLength ?? Infinity);

	switch (field.displayAs) {
		case 'color':
			return (field.alpha ? /^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i : /^#[0-9a-f]{6}$/i).test(
				value,
			);
		case 'url':
			return within && (value === '' || isHttpUrl(value));
		case 'emoji':
			return value === '' || EMOJI.test(value);
		case 'user':
		case 'channel':
		case 'guild':
		case 'role':
			return value === '' || isSnowflake(value);
		default:
			return within;
	}
}

// UNKNOWN: a stored value is checked before it is trusted.
function isItemValue(field: Item, value: unknown): value is SettingValue {
	switch (field.kind) {
		case 'boolean':
			return typeof value === 'boolean';
		case 'string':
			return typeof value === 'string' && isStringValue(field, value);
		case 'choice':
			return field.options.some((choice) => choice.const === value);
		case 'array': {
			// An entity picker's items are ids, whatever the item builder says.
			const display = field.displayAs;
			const item =
				field.of.kind === 'string' && isEntityDisplay(display)
					? { ...field.of, displayAs: display }
					: field.of;

			return (
				Array.isArray(value) &&
				value.length >= (field.minItems ?? 0) &&
				value.length <= (field.maxItems ?? Infinity) &&
				new Set(value).size === value.length &&
				value.every((each) => isItemValue(item, each))
			);
		}
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

/**
 * @description Checks a value against one setting, by its primitive and display: the same check at build time (each default) and on device (each stored value and write).
 * @param field The setting.
 * @param value The value.
 * @returns Whether the setting can hold it.
 */
export function isSettingValue(field: SettingSchema, value: unknown): value is SettingValue {
	return isItemValue(field, value);
}

/**
 * @description Lists every stored setting of a schema with its Bucket key, sections flattened to `section.key`; buttons and notices are left out.
 * @returns The settings, in declaration order.
 */
export function settingEntries(schema: SettingsSchema): SettingEntry[] {
	const entries: SettingEntry[] = [];

	for (const [key, node] of Object.entries(schema.properties)) {
		const children = isSettingsGroup(node)
			? Object.entries(node.properties).map(
					([child, field]) => [`${key}.${child}`, field] as const,
				)
			: [[key, node] as const];

		for (const [path, field] of children) {
			if (isStored(field)) {
				entries.push({ path, field });
			}
		}
	}

	return entries;
}

type Reader = {
	issues: SettingsIssue[];
	booleans: Set<string>;
	conditions: [string, string, string][];
};

function issue(reader: Reader, path: string, problem: string, fix: string) {
	reader.issues.push({ path, problem, fix });
}

function readLabels(node: JsonObject, path: string, reader: Reader) {
	for (const key of ['title', 'subtitle', 'confirm', 'placeholder']) {
		if (node[key] !== undefined && typeof node[key] !== 'string') {
			issue(reader, path, `has a non-string \`${key}\``, 'set it to a message key');
		}
	}

	if (node.hidden !== true && typeof node.title !== 'string') {
		issue(reader, path, 'has no title', 'add `title: <message key>`, or `hidden: true`');
	}

	for (const key of ['visibleWhen', 'disabledWhen']) {
		const condition = node[key];

		if (condition === undefined) {
			continue;
		}

		if (typeof condition === 'string') {
			reader.conditions.push([path, key, condition]);
		} else if (!isObject(condition) || condition.predicate !== true) {
			issue(
				reader,
				`${path}.${key}`,
				'is not a predicate or a key',
				'write `(settings) => boolean` or a boolean setting key',
			);
		}
	}
}

function readChoices(node: JsonObject, path: string, reader: Reader) {
	const options = Array.isArray(node.options) ? node.options : [];

	if (options.length === 0) {
		issue(reader, path, 'has no options', 'add at least one entry to `options`');
	}

	const valid = options.every(
		(choice) =>
			isObject(choice) &&
			typeof choice.const === 'string' &&
			typeof choice.title === 'string',
	);

	if (!valid) {
		issue(
			reader,
			path,
			'has an option without a message key',
			'map each option to a key or { title, subtitle }',
		);
	}

	if (node.displayAs === 'segmented' && options.length > 4) {
		issue(
			reader,
			path,
			`shows ${options.length} options as segmented, which fits at most 4`,
			"use displayAs: 'radio' or 'picker'",
		);
	}
}

function readDisplay(node: JsonObject, path: string, reader: Reader) {
	const display = textOf(node.displayAs);

	for (const [key, displays] of Object.entries(DISPLAY_KEYS)) {
		if (node[key] !== undefined && !displays.includes(display)) {
			issue(
				reader,
				path,
				`sets \`${key}\`, which only displayAs ${displays.map((name) => `'${name}'`).join('/')} takes`,
				`remove \`${key}\` or change displayAs`,
			);
		}
	}

	if (display === 'slider' && (node.minimum === undefined || node.maximum === undefined)) {
		issue(
			reader,
			path,
			'shows as a slider without both `min` and `max`',
			"set both, or use displayAs: 'input'",
		);
	}

	if (node.kind === 'choice') {
		readChoices(node, path, reader);
	}

	if (node.kind === 'array') {
		const of = isObject(node.of) ? node.of : {};
		const choice = of.kind === 'choice';

		if (of.kind !== 'string' && !choice) {
			issue(
				reader,
				path,
				'holds items that are not strings or choices',
				'set `of: setting.string()` or `of: setting.choice(...)`',
			);
		} else if (choice !== (display === 'checkboxes')) {
			issue(
				reader,
				path,
				`shows ${choice ? 'choices' : 'strings'} as '${display}'`,
				choice
					? "use displayAs: 'checkboxes'"
					: "use displayAs: 'list' or an entity picker",
			);
		}

		if (choice) {
			readChoices(of, path, reader);
		}
	}

	if (node.kind === 'notice' && !['info', 'warning', 'danger'].includes(textOf(node.tone))) {
		issue(
			reader,
			path,
			`has the tone ${textOf(node.tone)}`,
			"set `tone` to 'info', 'warning' or 'danger'",
		);
	}

	if (node.kind === 'button' && (typeof node.action !== 'string' || !node.action)) {
		issue(
			reader,
			path,
			'has no `action`',
			"set `action: '<name of an export of src/actions.ts>'`",
		);
	}
}

function copy(node: JsonObject, keys: string[]): JsonObject {
	return Object.fromEntries(Object.entries(node).filter(([key]) => keys.includes(key)));
}

function readField(
	node: JsonValue,
	path: string,
	reader: Reader,
): SettingSchema | StorelessSchema | undefined {
	const spec = isObject(node) && typeof node.kind === 'string' ? SPEC[node.kind] : undefined;

	if (!isObject(node) || !spec) {
		issue(reader, path, 'is not built with a setting builder', `use ${BUILDERS}`);

		return;
	}

	for (const key of Object.keys(node)) {
		if (!COMMON.includes(key) && !spec.keys.includes(key) && !TYPEBOX.has(key)) {
			issue(reader, path, `has the unsupported \`${key}\` option`, 'remove it');
		}
	}

	if (!spec.displays.includes(textOf(node.displayAs))) {
		issue(
			reader,
			path,
			`cannot show as '${textOf(node.displayAs)}'`,
			`use displayAs ${spec.displays.map((name) => `'${name}'`).join(', ')}`,
		);

		return;
	}

	readLabels(node, path, reader);
	readDisplay(node, path, reader);

	const kept = copy(node, [...COMMON, ...spec.keys]);

	// An array's item keeps what checks its values; the TypeBox keywords and labels of its builder go.
	if (isObject(kept.of)) {
		kept.of = copy(kept.of, ['kind', 'displayAs', 'options', ...(SPEC.string?.keys ?? [])]);
	}

	// The keys were checked against the builder's spec above, so the copy has its shape.
	const field = kept as SettingSchema | StorelessSchema;

	if (!isStored(field)) {
		return field;
	}

	if (field.kind === 'boolean') {
		reader.booleans.add(path);
	}

	if (!isSettingValue(field, node.default)) {
		issue(
			reader,
			path,
			`has the default ${JSON.stringify(node.default)}, which its own display or constraints reject`,
			'change the default or the constraints',
		);
	}

	return field;
}

function readProperties(
	node: JsonObject,
	path: string,
	reader: Reader,
	visit: (key: string, child: JsonValue, at: string) => void,
) {
	for (const [key, child] of Object.entries(isObject(node.properties) ? node.properties : {})) {
		const at = path ? `${path}.${key}` : key;

		if (key.includes('.')) {
			issue(reader, at, 'has a dot in its key', 'rename it');
			continue;
		}

		visit(key, child, at);
	}
}

function readGroup(node: JsonObject, path: string, reader: Reader): SettingsGroupSchema {
	const properties: SettingsGroupSchema['properties'] = {};

	readLabels(node, path, reader);

	if (!['group', 'collapsible'].includes(textOf(node.displayAs))) {
		issue(
			reader,
			path,
			`cannot show as '${textOf(node.displayAs)}'`,
			"use displayAs 'group' or 'collapsible'",
		);
	}

	readProperties(node, path, reader, (key, child, at) => {
		if (isObject(child) && child.kind === 'section') {
			issue(
				reader,
				at,
				'nests a section inside a section',
				'move its settings into the outer section',
			);

			return;
		}

		const field = readField(child, at, reader);

		if (field) {
			properties[key] = field;
		}
	});

	return { ...(copy(node, COMMON) as SettingsGroupSchema), properties };
}

/**
 * @description Validates the JSON a plugin's `defineSettings(...)` evaluates to and copies the supported options out of it.
 * @param value The evaluated schema.
 * @returns The supported part of the schema, and every problem found, each naming its property.
 */
// UNKNOWN: `value` is whatever settings.ts default-exports, checked here before anything reads it.
export function readSettingsSchema(value: unknown): SettingsSchemaResult {
	const reader: Reader = { issues: [], booleans: new Set(), conditions: [] };
	const properties: SettingsSchema['properties'] = {};

	if (!isObject(value) || value.kind !== 'settings') {
		issue(
			reader,
			'',
			'does not default-export defineSettings(...)',
			"write `export default defineSettings({ ... })` with defineSettings from '@unbound-app/settings/schema'",
		);

		return { schema: { kind: 'settings', properties }, issues: reader.issues };
	}

	readProperties(value, '', reader, (key, child, at) => {
		const node =
			isObject(child) && child.kind === 'section'
				? readGroup(child, at, reader)
				: readField(child, at, reader);

		if (node) {
			properties[key] = node;
		}
	});

	for (const [path, key, condition] of reader.conditions) {
		if (!reader.booleans.has(condition)) {
			issue(
				reader,
				`${path}.${key}`,
				`names "${condition}", which is not a boolean setting`,
				'name a boolean setting by its dot-separated key, or write a predicate',
			);
		}
	}

	return {
		schema: {
			kind: 'settings',
			...(typeof value.title === 'string' ? { title: value.title } : {}),
			properties,
		},
		issues: reader.issues,
	};
}

export default {
	isButton,
	isNotice,
	isStored,
	isSettingsGroup,
	isSettingValue,
	readSettingsSchema,
	settingEntries,
};
