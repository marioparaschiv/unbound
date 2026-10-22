import { afterEach, expect, mock, test } from 'bun:test';

type Element = {
	props: Record<string, unknown>;
	type: unknown;
};

type RightActionsProps = {
	shouldShowGiftButton: boolean;
};

type PatchContext = {
	args: unknown[];
	original: (...args: unknown[]) => unknown;
	result?: unknown;
	this: unknown;
};

const giftComponent = () => ({ type: 'Gift', props: {} });
const giftHolder = { type: giftComponent };
const giftModule = { default: giftHolder };
const rightHolder = {
	render: (props: RightActionsProps): Element => ({
		type: 'View',
		props: {
			children: [
				{
					type: 'TransitionItem',
					props: {
						item: {},
						renderItem: (): Element | null =>
							props.shouldShowGiftButton ? { type: giftHolder, props: {} } : null,
					},
				},
				{ type: 'Expression', props: {} },
			],
		},
	}),
};
const rightModule = { default: rightHolder };

function patch(
	target: object,
	name: string,
	handler: (context: PatchContext) => unknown,
	mode: 'after' | 'instead',
): () => void {
	const holder = target as Record<string, (...args: unknown[]) => unknown>;
	const original = holder[name];
	holder[name] = function (...args: unknown[]): unknown {
		if (mode === 'instead') return handler({ args, original, this: this });
		const result = original.apply(this, args);
		return handler({ args, original, result, this: this }) ?? result;
	};
	return () => {
		holder[name] = original;
	};
}

mock.module('@unbound-app/api', () => ({
	metro: {
		common: {
			React: {
				Children: { toArray: (children: Element[]): Element[] => children },
				cloneElement: (
					element: Element,
					_props: unknown,
					...children: Element[]
				): Element => ({
					...element,
					props: { ...element.props, children },
				}),
			},
		},
		findByFilePath: (path: string) =>
			path.includes('GiftOrThread') ? giftModule : rightModule,
	},
	patcher: {
		after: (target: object, name: string, handler: (context: PatchContext) => unknown) =>
			patch(target, name, handler, 'after'),
		instead: (target: object, name: string, handler: (context: PatchContext) => unknown) =>
			patch(target, name, handler, 'instead'),
	},
}));

const { default: plugin } = await import('./index');

afterEach(() => plugin.stop());

test('removes the wrapped gift component from composer actions', () => {
	plugin.start();
	const rightActions = rightHolder.render({ shouldShowGiftButton: true });

	expect(rightActions.props.children).toEqual([{ type: 'Expression', props: {} }]);
	expect(
		(rightHolder.render({ shouldShowGiftButton: false }).props.children as Element[])[0].type,
	).toBe('TransitionItem');
});
