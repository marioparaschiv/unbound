import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { ModuleRecord } from '../src/types';

import { isEnumLike, passedType } from '../src/rules';
import { runPipeline } from '../src/pipeline';
import { loadHostProps } from '../src/hosts';
import { splitModules } from '../src/split';
import { TYPES_DIR } from '../src/paths';

// Verbatim module slices of discord-350's main.js; each fixture names its source path.
const FIXTURE_IDS = [
	17, 5378, 6181, 6722, 6882, 6294, 6295, 6304, 6290, 5085, 4732, 6196, 4428, 4439, 9432,
];
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
	});

	test('string literals a call site passes join the default in the open literal union', () => {
		const props = alias('design.gen.d.ts', 'StackProps');

		expect(props).toContain(
			"/** @default 'vertical' */ direction?: 'horizontal' | 'vertical' | (string & {});",
		);
		expect(props).toContain(
			"/** @default 'stretch' */ align?: 'flex-start' | 'stretch' | (string & {});",
		);
	});
});

describe('call-site literals', () => {
	test('a literal passed for an otherwise untyped prop types it by its typeof', () => {
		expect(alias('design.gen.d.ts', 'TableRowProps')).toContain('arrow?: boolean;');
	});

	test('enum tokens form a union; free text and data props do not', () => {
		expect(isEnumLike('variant', ['heading-sm/bold', 'flex-start', 'secondary'])).toBe(true);
		expect(isEnumLike('label', ['secondary'])).toBe(false);
		expect(isEnumLike('screenKey', ['debugLogs'])).toBe(false);
		expect(isEnumLike('variant', ['Send Gift'])).toBe(false);
		expect(isEnumLike('href', ['https://discord.com'])).toBe(false);
		expect(isEnumLike('size', ['sm', 16])).toBe(false);
	});

	test('one caller passing a string or a number to a layout dimension does not close off the other', () => {
		expect(passedType('height', ['100%'])).toBe('number | string');
		expect(passedType('maxWidth', [240])).toBe('number | string');
		expect(passedType('borderRadius', [8])).toBe('number | string');
		expect(passedType('columns', [2])).toBe('number');
		expect(passedType('hidden', [true])).toBe('boolean');
		expect(passedType('size', ['sm', 16])).toBeUndefined();
	});
});

describe('Text', () => {
	test('a `??` fallback types and documents the prop like a destructuring default', () => {
		// Call sites in other fixtures add their own colours to the union, so only the default's part is pinned.
		expect(alias('design.gen.d.ts', 'TextProps')).toMatch(
			/\/\*\* @default 'text-default' \*\/ color\?: [^;]*'text-default' \|/,
		);
	});
});

describe('TextField', () => {
	const props = alias('design.gen.d.ts', 'TextFieldProps');

	test('keys a hook sets over the spread props are dropped from the rest type', () => {
		expect(props).toStartWith(
			"export type TextFieldProps = Omit<BaseTextFieldProps, 'aria-disabled' | 'disabled' | 'editable' | 'focusable' | 'onChange' | 'onChangeText' | 'onClear' | 'ref'> & {",
		);
	});

	test('props read by the hooks the props pass through are typed from the hooks', () => {
		expect(props).toContain('onChange?: (...args: any[]) => unknown;');
		expect(props).toContain('onClear?: (...args: any[]) => unknown;');
		expect(props).toContain('/** @default false */ disabled?: boolean;');
	});

	test('a hook-read key the base still receives keeps the base type', () => {
		expect(props).not.toContain('value?:');
	});

	test('a key the hook sets over the props is not adopted', () => {
		expect(props).not.toContain('onChangeText?:');
	});

	test('a component spreading a hook result still accepts the keys the hook reads', () => {
		expect(alias('design.gen.d.ts', 'TextFieldComponent')).toBe(
			'export type TextFieldComponent = React.ComponentType<TextFieldProps & Record<string, unknown>>;',
		);
	});
});

describe('imported constants', () => {
	test('a prop compared with members of an imported enum is typed by their values', () => {
		expect(alias('modules.gen.d.ts', 'IdentityVerificationFieldProps')).toContain(
			"platform?: 'email' | 'phone' | (string & {});",
		);
	});

	test('an enum imported through an export-star barrel resolves', () => {
		expect(alias('design.gen.d.ts', 'AnimatedRenderItemProps')).toContain('state?: number;');
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
