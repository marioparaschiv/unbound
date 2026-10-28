import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { ModuleRecord } from '../src/types';

import { runPipeline } from '../src/pipeline';
import { loadHostProps } from '../src/hosts';
import { splitModules } from '../src/split';
import { TYPES_DIR } from '../src/paths';

// Verbatim slices of discord-350's main.js: react-native's entry, Stack, TableRow, NavigatorScreen, TableSwitchRow,
// TextField, useTextField, BaseTextField.
const FIXTURE_IDS = [17, 5378, 6181, 6722, 6882, 6294, 6295, 6304];
const lines = FIXTURE_IDS.flatMap((id) =>
	readFileSync(join(import.meta.dir, 'fixtures', `module-${id}.txt`), 'utf8').split('\n'),
);
const hosts = loadHostProps(TYPES_DIR);

async function generate() {
	return runPipeline('fixture', splitModules(lines), hosts);
}

const { files } = await generate();

/** The emitted text of one type alias, with whitespace collapsed so assertions ignore layout. */
function alias(file: string, name: string): string {
	const text = files.get(file) ?? '';
	const start = text.indexOf(`export type ${name} =`);

	if (start === -1) {
		return '';
	}

	const ends = [text.indexOf('export type ', start + 1), text.indexOf('\n/**', start)];
	const end = Math.min(...ends.map((index) => (index === -1 ? text.length : index)));

	return text.slice(start, end).replace(/\s+/g, ' ').trim();
}

describe('splitModules', () => {
	test('yields every module with its id, deps and source path', async () => {
		const modules: ModuleRecord[] = [];

		for await (const module of splitModules(lines)) modules.push(module);

		expect(modules.map((module) => module.id)).toEqual(FIXTURE_IDS);
		expect(modules[0]!.path).toBeUndefined();
		expect(modules[4]!.path).toBe(
			'design/components/TableRow/native/TableSwitchRow.native.tsx',
		);
		expect(modules[4]!.deps).toEqual([
			31, 108, 19, 17, 21, 5089, 560, 578, 1383, 4421, 5085, 6883, 6181, 2,
		]);
	});
});

describe('TableSwitchRow', () => {
	const props = alias('design.gen.d.ts', 'TableSwitchRowProps');

	test('rest props are typed from TableRow without the destructured keys', () => {
		expect(props).toStartWith(
			"export type TableSwitchRowProps = Omit<TableRowProps, 'accessibilityHint' | 'disabled' | 'label' | 'onValueChange' | 'subLabel' | 'trailing' | 'value' | 'variant'> & {",
		);
	});

	test('a prop forwarded to a typed TableRow prop references it', () => {
		expect(props).toContain("variant?: TableRowProps['variant'];");
	});

	test('a destructuring default is documented while the type comes from the forward', () => {
		expect(props).toContain("/** @default false */ disabled?: TableRowProps['disabled'];");
	});

	test('a prop placed by slot index into a View children array uses the host prop type', () => {
		expect(props).toContain("trailing?: React.ComponentProps<typeof RN.View>['children'];");
	});

	test('a called prop is a function', () => {
		expect(props).toContain('onValueChange?: (...args: any[]) => unknown;');
	});

	test('the source path is the @see tag', () => {
		expect(files.get('design.gen.d.ts')).toContain(
			'@see design/components/TableRow/native/TableSwitchRow.native.tsx',
		);
	});
});

describe('TableRow', () => {
	test('compared and default string literals form an open literal union', () => {
		expect(alias('design.gen.d.ts', 'TableRowInnerProps')).toContain(
			"/** @default 'default' */ variant?: 'danger' | 'default' | (string & {});",
		);
	});

	test('rest spread into a component outside the build keeps unseen props allowed, and statics attach', () => {
		expect(alias('design.gen.d.ts', 'TableRowComponent')).toBe(
			'export type TableRowComponent = React.ComponentType<TableRowProps & Record<string, unknown>> & TableRowStatics;',
		);
	});
});

describe('Stack', () => {
	test('a default copied into another register types and documents the prop', () => {
		const props = alias('design.gen.d.ts', 'StackProps');

		expect(props).toContain('/** @default 8 */ spacing?: number;');
		expect(props).toContain(
			"/** @default 'vertical' */ direction?: 'vertical' | (string & {});",
		);
	});
});

describe('TextField', () => {
	const props = alias('design.gen.d.ts', 'TextFieldProps');

	test('keys a hook sets over the spread props are dropped from the rest type', () => {
		expect(props).toStartWith(
			"export type TextFieldProps = Omit<BaseTextFieldProps, 'aria-disabled' | 'editable' | 'focusable' | 'onChange' | 'onChangeText' | 'ref'> & {",
		);
	});

	test('a component spreading a hook result still accepts the keys the hook reads', () => {
		expect(alias('design.gen.d.ts', 'TextFieldComponent')).toBe(
			'export type TextFieldComponent = React.ComponentType<TextFieldProps & Record<string, unknown>>;',
		);
	});
});

describe('NavigatorScreen', () => {
	test('a memo-wrapped component is found and labelled memo', () => {
		expect(files.get('design.gen.d.ts')).toContain('Props of `NavigatorScreen` (memo)');
	});
});

describe('index', () => {
	test('maps source path and export name to the component type', () => {
		const index = files.get('index.gen.d.ts')!.replace(/\s+/g, ' ');

		expect(index).toContain(
			"'design/components/TableRow/native/TableSwitchRow.native.tsx': { TableSwitchRow: TableSwitchRowComponent; };",
		);
		expect(index).toContain('TableSwitchRow: TableSwitchRowComponent;');
		expect(index).toContain("export * from './design.gen';");
	});

	test('names the build the types came from', () => {
		expect(files.get('index.gen.d.ts')).toContain("export type DiscordBuild = 'fixture';");
	});

	test('output is byte-identical across runs', async () => {
		const again = await generate();

		expect([...again.files]).toEqual([...files]);
	});
});
