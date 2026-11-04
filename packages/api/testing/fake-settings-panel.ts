import { createElement, type ReactElement } from 'react';

import type { SchemaNode, SettingsSchema, SettingsValues, SettingValue } from './fake-settings';

/** What the generated panel needs from the fake settings it is drawn for. */
export type PanelSource = {
	schema: SettingsSchema;
	/** The settings as `settings.ts` predicates read them, defaults applied. */
	values: SettingsValues;
	/** Reads a stored setting by dot-separated key. */
	read: (key: string) => SettingValue | SettingsValues;
	/** Saves a setting by dot-separated key. */
	write: (key: string, value: SettingValue) => void;
	/** Re-renders the panel when any setting changes. */
	useChange: () => void;
	/** Looks a message key up in the active locale, re-rendering when it changes. */
	translate: (key: string) => string;
	/** Runs the export of src/actions.ts a button names. */
	runAction: (name: string) => Promise<void>;
};

type Condition = string | { predicate: true; run?: (settings: SettingsValues) => boolean };

const ROWS: Record<string, string> = {
	'boolean:switch': 'SwitchRow',
	'boolean:checkbox': 'CheckboxRow',
	'integer:input': 'NumberRow',
	'integer:slider': 'SliderRow',
	'integer:stepper': 'StepperRow',
	'integer:duration': 'DurationRow',
	'string:input': 'InputRow',
	'string:multiline': 'MultilineRow',
	'string:secret': 'SecretRow',
	'string:url': 'UrlRow',
	'string:color': 'ColorRow',
	'choice:radio': 'RadioRow',
	'choice:picker': 'PickerRow',
	'choice:segmented': 'SegmentedRow',
	'array:list': 'ListRow',
	'array:checkboxes': 'ChecklistRow',
	button: 'ButtonRow',
	notice: 'NoticeRow',
};

// `number` shares the integer rows, and each entity display is an entity row.
function rowName(node: SchemaNode): string {
	const kind = node.kind === 'number' ? 'integer' : node.kind;
	const display = String(node.displayAs);
	const entity = ['user', 'channel', 'guild', 'role'].includes(display);

	if (display === 'color' && node.palette === true) {
		return 'PaletteRow';
	}

	return (
		ROWS[kind] ??
		ROWS[`${kind}:${display}`] ??
		(entity ? 'EntityRow' : `${display[0]?.toUpperCase()}${display.slice(1)}Row`)
	);
}

// Mirrors the client's `evaluateCondition`: a boolean setting's key, or the predicate the build lifted out of settings.ts.
function holds(source: PanelSource, condition: Condition | undefined): boolean | undefined {
	if (condition === undefined) return;

	if (typeof condition === 'string') {
		return source.read(condition) === true;
	}

	return condition.run ? Boolean(condition.run(source.values)) : undefined;
}

function row(source: PanelSource, path: string, node: SchemaNode): ReactElement | null {
	if (
		node.hidden === true ||
		holds(source, node.visibleWhen as Condition | undefined) === false
	) {
		return null;
	}

	const { translate } = source;
	const title = node.title === undefined ? path : translate(node.title);
	const subtitle = node.subtitle === undefined ? undefined : translate(node.subtitle);
	const texts = [title, subtitle].filter((text) => text !== undefined);
	const common = {
		path,
		title,
		subtitle,
		disabled: holds(source, node.disabledWhen as Condition | undefined) === true,
	};

	if (node.kind === 'notice') {
		return createElement('NoticeRow', { key: path, ...common, tone: node.tone }, ...texts);
	}

	if (node.kind === 'button') {
		return createElement(
			'ButtonRow',
			{
				key: path,
				...common,
				variant: node.displayAs,
				confirm: node.confirm === undefined ? undefined : translate(String(node.confirm)),
				onPress: () => source.runAction(String(node.action)),
			},
			...texts,
		);
	}

	return createElement(
		rowName(node),
		{
			key: path,
			...common,
			value: source.read(path),
			onChange: (value: SettingValue) => source.write(path, value),
		},
		...texts,
	);
}

function section(source: PanelSource, path: string, node: SchemaNode): ReactElement | null {
	if (
		node.hidden === true ||
		holds(source, node.visibleWhen as Condition | undefined) === false
	) {
		return null;
	}

	const title = node.title === undefined ? undefined : source.translate(node.title);
	const rows = Object.entries(node.properties ?? {}).map(([key, child]) =>
		row(source, path ? `${path}.${key}` : key, child),
	);

	return createElement(
		'Section',
		{ key: path || 'settings', path, title },
		...(title === undefined ? [] : [title]),
		...rows,
	);
}

/**
 * @description Creates the fake generated settings panel: one named row per setting, button and notice, grouped in a section
 * per `setting.section`, with `hidden`, `visibleWhen` and `disabledWhen` honoured as the client's panel does.
 * @param source The settings it draws, and what its rows call.
 * @returns The panel component.
 */
export function createSettingsPanel(source: PanelSource): () => ReactElement {
	function SettingsPanel() {
		source.useChange();

		const top: Record<string, SchemaNode> = {};
		const sections: [string, SchemaNode][] = [];

		for (const [key, node] of Object.entries(source.schema.properties)) {
			if (node.kind === 'section') {
				sections.push([key, node]);
			} else {
				top[key] = node;
			}
		}

		return createElement(
			'SettingsPanel',
			{ schema: source.schema },
			section(source, '', { kind: 'section', title: source.schema.title, properties: top }),
			...sections.map(([key, node]) => section(source, key, node)),
		);
	}

	return SettingsPanel;
}
