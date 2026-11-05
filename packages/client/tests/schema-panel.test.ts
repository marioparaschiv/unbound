import type { SettingSchema, SettingsSchema, SettingValue } from '@unbound-app/types/settings';
import { describe, expect, mock, test } from 'bun:test';
import type { ReactElement } from 'react';

import type { SettingsValues } from '~/storage/define';
import type { AlertDialogProps } from '~/dialogs/api';

// The rows read Discord's components and Unbound's strings only when they render, which these tests never do.
const named = new Proxy({}, { get: (_target, key) => String(key) });

// Style sheets call `createStyles` as they load; it hands back a hook returning the sheet as written.
const discord = new Proxy(
	{},
	{
		get: (_target, key) =>
			key === 'createStyles' ? (sheet: Record<string, unknown>) => () => sheet : String(key),
	},
);

mock.module('~/metro/components', () => ({
	Discord: discord,
	SafeArea: named,
	BottomSheets: named,
}));
mock.module('~/metro/search', () => ({
	findByName: () => undefined,
	findByProps: () => undefined,
}));
mock.module('~/metro/wrappers', () => ({ findStoreLazy: () => undefined }));
mock.module('~/metro/api', () => ({ ActionSheets: undefined }));
mock.module('~/assets/api', () => ({ icons: named }));
mock.module('~/i18n/api', () => ({ messages: named, format: (key: string) => key }));
// A confirmation answers yes, by pressing its confirm button.
mock.module('~/dialogs/api', () => ({
	showDialog: (options: AlertDialogProps) => {
		options.buttons?.[0]?.onPress?.();

		return { key: 'dialog', dismiss: () => undefined };
	},
}));
mock.module('~/native/runtime', () => ({ reload: async () => {} }));
mock.module('react-native', () => ({
	Dimensions: { get: () => ({ width: 390, height: 844 }) },
	Pressable: 'Pressable',
	ScrollView: 'ScrollView',
	View: 'View',
}));

const { settingElement } = await import('~/ui/settings-kit/setting-element');
const { schemaLayout } = await import('~/ui/settings-kit/schema-layout');
const { evaluateCondition } = await import('~/ui/settings-kit/conditions');
const { createDefinedSettings } = await import('~/storage/define');
const storage = await import('~/storage/api');
const kit = await import('~/ui/settings-kit/api');

// Each row has its own props; a test matches the ones it checks.
type Row = { type: ReactElement['type']; props: object };

function draw(field: SettingSchema, value: SettingValue = field.default): Row {
	const element: ReactElement = settingElement({
		entry: { path: 'key', field },
		value,
		onChange: () => {},
		translate: (key) => `[${key}]`,
	});

	return { type: element.type, props: element.props as object };
}

const labels = { title: 'T', subtitle: 'S' };
const options = [
	{ const: 'cozy', title: 'COZY', subtitle: 'COZY_SUBTITLE' },
	{ const: 'compact', title: 'COMPACT' },
];

