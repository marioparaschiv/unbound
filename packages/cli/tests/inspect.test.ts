import type { EvalResult } from '@unbound-app/debugger-protocol';
import { describe, expect, test } from 'bun:test';

import type { ClassReport, InspectReport, ViewRecord, ViewsReport } from '../src/lib/inspect-probe';
import type { DeviceClient } from '../src/lib/device';

import { formatClassReport, formatFoundViews, formatViewTree } from '../src/lib/inspect-format';
import inspectCommand, { runInspect } from '../src/commands/inspect';

const textView: ClassReport = {
	platform: 'android',
	name: 'android.widget.TextView',
	superclasses: ['android.view.View', 'java.lang.Object'],
	interfaces: ['android.view.ViewTreeObserver$OnPreDrawListener'],
	constructors: [
		['android.content.Context'],
		['android.content.Context', 'android.util.AttributeSet'],
	],
	methods: [
		{
			name: 'setText',
			parameters: ['java.lang.CharSequence'],
			returnType: 'void',
			static: false,
		},
		{
			name: 'getTextColor',
			parameters: ['android.content.Context', 'android.content.res.TypedArray', 'int'],
			returnType: 'int',
			static: true,
		},
		{ name: 'setText', parameters: [], returnType: 'void', static: false },
	],
	fields: [
		{ name: 'mText', type: 'java.lang.CharSequence', static: false },
		{ name: 'DEBUG_EXTRACT', type: 'boolean', static: true },
	],
	members: true,
};

function view(depth: number, overrides: Partial<ViewRecord> = {}): ViewRecord {
	return {
		depth,
		className: 'android.widget.FrameLayout',
		id: null,
		width: 720,
		height: 1600,
		visibility: 'visible',
		text: null,
		handle: `java-${depth}`,
		...overrides,
	};
}

type InspectInput = Parameters<typeof inspectCommand.schema.parse>[0];

function clientAnswering(report: InspectReport, codes: string[] = []): DeviceClient {
	return {
		isDeviceConnected: true,
		evaluate(code: string, timeout?: number): Promise<EvalResult> {
			codes.push(`${timeout} ${code}`);

			const result: EvalResult = {
				type: 'eval-result',
				id: '1',
				ok: true,
				value: JSON.stringify(report),
			};

			return Promise.resolve(result);
		},
	};
}

function run(input: InspectInput, client: DeviceClient) {
	return runInspect(client, inspectCommand.schema.parse(input));
}

describe('formatClassReport', () => {
	test('prints the hierarchy and sorted members with static markers', () => {
		expect(formatClassReport(textView)).toBe(
			[
				'class android.widget.TextView',
				'  extends android.view.View < java.lang.Object',
				'  implements android.view.ViewTreeObserver$OnPreDrawListener',
				'',
				'constructors (2)',
				'  TextView(android.content.Context)',
				'  TextView(android.content.Context, android.util.AttributeSet)',
				'',
				'methods (3)',
				'  static int getTextColor(android.content.Context, android.content.res.TypedArray, int)',
				'  void setText()',
				'  void setText(java.lang.CharSequence)',
				'',
				'fields (2)',
				'  static boolean DEBUG_EXTRACT',
				'  java.lang.CharSequence mText',
			].join('\n'),
		);
	});

	test('narrows the members to a name filter', () => {
		const text = formatClassReport(textView, 'settext');

		expect(text).toContain('constructors (0)');
		expect(text).toContain('methods (2)');
		expect(text).toContain('fields (0)');
	});

	test('explains the missing members on iOS', () => {
		expect(
			formatClassReport({
				...textView,
				platform: 'ios',
				name: 'UILabel',
				superclasses: ['UIView', 'UIResponder', 'NSObject'],
				interfaces: [],
				members: false,
			}),
		).toBe(
			[
				'class UILabel',
				'  extends UIView < UIResponder < NSObject',
				'',
				'The Objective-C bridge lists no methods, properties or ivars, so iOS shows the superclass chain only.',
			].join('\n'),
		);
	});
});

