import { afterEach, describe, expect, mock, test } from 'bun:test';
import { Component, createElement, forwardRef, memo } from 'react';
import type { ReactNode } from 'react';

import { mockLookups } from '../helpers/lookups';

// No React surface is mounted under bun, so the renderer finds no roots.
mockLookups({
	findByProps: () => ({ getPublicInstanceFromRootTag: () => null }),
});

const warning = mock();
const toasts = { show: mock(), success: mock(), info: mock(), warning, error: mock() };

// Every export, since bun keeps a module mock for the test files that run after this one.
mock.module('~/toasts/api', () => ({ ...toasts, default: toasts }));

const { react, unpatchAll } = await import('~/patcher/api');
const { createPatcher } = await import('~/patcher/create-patcher');
const { isPatchBoundary } = await import('~/patcher/patch-boundary');

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

// Reads a render result that is either a string or a `Text` element holding one, inside any patch boundary.
function textOf(node: ReactNode): string {
	if (typeof node === 'string') {
		return node;
	}

	if (isPatchBoundary(node)) {
		return textOf(node.props.children);
	}

	return (node as TextElement).props.children;
}

// Mounts the boundary around a render result, as React would.
function mountBoundary(node: ReactNode) {
	if (!isPatchBoundary(node)) {
		throw new TypeError('Expected a patch boundary.');
	}

	return new node.type(node.props);
}

// Makes the boundary around a render result catch an error, as React would.
function failBoundary(node: ReactNode) {
	const boundary = mountBoundary(node);

	boundary.state = { ...boundary.state, failed: true };
	boundary.componentDidCatch(new Error('render failed'));

	return boundary;
}

afterEach(() => {
	unpatchAll();
	warning.mockClear();
});

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

	test('wraps a patched tree in one boundary that later patches see through', () => {
		const Memo = memo(Greeting);

		react.after(Memo, ({ result }) => createElement('View', null, result));
		react.after(Memo, ({ result }) => {
			expect(isPatchBoundary(result)).toBe(false);

			return result;
		});

		const tree = Memo.type({ name: 'a' });

		expect(isPatchBoundary(tree)).toBe(true);
		expect(isPatchBoundary(Reflect.get(tree as object, 'props').children)).toBe(false);
	});

	test('leaves text and empty trees unwrapped', () => {
		const Memo = memo(Greeting);

		react.after(Memo, () => null);

		expect(Memo.type({ name: 'a' })).toBeNull();
	});

	test('a throwing patch renders the original and stays patched', () => {
		const Memo = memo(Greeting);
		const original = Memo.type;

		react.instead(Memo, () => {
			throw new Error('patch failed');
		});

		expect(textOf(Memo.type({ name: 'a' }))).toBe('hi a');
		expect(Memo.type).not.toBe(original);
		expect(warning).not.toHaveBeenCalled();
	});

	test('a patch throwing three times in a row is removed with a toast', async () => {
		const Memo = memo(Greeting);
		const original = Memo.type;

		react.after(Memo, () => {
			throw new Error('patch failed');
		});

		Memo.type({ name: 'a' });
		Memo.type({ name: 'a' });

		expect(Memo.type).not.toBe(original);

		Memo.type({ name: 'a' });

		expect(Memo.type).toBe(original);

		await Bun.sleep(0);

		expect(warning).toHaveBeenCalledTimes(1);
	});

	test('a clean render resets the failure count', () => {
		const Memo = memo(Greeting);
		const original = Memo.type;
		let fail = true;

		react.after(Memo, ({ result }) => {
			if (fail) {
				throw new Error('patch failed');
			}

			return createElement('View', null, result);
		});

		Memo.type({ name: 'a' });
		Memo.type({ name: 'a' });
		fail = false;
		mountBoundary(Memo.type({ name: 'a' })).componentDidMount();
		fail = true;
		Memo.type({ name: 'a' });
		Memo.type({ name: 'a' });

		expect(Memo.type).not.toBe(original);
	});

	test('a throwing instead renders the original it already called once', () => {
		let calls = 0;
		const holder = {
			Greeting: (props: Props) => {
				calls++;

				return Greeting(props);
			},
		};

		react.instead(holder, 'Greeting', ({ original }) => {
			original();

			throw new Error('patch failed');
		});

		expect(textOf(holder.Greeting({ name: 'a' }))).toBe('hi a');
		expect(calls).toBe(1);
	});

	test('a failing tree falls back to the tree Discord rendered in the same pass', () => {
		const Memo = memo(Greeting);

		react.after(Memo, ({ result }) => createElement('View', null, result));

		const boundary = failBoundary(Memo.type({ name: 'a' }));

		// No copy was kept before the first failure, so it renders nothing until the component re-renders.
		expect(boundary.render()).toBeNull();

		const next = Memo.type({ name: 'b' });

		if (!isPatchBoundary(next)) {
			throw new TypeError('Expected a patch boundary.');
		}

		Reflect.set(boundary, 'props', next.props);

		expect(textOf(boundary.render())).toBe('hi b');
		expect(warning).not.toHaveBeenCalled();
	});

	test('the fallback is a copy taken before the patch edits the tree in place', () => {
		type Row = { props: { items: ReactNode[] } };
		// React freezes element props in development, but not an array passed in them.
		const List = memo(() =>
			createElement('View', { items: [createElement('Text', null, 'a')] }),
		);
		let fail = true;

		react.after(List, ({ result }) => {
			if (fail) {
				throw new Error('patch failed');
			}

			(result as Row).props.items.push(createElement('Text', null, 'edited'));
		});

		List.type();
		fail = false;

		const tree = List.type();

		if (!isPatchBoundary(tree)) {
			throw new TypeError('Expected a patch boundary.');
		}

		expect((tree.props.children as Row).props.items).toHaveLength(2);
		expect((tree.props.fallback as Row).props.items).toHaveLength(1);
	});

	test('a stable patch keeps no copy', () => {
		const Memo = memo(Greeting);

		react.after(Memo, ({ result }) => createElement('View', null, result));

		const tree = Memo.type({ name: 'a' });

		if (!isPatchBoundary(tree)) {
			throw new TypeError('Expected a patch boundary.');
		}

		expect('fallback' in tree.props).toBe(false);
	});

	test('a tree failing three times removes every patch that built it', async () => {
		const Memo = memo(Greeting);
		const original = Memo.type;

		react.after(Memo, ({ result }) => createElement('View', null, result));
		react.after(Memo, ({ result }) => createElement('View', null, result));

		failBoundary(Memo.type({ name: 'a' }));
		failBoundary(Memo.type({ name: 'a' }));

		expect(Memo.type).not.toBe(original);

		failBoundary(Memo.type({ name: 'a' }));

		expect(Memo.type).toBe(original);

		await Bun.sleep(0);

		expect(warning).toHaveBeenCalledTimes(2);
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