describe('settingElement', () => {
	test.each<[string, SettingSchema, ReactElement['type']]>([
		[
			'switch',
			{ ...labels, kind: 'boolean', displayAs: 'switch', default: true },
			kit.SwitchRow,
		],
		[
			'checkbox',
			{ ...labels, kind: 'boolean', displayAs: 'checkbox', default: true },
			kit.CheckboxRow,
		],
		[
			'slider',
			{ ...labels, kind: 'number', displayAs: 'slider', default: 1, minimum: 0, maximum: 2 },
			kit.SliderRow,
		],
		[
			'stepper',
			{ ...labels, kind: 'integer', displayAs: 'stepper', default: 1 },
			kit.StepperRow,
		],
		[
			'number input',
			{ ...labels, kind: 'number', displayAs: 'input', default: 1 },
			kit.NumberRow,
		],
		[
			'duration',
			{ ...labels, kind: 'integer', displayAs: 'duration', default: 1000 },
			kit.DurationRow,
		],
		['input', { ...labels, kind: 'string', displayAs: 'input', default: '' }, kit.InputRow],
		[
			'multiline',
			{ ...labels, kind: 'string', displayAs: 'multiline', default: '' },
			kit.MultilineRow,
		],
		['secret', { ...labels, kind: 'string', displayAs: 'secret', default: '' }, kit.SecretRow],
		['url', { ...labels, kind: 'string', displayAs: 'url', default: '' }, kit.UrlRow],
		[
			'color',
			{ ...labels, kind: 'string', displayAs: 'color', default: '#FFFFFF' },
			kit.ColorRow,
		],
		[
			'palette',
			{
				...labels,
				kind: 'string',
				displayAs: 'color',
				default: '#FFFFFF',
				palette: true,
				presets: ['#FFFFFF'],
			},
			kit.PaletteRow,
		],
		['user', { ...labels, kind: 'string', displayAs: 'user', default: '' }, kit.EntityRow],
		[
			'radio',
			{ ...labels, kind: 'choice', displayAs: 'radio', default: 'cozy', options },
			kit.RadioRow,
		],
		[
			'picker',
			{ ...labels, kind: 'choice', displayAs: 'picker', default: 'cozy', options },
			kit.PickerRow,
		],
		[
			'segmented',
			{ ...labels, kind: 'choice', displayAs: 'segmented', default: 'cozy', options },
			kit.SegmentedRow,
		],
		[
			'list',
			{
				...labels,
				kind: 'array',
				displayAs: 'list',
				default: [],
				of: { kind: 'string', displayAs: 'input' },
			},
			kit.ListRow,
		],
		[
			'checkboxes',
			{
				...labels,
				kind: 'array',
				displayAs: 'checkboxes',
				default: [],
				of: { kind: 'choice', displayAs: 'radio', options },
			},
			kit.ChecklistRow,
		],
	])('draws %s as its row', (_name, field, row) => {
		expect(draw(field).type).toBe(row);
	});

	test('translates labels and shows each radio option with its subtitle', () => {
		const { props } = draw({
			...labels,
			kind: 'choice',
			displayAs: 'radio',
			default: 'cozy',
			options,
		});

		expect(props).toMatchObject({
			title: '[T]',
			description: '[S]',
			options: [
				{ value: 'cozy', label: '[COZY]', subLabel: '[COZY_SUBTITLE]' },
				{ value: 'compact', label: '[COMPACT]', subLabel: undefined },
			],
		});
	});
});

const schema: SettingsSchema = {
	kind: 'settings',
	properties: {
		showBadge: { kind: 'boolean', displayAs: 'switch', title: 'A', default: true },
		size: {
			kind: 'integer',
			displayAs: 'slider',
			title: 'B',
			default: 14,
			minimum: 10,
			maximum: 24,
			visibleWhen: { predicate: true },
		},
		limit: {
			kind: 'number',
			displayAs: 'input',
			title: 'C',
			default: 1,
			disabledWhen: 'showBadge',
		},
		seen: { kind: 'boolean', displayAs: 'switch', hidden: true, default: false },
		style: { kind: 'choice', displayAs: 'radio', title: 'D', default: 'cozy', options },
		badge: {
			kind: 'section',
			displayAs: 'collapsible',
			title: 'E',
			properties: {
				clear: { kind: 'button', displayAs: 'danger', title: 'F', action: 'clear' },
			},
		},
	},
};

describe('schemaLayout', () => {
	test('groups inline rows and inputs, stands radio groups alone, and leaves hidden settings out', () => {
		const layout = schemaLayout(schema);

		expect(
			layout.map((section) => [
				section.path,
				section.collapsible,
				section.blocks.map((block) => [block.inline, block.items.map((item) => item.path)]),
			]),
		).toEqual([
			[
				'',
				false,
				[
					[true, ['showBadge', 'size', 'limit']],
					[false, ['style']],
				],
			],
			['badge', true, [[true, ['badge.clear']]]],
		]);
	});
});

describe('evaluateCondition', () => {
	test('shows and hides a row live as the settings it reads change', () => {
		const name = 'schema-panel-test';
		const settings = createDefinedSettings(schema, storage.getBucket(name), () => () => {});
		const predicates = {
			size: {
				visibleWhen: (values: SettingsValues) =>
					values.showBadge === true && values.style !== 'compact',
			},
		};
		const visible = () =>
			evaluateCondition(settings, 'size', 'visibleWhen', { predicate: true }, predicates);

		expect(visible()).toBe(true);
		settings.set('style', 'compact');
		expect(visible()).toBe(false);
		settings.set('style', 'cozy');
		expect(visible()).toBe(true);
		expect(evaluateCondition(settings, 'limit', 'disabledWhen', 'showBadge', {})).toBe(true);
	});

	test('treats a predicate that throws as shown', () => {
		const settings = createDefinedSettings(
			schema,
			storage.getBucket('schema-panel-throws'),
			() => () => {},
		);
		const predicates = {
			size: {
				visibleWhen: () => {
					throw new Error('boom');
				},
			},
		};

		expect(
			evaluateCondition(settings, 'size', 'visibleWhen', { predicate: true }, predicates),
		).toBeUndefined();
	});
});