describe('formatViewTree', () => {
	test('indents views by depth with ids, sizes, visibility, handles and text', () => {
		const report: ViewsReport = {
			platform: 'android',
			roots: [
				[
					view(0, { className: 'com.android.internal.policy.DecorView' }),
					view(1, {
						id: 'content',
						className: 'androidx.appcompat.widget.ContentFrameLayout',
					}),
					view(2, {
						className: 'com.discord.chat.presentation.message.view.MessageContentView',
						width: 587,
						height: 38,
						text: 'grouped check',
					}),
					view(2, {
						className: 'android.view.ViewStub',
						width: 0,
						height: 0,
						visibility: 'gone',
					}),
				],
			],
			visited: 4,
			truncated: false,
		};

		expect(formatViewTree(report)).toBe(
			[
				'com.android.internal.policy.DecorView 720x1600 [java-0]',
				'  androidx.appcompat.widget.ContentFrameLayout #content 720x1600 [java-1]',
				'    ~chat.presentation.message.view.MessageContentView 587x38 [java-2] "grouped check"',
				'    android.view.ViewStub 0x0 gone [java-2]',
				'(4 views visited)',
			].join('\n'),
		);
	});

	test('separates roots and reports an empty search', () => {
		const report: ViewsReport = {
			platform: 'ios',
			roots: [
				[view(0, { handle: null })],
				[],
				[view(0, { handle: null, visibility: 'hidden' })],
			],
			visited: 2,
			truncated: true,
		};

		expect(formatViewTree(report)).toBe(
			'android.widget.FrameLayout 720x1600\n\nandroid.widget.FrameLayout 720x1600 hidden\n(2 views visited, limit reached)',
		);
		expect(formatViewTree({ ...report, roots: [] }, 'MessageView')).toBe(
			'No attached MessageView view was found.',
		);
	});
});

describe('formatFoundViews', () => {
	test('lists each view unindented with a count', () => {
		const report: ViewsReport = {
			platform: 'android',
			roots: [[view(0, { id: 'header' }), view(0)]],
			visited: 841,
			truncated: false,
		};

		expect(formatFoundViews(report, 'android.widget.FrameLayout')).toBe(
			[
				'android.widget.FrameLayout #header 720x1600 [java-0]',
				'android.widget.FrameLayout 720x1600 [java-0]',
				'(2 found, 841 views visited)',
			].join('\n'),
		);
		expect(formatFoundViews({ ...report, roots: [[]], visited: null }, 'X')).toBe(
			'No attached X view was found.',
		);
	});
});

describe('inspect command', () => {
	test('sends the request with the walk timeout and formats the report', async () => {
		const codes: string[] = [];
		const output = await run(
			{ what: 'class', name: 'TextView' },
			clientAnswering(textView, codes),
		);

		expect(output.ok).toBe(true);
		expect(output.text.split('\n')[0]).toBe('class android.widget.TextView');
		expect(codes[0]).toMatch(/^60000 /);
		expect(codes[0]).toContain('"kind":"class"');
		expect(codes[0]).toContain('"name":"TextView"');
	});

	test('roots a view dump at a class and passes the depth and chunk size', async () => {
		const codes: string[] = [];
		const report: ViewsReport = {
			platform: 'android',
			roots: [[view(0)]],
			visited: 1,
			truncated: false,
		};

		await run(
			{ what: 'views', class: 'android.widget.FrameLayout', depth: 3, timeout: 90_000 },
			clientAnswering(report, codes),
		);

		const maxNodes = inspectCommand.schema.parse({ what: 'views' }).max;

		expect(codes[0]).toStartWith('90000 ');
		expect(codes[0]).toContain('"kind":"views"');
		expect(codes[0]).toContain('"className":"android.widget.FrameLayout"');
		expect(codes[0]).toContain('"maxDepth":3');
		expect(codes[0]).toContain(`"maxNodes":${maxNodes},`);
		expect(codes[0]).toMatch(/"chunk":\d+/);
	});

	test('passes device errors through and asks for a missing class', async () => {
		expect(
			await run(
				{ what: 'find', name: 'X' },
				clientAnswering({ error: 'No Android activity is resumed.' }),
			),
		).toEqual({
			ok: false,
			text: 'No Android activity is resumed.',
			data: { error: 'No Android activity is resumed.' },
		});
		expect(await run({ what: 'find' }, clientAnswering(textView))).toEqual({
			ok: false,
			text: 'Pass the class to look for: ubd inspect find <class>.',
		});
	});
});
