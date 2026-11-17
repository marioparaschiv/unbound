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
import { assets, plugins } from '@unbound-app/api';

import useButtonStyles from './input-button.style';
import { buttonsFit, useComposerState } from './composer-state';

type ParentProps = { children?: ReactNode };

/** Draws one plugin's chat input button with the gap that should follow it. */
export type ComposerButtonDraw = (trailingGap: number) => ReactNode;

type StackProps = {
	unboundComposerStack: true;
	channelId: string;
	draws: ComposerButtonDraw[];
	/** Each draw's button key, by index; bundles that predate keys leave theirs out. */
	keys?: (string | undefined)[];
	target: ReactNode;
	inline: 'row' | 'prepend';
	rowGap: number;
	hideTargetWhenEmpty?: boolean;
};

type HiddenProps = { channelId: string; target: ReactNode };

/** A plugin's chat input button: its key and how to draw it. */
export type ComposerButton = { key?: string; draw: ComposerButtonDraw };

const PANEL_ID = 'unbound.plugin-shortcut-panel';
const PANEL_KEY = 'plugin-shortcut-panel';
const REGISTRY_KEY = '__unboundComposerButtons';

type ButtonRegistry = Map<string, ComposerButton[]>;

function buttonRegistry(): ButtonRegistry {
	const holder = globalThis as unknown as Record<typeof REGISTRY_KEY, ButtonRegistry | undefined>;

	holder[REGISTRY_KEY] ??= new Map();

	return holder[REGISTRY_KEY];
}

/**
 * @description Lists the chat input buttons other plugins added in a channel, for the Plugin Shortcut Panel to show.
 * @param channelId The channel.
 * @returns The buttons, without the panel's own, as the chat input last drew them.
 */
export function composerButtonsFor(channelId: string): ComposerButton[] {
	return buttonRegistry().get(channelId) ?? [];
}

/**
 * @description Whether the chat input's plugin buttons live in the Plugin Shortcut Panel instead of beside the input.
 * @returns Whether the panel is on.
 */
export function buttonsInPanel(): boolean {
	return plugins.isEnabled(PANEL_ID);
}

function placedDraws(channelId: string, draws: ComposerButtonDraw[], keys: StackProps['keys']) {
	const buttons = draws.map((draw, index) => ({ key: keys?.[index], draw }));
	const others = buttons.filter((button) => button.key !== PANEL_KEY);

	buttonRegistry().set(channelId, others);

	return buttonsInPanel() && others.length < buttons.length
		? buttons.filter((button) => button.key === PANEL_KEY).map((button) => button.draw)
		: draws;
}

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
	draws: allDraws,
	keys,
	target,
	inline,
	rowGap,
	hideTargetWhenEmpty = false,
}: StackProps) {
	const draws = placedDraws(channelId, allDraws, keys);
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
 * @param options The channel, how to draw the button, its key and where the group sits.
 * @returns The group to render.
 */
export function withComposerButton(
	target: ReactNode,
	options: {
		channelId: string;
		draw: ComposerButtonDraw;
		key?: string;
		inline: 'row' | 'prepend';
		rowGap: number;
	},
): ReactElement {
	if (isStack(target)) {
		const keys = target.props.keys ?? [];

		return cloneElement(target, {
			draws: [...target.props.draws, options.draw],
			keys: [
				...keys,
				...Array.from({ length: target.props.draws.length - keys.length }, () => undefined),
				options.key,
			],
		});
	}

	return createElement(ComposerStack, {
		unboundComposerStack: true,
		channelId: options.channelId,
		draws: [options.draw],
		keys: [options.key],
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
