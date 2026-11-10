import { describe, expect, mock, test } from 'bun:test';
import type { ReactElement, ReactNode } from 'react';
import type { ViewStyle } from 'react-native';

import { createHookRenderer } from '../../helpers/render-hook';

// The props the sheet's elements carry that these tests read.
type SheetProps = {
	children?: ReactNode;
	value?: string;
	maxLength?: number;
	errorMessage?: string;
	onChange?: (text: string) => void;
	onPress?: () => void;
};

type Element = ReactElement<SheetProps, string>;

// The fake JSX runtime's elements carry `type` and `props` like React's.
function isElement(node: ReactNode): node is Element {
	return typeof node === 'object' && node !== null && 'props' in node && 'type' in node;
}

const { React, renderHook } = createHookRenderer();

// The real JSX runtime reads React's internals, which the hook renderer's React lacks.
function jsx<T, P>(type: T, props: P) {
	return { type, props };
}

const named = new Proxy({}, { get: (_target, key) => String(key) });

mock.module('react', () => React);
mock.module('react/jsx-runtime', () => ({ jsx, jsxs: jsx, Fragment: 'Fragment' }));
mock.module('react/jsx-dev-runtime', () => ({ jsxDEV: jsx, Fragment: 'Fragment' }));
mock.module('react-native', () => ({ View: 'View' }));
// Style sheets call `createStyles` as they load; it hands back a hook returning the sheet as written.
const discord = new Proxy(
	{},
	{
		get: (_target, key) =>
			key === 'createStyles'
				? (sheet: Record<string, ViewStyle>) => () => sheet
				: String(key),
	},
);

mock.module('~/metro/components', () => ({ Discord: discord, BottomSheets: named }));
mock.module('~/i18n/api', () => ({ messages: named }));

const { default: InputSheet } = await import('~/ui/settings-kit/input-sheet');

function find(node: ReactNode, type: string): Element | undefined {
	if (Array.isArray(node)) {
		for (const child of node) {
			const found = find(child, type);

			if (found) {
				return found;
			}
		}

		return;
	}

	if (!isElement(node)) return;

	return node.type === type ? node : find(node.props.children, type);
}

function get(node: ReactNode, type: string): SheetProps {
	const found = find(node, type);

	if (!found) {
		throw new Error(`The sheet has no ${type}.`);
	}

	return found.props;
}

function mountSheet(variant: 'text' | 'multiline', onChange: (text: string) => void) {
	const closed: string[] = [];
	const rendered = renderHook(() =>
		InputSheet({
			label: 'Bio',
			value: 'old',
			variant,
			keyboardType: 'default',
			maxLength: 190,
			onChange,
			onClose: () => closed.push('closed'),
		}),
	);

	return { rendered, closed };
}

describe('the settings input sheet', () => {
	test("takes Discord's TextArea string onChange, called twice per keystroke, and writes once on Save", () => {
		const saved: string[] = [];
		const { rendered, closed } = mountSheet('multiline', (text) => saved.push(text));
		const area = get(rendered.current, 'TextArea');

		expect(area.maxLength).toBe(190);

		area.onChange?.('new bio');
		area.onChange?.('new bio');

		expect(saved).toEqual([]);
		expect(get(rendered.current, 'TextArea').value).toBe('new bio');

		get(rendered.current, 'Button').onPress?.();

		expect(saved).toEqual(['new bio']);
		expect(closed).toEqual(['closed']);
	});

	test('keeps a one-line input open with its error when validation rejects it', () => {
		const saved: string[] = [];
		const rendered = renderHook(() =>
			InputSheet({
				label: 'Homepage',
				value: '',
				variant: 'text',
				keyboardType: 'url',
				validate: (text) => (text.startsWith('https://') ? undefined : 'Not a URL'),
				onChange: (text) => saved.push(text),
				onClose: () => saved.push('closed'),
			}),
		);

		get(rendered.current, 'TextInput').onChange?.('nope');
		get(rendered.current, 'Button').onPress?.();

		expect(saved).toEqual([]);
		expect(get(rendered.current, 'TextInput').errorMessage).toBe('Not a URL');
	});
});
