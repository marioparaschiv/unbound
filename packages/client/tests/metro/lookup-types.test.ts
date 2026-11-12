import type {
	MetroModuleByName,
	MetroModuleByPath,
	MetroModuleName,
	MetroModulePath,
	MetroPropName,
} from '@unbound-app/types/metro';
import { describe, expect, test } from 'bun:test';
import type { ComponentProps } from 'react';

import type { findByFilePath, findByName, findByProps } from '~/metro/lookups';
import type { AnyProps, MetroFunction } from '~/metro/types';

// Checked by `bun run typecheck` against the generated module index. A Discord update that drops a module used here
// fails it: pick another.

type Equal<A, B> =
	(<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;

function expectType<T extends true>(): T | undefined {
	return undefined;
}

// A value of `T` for checks that read or destructure one; the tests only type-check it.
function valueOf<T>(): T {
	return Object.create(null);
}

type AlertModalModule =
	MetroModuleByPath<'design/components/AlertModal/native/AlertModal.native.tsx'>;

type DesignModuleExports = MetroModuleByPath<'design/native.tsx'>;

type SwitchRowProps = ComponentProps<DesignModuleExports['TableSwitchRow']>;

type MessagesFallback = { sendMessage: MetroExport; receiveMessage: MetroExport };

type UnknownOnly = { notADiscordExport: MetroExport };

type AnyExports = Record<string, MetroExport>;

type SheetWithoutInterop = { default: MetroModuleByName<'SimpleActionSheet'> };

describe('findByProps types', () => {
	test('props one typed module exposes give that module', () => {
		type Found = ReturnType<typeof findByProps<'AlertModal', ['AlertActions']>>;

		expect(expectType<Equal<Found, AnyProps<AlertModalModule> | undefined>>()).toBeUndefined();
	});

	test('a result stays open: an export the index lacks reads and destructures as MetroExport', () => {
		type Found = ReturnType<typeof findByProps<'AlertModal', ['AlertActions']>>;

		const found = valueOf<NonNullable<Found>>();
		const { notInIndex } = found;

		expect(expectType<Equal<typeof found.notInIndex, MetroExport>>()).toBeUndefined();
		expect(expectType<Equal<typeof notInIndex, MetroExport>>()).toBeUndefined();
		expect(
			expectType<Equal<NonNullable<Found>['AlertModal'], AlertModalModule['AlertModal']>>(),
		).toBeUndefined();
	});

	test('options keep the module type, and `all` always gives an array', () => {
		type All = ReturnType<typeof findByProps<'AlertModal', ['AlertActions', { all: true }]>>;
		type Eager = ReturnType<
			typeof findByProps<'AlertModal', ['AlertActions', { lazy: false }]>
		>;

		expect(expectType<Equal<All, AnyProps<AlertModalModule>[]>>()).toBeUndefined();
		expect(expectType<Equal<Eager, AnyProps<AlertModalModule> | undefined>>()).toBeUndefined();
	});

	test('props several typed modules expose give the union of them', () => {
		type Found = ReturnType<typeof findByProps<'AlertModal', ['AlertModalContainer']>>;
		type Expected = AnyProps<
			MetroModuleByPath<
				'design/components/AlertModal/native/AlertModal.native.tsx' | 'design/native.tsx'
			>
		>;

		expect(expectType<Equal<Found, Expected | undefined>>()).toBeUndefined();
	});

	test('props of a module with no typed export fall back to a record of them', () => {
		type Found = ReturnType<typeof findByProps<'sendMessage', ['receiveMessage']>>;

		expect(expectType<Equal<Found, AnyProps<MessagesFallback> | undefined>>()).toBeUndefined();
	});

	test('an unknown prop falls back to a record of the requested props', () => {
		type Unknown = ReturnType<typeof findByProps<'notADiscordExport', []>>;

		expect(expectType<Equal<Unknown, AnyProps<UnknownOnly> | undefined>>()).toBeUndefined();
	});

	test('props known only at runtime fall back too', () => {
		type Found = ReturnType<typeof findByProps<string, string[]>>;

		expect(expectType<Equal<Found, AnyProps<AnyExports> | undefined>>()).toBeUndefined();
	});
});

describe('component props', () => {
	test('a "required" prop may be omitted and an unknown prop passed', () => {
		const props: SwitchRowProps = { someNewProp: true };

		expect(props).toBeDefined();
	});

	test('a concrete prop is suggested and still checks its value', () => {
		const props: SwitchRowProps = { value: true };
		// @ts-expect-error `value` is a boolean
		const wrong: SwitchRowProps = { value: 1 };

		expect(expectType<Equal<SwitchRowProps['value'], boolean | undefined>>()).toBeUndefined();
		expect([props, wrong]).toHaveLength(2);
	});

	test('a callback prop takes a function, and only a function', () => {
		const props: SwitchRowProps = { onValueChange: (value: boolean) => value };
		// @ts-expect-error a callback is a function
		const wrong: SwitchRowProps = { onValueChange: 'toggle' };

		expect([props, wrong]).toHaveLength(2);
	});

	test('a prop the generator typed weakly accepts anything', () => {
		const props: SwitchRowProps = { label: 1, trailing: { any: 'object' } };

		expect(expectType<Equal<SwitchRowProps['trailing'], MetroExport>>()).toBeUndefined();
		expect(props).toBeDefined();
	});
});

describe('findByName types', () => {
	test('a default export name gives its component', () => {
		type Found = ReturnType<typeof findByName<'SimpleActionSheet', []>>;
		type WithoutInterop = ReturnType<
			typeof findByName<'SimpleActionSheet', [{ interop: false }]>
		>;

		expect(
			expectType<Equal<Found, MetroModuleByName<'SimpleActionSheet'> | undefined>>(),
		).toBeUndefined();
		expect(
			expectType<Equal<WithoutInterop, SheetWithoutInterop | undefined>>(),
		).toBeUndefined();
	});

	test('an unknown name falls back to an untyped function', () => {
		expect(
			expectType<
				Equal<
					ReturnType<typeof findByName<'NotADiscordName', []>>,
					MetroFunction | undefined
				>
			>(),
		).toBeUndefined();
	});
});

describe('findByFilePath types', () => {
	test('a typed module path gives its module', () => {
		type Found = ReturnType<typeof findByFilePath<'design/native.tsx', []>>;

		expect(
			expectType<Equal<Found, AnyProps<DesignModuleExports> | undefined>>(),
		).toBeUndefined();
	});

	test('any other path falls back to an open module', () => {
		type Untyped = ReturnType<typeof findByFilePath<'actions/MessageActionCreators.tsx', []>>;
		type Unknown = ReturnType<typeof findByFilePath<'not/a/discord/path.tsx', []>>;

		expect(expectType<Equal<Untyped, AnyProps | undefined>>()).toBeUndefined();
		expect(expectType<Equal<Unknown, AnyProps | undefined>>()).toBeUndefined();
	});
});

describe('autocomplete', () => {
	test('known names are literals of the argument types, which still take any string', () => {
		expect(
			expectType<Equal<Extract<MetroPropName, 'sendMessage'>, 'sendMessage'>>(),
		).toBeUndefined();
		expect(
			expectType<Equal<Extract<MetroPropName, 'notADiscordExport'>, never>>(),
		).toBeUndefined();
		expect(
			expectType<Equal<Extract<MetroModuleName, 'SimpleActionSheet'>, 'SimpleActionSheet'>>(),
		).toBeUndefined();
		expect(
			expectType<
				Equal<
					Extract<MetroModulePath, 'actions/MessageActionCreators.tsx'>,
					'actions/MessageActionCreators.tsx'
				>
			>(),
		).toBeUndefined();
		expect(
			expectType<Equal<string extends MetroPropName ? true : false, true>>(),
		).toBeUndefined();
	});

	test('the first argument, the one editors complete, takes the known literals', () => {
		type First = Parameters<typeof findByProps<'sendMessage', []>>[0];

		expect(expectType<Equal<First, 'sendMessage'>>()).toBeUndefined();
		// @ts-expect-error the first argument is typed on its own, from the known export names
		expect(expectType<Equal<Parameters<typeof findByProps<42, []>>[0], 42>>()).toBeUndefined();
	});

	test('a spread array of terms still types, loosely', () => {
		type Spread = ReturnType<typeof findByProps<string[]>>;

		expect(expectType<Equal<Spread, AnyProps<AnyExports> | undefined>>()).toBeUndefined();
	});

	test('a hashed module key is never offered as a path', () => {
		expect(expectType<Equal<Extract<MetroModulePath, `~${string}`>, never>>()).toBeUndefined();
	});
});
