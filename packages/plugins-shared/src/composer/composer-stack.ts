import {
	Children,
	cloneElement,
	createElement,
	Fragment,
	isValidElement,
	useState,
	type ReactElement,
	type ReactNode,
} from 'react';
import {
	Image,
	Pressable,
	View,
	type PressableStateCallbackType,
	type ViewStyle,
} from 'react-native';
import { assets } from '@unbound-app/api';

import useButtonStyles from './input-button.style';
import { buttonsFit, useComposerState } from './composer-state';

type ParentProps = { children?: ReactNode };

/** Draws one plugin's chat input button with the gap that should follow it. */
export type ComposerButtonDraw = (trailingGap: number) => ReactNode;

type StackProps = {
	unboundComposerStack: true;
	channelId: string;
	draws: ComposerButtonDraw[];
	target: ReactNode;
	inline: 'row' | 'prepend';
	rowGap: number;
	hideTargetWhenEmpty?: boolean;
};

type HiddenProps = { channelId: string; target: ReactNode };

const ROW = { flexDirection: 'row', alignItems: 'center' } as const;
const COLUMN = { flexDirection: 'column', alignItems: 'flex-end' } as const;
const STACK_GAP = 6;
const GRID_COLUMNS = 2;
const CELL = 40;

function isStack(node: ReactNode): node is ReactElement<StackProps> {
	return isValidElement<Partial<StackProps>>(node) && node.props.unboundComposerStack === true;
}

const GRID = {
	flexDirection: 'row',
	flexWrap: 'wrap',
	justifyContent: 'flex-end',
	width: GRID_COLUMNS * CELL,
	marginBottom: STACK_GAP,
} as const;

const CELL_STYLE = {
	width: CELL,
	height: CELL,
	alignItems: 'center',
	justifyContent: 'center',
} as const;

function cell(button: ReactNode, index: number) {
	return createElement(View, { key: index, style: CELL_STYLE }, button);
}

function buttons(draws: ComposerButtonDraw[], gap: number) {
	return draws.map((draw, index) => createElement(Fragment, { key: index }, draw(gap)));
}

function MoreButton({ open, onPress, gap }: { open: boolean; onPress: () => void; gap: number }) {
	const styles = useButtonStyles();

	return createElement(
		View,
		{ style: { marginRight: gap } },
		createElement(
			Pressable,
			{
				accessibilityRole: 'button',
				accessibilityLabel: open ? 'Hide plugin buttons' : 'Show plugin buttons',
				accessibilityState: { expanded: open },
				onPress,
				hitSlop: 8,
				style: ({ pressed }: PressableStateCallbackType): ViewStyle[] => [
					styles.button,
					{ opacity: pressed ? 0.5 : 1, transform: [{ scale: pressed ? 0.86 : 1 }] },
				],
			},
			createElement(Image, {
				source: assets.getIdByName(open ? 'XSmallIcon' : 'MoreHorizontalIcon'),
				style: styles.icon,
			}),
		),
	);
}

function inlineGroup(inline: StackProps['inline'], shown: ReactNode, children: ReactNode[]) {
	if (inline === 'prepend' && isValidElement<ParentProps>(shown)) {
		return cloneElement(
			shown,
			undefined,
			...children,
			...Children.toArray(shown.props.children),
		);
	}

	return createElement(View, { style: ROW }, ...children, shown);
}

/**
 * @description Draws every plugin's chat input buttons as one group beside the target. Once the draft is crowded they fold
 * into one button, so the draft keeps its width, and that button opens them in a two-column grid above the target.
 * `row` wraps the target in a row with the buttons first; `prepend` adds them as the target's first children.
 */
export function ComposerStack({
	channelId,
	draws,
	target,
	inline,
	rowGap,
	hideTargetWhenEmpty = false,
}: StackProps) {
	const state = useComposerState(channelId, draws.length);
	const [open, setOpen] = useState(false);
	const shown = hideTargetWhenEmpty && state === 'empty' ? null : target;

	if (state !== 'crowded' && buttonsFit(draws.length)) {
		if (open) setOpen(false);

		return inlineGroup(inline, shown, buttons(draws, rowGap));
	}

	const more = createElement(MoreButton, {
		key: 'more',
		open,
		gap: rowGap,
		onPress: () => setOpen(!open),
	});

	if (!open || draws.length < 2) {
		return inlineGroup(inline, shown, draws.length < 2 ? buttons(draws, rowGap) : [more]);
	}

	return createElement(
		View,
		{ style: COLUMN },
		createElement(View, { style: GRID }, buttons(draws, 0).map(cell)),
		inlineGroup(inline, shown, [more]),
	);
}

function HiddenWhileEmpty({ channelId, target }: HiddenProps) {
	return useComposerState(channelId, 0) === 'empty' ? null : target;
}

/**
 * @description Adds a button to the chat input's shared group, joining the group another plugin already made around the target.
 * @param target What Discord rendered, or another plugin's group.
 * @param options The channel, how to draw the button and where the group sits.
 * @returns The group to render.
 */
export function withComposerButton(
	target: ReactNode,
	options: {
		channelId: string;
		draw: ComposerButtonDraw;
		inline: 'row' | 'prepend';
		rowGap: number;
	},
): ReactElement {
	if (isStack(target)) {
		return cloneElement(target, { draws: [...target.props.draws, options.draw] });
	}

	return createElement(ComposerStack, {
		unboundComposerStack: true,
		channelId: options.channelId,
		draws: [options.draw],
		target,
		inline: options.inline,
		rowGap: options.rowGap,
	});
}

/**
 * @description Hides the target, such as the send button, while the chat input is empty, inside any group of buttons around it.
 * @param target What Discord rendered, or another plugin's group.
 * @param channelId The channel whose input to follow.
 * @returns The element to render.
 */
export function hideTargetWhileEmpty(target: ReactNode, channelId: string): ReactElement {
	if (isStack(target)) return cloneElement(target, { hideTargetWhenEmpty: true });

	return createElement(HiddenWhileEmpty, { channelId, target });
}

export default ComposerStack;
