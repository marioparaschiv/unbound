import { afterEach, describe, expect, mock, test } from 'bun:test';
import { Component, createElement, forwardRef, memo } from 'react';
import type { ReactNode } from 'react';

// No React surface is mounted under bun, so the renderer finds no roots.
mock.module('~/metro/wrappers', () => ({
	findByPropsLazy: () => ({ getPublicInstanceFromRootTag: () => null }),
}));

const { react, unpatchAll } = await import('~/patcher/api');
const { createPatcher } = await import('~/patcher/create-patcher');

type Props = { name: string };

function Greeting({ name }: Props): ReactNode {
	return createElement('Text', null, `hi ${name}`);
}

class Card extends Component<Props> {
	label = 'card';

	render(): ReactNode {
		return createElement('Text', null, `${this.label} ${this.props.name}`);
	}
}

type TextElement = { props: { children: string } };

// Reads a render result that is either a string or a `Text` element holding one.
function textOf(node: ReactNode): string {
	if (typeof node === 'string') {
		return node;
	}

	return (node as TextElement).props.children;
}

afterEach(() => unpatchAll());

describe('patcher.react types', () => {
	test('types props, this and result by component', () => {
		const Memo = memo(Greeting);

		react.after(Memo, ({ props, result }) => {
			const name: string = props.name;

			// @ts-expect-error props carry only the component's props
			void props.missing;

			return result ?? name;
		});
		react.after(Card, ({ this: card, props }) => {
			const label: string = card.label;

			return `${label}${props.name}`;
		});
		react.before({ Greeting }, 'Greeting', ({ props }) => ({ name: props.name.trim() }));
		// @ts-expect-error a before callback returns the component's props
		react.before({ Greeting }, 'Greeting', () => ({ other: 1 }));
	});
});

describe('patcher.react', () => {
	test('patches what a memo renders', () => {
		const Memo = memo(Greeting);

		react.after(Memo, ({ props, result }) => (props.name === 'a' ? 'patched' : result));

		expect(Memo.type({ name: 'a' })).toBe('patched');
		expect(textOf(Memo.type({ name: 'b' }))).toBe('hi b');
	});

	test('patches a forwardRef render and passes the ref through', () => {
		const Forwarded = forwardRef<string, Props>(
			({ name }, ref) => `${name}:${ref ? 'ref' : 'none'}`,
		);
		const render = () => Reflect.get(Forwarded, 'render')({ name: 'a' }, 'ref');

		react.instead(Forwarded, ({ original }) => `[${textOf(original())}]`);

		expect(render()).toBe('[a:ref]');
	});

	test('unwraps a memo around a forwardRef', () => {
		const Inner = forwardRef<string, Props>(({ name }, ref) => `${name}${ref ? '' : '!'}`);
		const Outer = memo(Inner);

		react.after(Outer, ({ result }) => `${textOf(result)}?`);

		expect(Reflect.get(Inner, 'render')({ name: 'a' }, null)).toBe('a!?');
	});

	test('patches a class render with the instance as this', () => {
		const card = new Card({ name: 'a' });

		react.after(Card, ({ this: instance, props, result }) =>
			instance === card ? `${props.name} ${textOf(result)}` : result,
		);

		expect(card.render()).toBe('a card a');
	});

	test('patches a function component through the object holding it', () => {
		const holder = { Greeting };

		react.after(holder, 'Greeting', ({ result }) => `${textOf(result)}!`);

		expect(holder.Greeting({ name: 'a' })).toBe('hi a!');
	});

	test('refuses a function component passed alone', () => {
		expect(() => react.after(Greeting, ({ result }) => result)).toThrow(
			'Failed to patch component Greeting',
		);
	});

	test('before replaces the props', () => {
		const holder = { Greeting };

		react.before(holder, 'Greeting', ({ props }) => ({ name: props.name.toUpperCase() }));

		expect(textOf(holder.Greeting({ name: 'a' }))).toBe('hi A');
	});

	test('instead can render the original with new props', () => {
		const Memo = memo(Greeting);

		react.instead(Memo, ({ original }) => original({ name: 'z' }));

		expect(textOf(Memo.type({ name: 'a' }))).toBe('hi z');
	});

	test('a once patch runs for one render, and unpatching restores the render', () => {
		const Memo = memo(Greeting);
		const original = Memo.type;

		react.after(Memo, () => 'once', { once: true });

		expect(Memo.type({ name: 'a' })).toBe('once');
		expect(textOf(Memo.type({ name: 'a' }))).toBe('hi a');

		const unpatch = react.after(Memo, () => 'again');

		unpatch();

		expect(Memo.type).toBe(original);
	});

	test('a scoped patcher removes its React patches with the rest', () => {
		const Memo = memo(Greeting);
		const original = Memo.type;
		const patcher = createPatcher('react-scope');

		patcher.react.after(Memo, () => 'scoped');

		expect(Memo.type({ name: 'a' })).toBe('scoped');

		patcher.unpatchAll();

		expect(Memo.type).toBe(original);
	});
});
