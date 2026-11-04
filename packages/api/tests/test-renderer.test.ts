import {
	createContext,
	Component,
	createElement,
	forwardRef,
	memo,
	useContext,
	useEffect,
	useReducer,
	useState,
	type ReactNode,
} from 'react';
import { describe, expect, test } from 'bun:test';

import { act, createTestRenderer, formatIcu, queriesOf } from '../testing';

function render(element: ReactNode) {
	const renderer = createTestRenderer(element);

	return { ...renderer, ...queriesOf(renderer.root) };
}

type LabelState = { clicks: number; seen: string };

type PrefixProps = { prefix: string };

type PressProps = { onPress: () => void };

describe('createTestRenderer', () => {
	test('keeps hook state across re-renders and batches updates in act', () => {
		let renders = 0;
		let increment = () => {};

		function Counter({ label }: { label: string }) {
			const [count, setCount] = useState(0);

			renders++;
			increment = () => setCount((value) => value + 1);

			return createElement('Text', null, label, ': ', count);
		}

		const view = render(createElement(Counter, { label: 'Stars' }));

		act(() => {
			increment();
			increment();
		});

		expect(view.text()).toBe('Stars: 2');
		expect(renders).toBe(2);

		view.update(createElement(Counter, { label: 'Hearts' }));
		expect(view.text()).toBe('Hearts: 2');
	});

	test('reads context, unwraps memo and forwardRef, and names them for find', () => {
		const Theme = createContext('light');
		const Label = memo(function Label() {
			return createElement('Text', null, useContext(Theme));
		});
		const Field = forwardRef<string, object>(function Field(_props, ref) {
			return createElement('View', { ref }, createElement(Label));
		});

		const view = render(createElement(Theme, { value: 'dark' }, createElement(Field)));

		expect(view.find('Label').text()).toBe('dark');
		expect(view.find('Field').find('View').children).toHaveLength(1);
	});

	test('runs effects after render, cleans them up on a deps change and on unmount', () => {
		const log: string[] = [];
		let set = (_value: number) => {};

		function Effect() {
			const [value, setValue] = useReducer((_: number, next: number) => next, 0);

			set = setValue;

			useEffect(() => {
				log.push(`run ${value}`);

				return () => void log.push(`clean ${value}`);
			}, [value]);

			return null;
		}

		const view = render(createElement(Effect));

		set(0);
		set(1);
		view.unmount();
		set(2);

		expect(log).toEqual(['run 0', 'clean 0', 'run 1', 'clean 1']);
	});

	test('keeps keyed children with their state when they reorder', () => {
		function Item({ id }: { id: string }) {
			const [created] = useState(() => `${id} created`);

			return createElement('Text', null, created);
		}

		const list = (ids: string[]) =>
			createElement(
				'View',
				null,
				ids.map((id) => createElement(Item, { key: id, id })),
			);
		const view = render(list(['a', 'b']));

		view.update(list(['b', 'a']));

		expect(view.findAll('Text').map((node) => node.text())).toEqual(['b created', 'a created']);
	});
});

describe('formatIcu', () => {
	test('applies plural offsets, nested selects and numbers in the locale', () => {
		const message =
			'{count, plural, offset:1 =0 {nobody} =1 {{name}} one {{name} and # other} other {{name} and # others}}';

		expect(formatIcu(message, { count: 1, name: 'Ana' })).toBe('Ana');
		expect(formatIcu(message, { count: 2, name: 'Ana' })).toBe('Ana and 1 other');
		expect(formatIcu(message, { count: 3, name: 'Ana' })).toBe('Ana and 2 others');
		expect(formatIcu('{n, number}', { n: 1234.5 }, 'de')).toBe('1.234,5');
		expect(
			formatIcu(
				'{g, select, f {{n, plural, one {# Frau} other {# Frauen}}} other {?}}',
				{ g: 'f', n: 2 },
				'de',
			),
		).toBe('2 Frauen');
	});

	test('throws naming a missing value or a syntax error', () => {
		expect(() => formatIcu('{name} is here')).toThrow('no value for {name}');
		expect(() => formatIcu('{count, plural, one {#}}', { count: 2 })).toThrow(
			'{count} has no "other" branch',
		);
		expect(() => formatIcu('{count, plural, one {#}')).toThrow('Expected "}" at character 24');
	});

	test('renders class components with state, context, derived state and lifecycle', () => {
		const log: string[] = [];
		const Theme = createContext('dark');

		class Label extends Component<PrefixProps, LabelState> {
			static contextType = Theme;
			declare context: string;
			state = { clicks: 0, seen: '' };

			static getDerivedStateFromProps(props: PrefixProps) {
				return { seen: props.prefix };
			}

			componentDidMount() {
				log.push('mount');
			}

			componentDidUpdate(previous: PrefixProps) {
				log.push(`update ${previous.prefix}->${this.props.prefix}`);
			}

			componentWillUnmount() {
				log.push('unmount');
			}

			render() {
				return createElement(
					'Pressable',
					{ onPress: () => this.setState({ clicks: this.state.clicks + 1 }) },
					`${this.state.seen}:${this.context}:${this.state.clicks}`,
				);
			}
		}

		const { find, text, update, unmount } = render(createElement(Label, { prefix: 'a' }));

		expect(text()).toBe('a:dark:0');

		act(() => find<PressProps>('Pressable').props.onPress());
		expect(text()).toBe('a:dark:1');

		update(createElement(Label, { prefix: 'b' }));
		expect(text()).toBe('b:dark:1');

		unmount();
		expect(log).toEqual(['mount', 'update a->a', 'update a->b', 'unmount']);
	});
});
