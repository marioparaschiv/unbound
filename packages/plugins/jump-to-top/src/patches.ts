import { metro, patcher, utils } from '@unbound-app/api';
import { messages } from '@unbound-app/i18n';
import { cloneElement, isValidElement, type ReactElement } from 'react';

const CHANNEL_ACTIONS = 'modules/main_tabs_v2/native/channel/ChannelActions.tsx';
const JUMP_KEY = 'unbound-jump-to-top';

type Channel = { id: string; isForumPost?(): boolean };

type ButtonRow = ReactElement<{ children?: unknown }>;

let freshTargetBelowFirstMessage = 0;

function jumpToTop(channelId: string): void {
	freshTargetBelowFirstMessage += 1;
	metro.api.Messages.jumpToMessage({
		channelId,
		messageId: String(freshTargetBelowFirstMessage),
		flash: false,
		jumpType: 'INSTANT',
	});
}

const isIconButton = (node: unknown): node is ReactElement =>
	isValidElement(node) && utils.react.findComponent(node, 'IconActionButton') === node;

function buttonList(children: unknown): unknown[] | undefined {
	if (!Array.isArray(children)) return;

	if (children.some(isIconButton)) return children;

	for (const child of children) {
		const list = buttonList(child);

		if (list) return list;
	}
}

function addJumpButton(row: ButtonRow, channel: Channel | undefined): void {
	if (!channel || channel.isForumPost?.()) return;

	const buttons = buttonList(row.props.children);
	const search = buttons?.find(isIconButton);
	const ArrowLargeUpIcon = metro.findByProps('ArrowLargeUpIcon')?.ArrowLargeUpIcon;

	if (!buttons || !search || !ArrowLargeUpIcon) return;

	if (buttons.some((button) => isValidElement(button) && button.key === JUMP_KEY)) return;

	buttons.unshift(
		cloneElement(search, {
			key: JUMP_KEY,
			noMargin: false,
			IconComponent: ArrowLargeUpIcon,
			accessibilityLabel: messages.JUMP_TO_TOP,
			onPress: () => jumpToTop(channel.id),
		} as Record<string, unknown>),
	);
}

function patchButtonRow(element: ReactElement): void {
	patcher.react.after(
		element,
		'type',
		({ props, result }) => {
			if (isValidElement(result))
				addJumpButton(result as ButtonRow, (props as { channel?: Channel }).channel);
		},
		{ once: true },
	);
}

/**
 * @description Adds a jump-to-top arrow beside the search button in the channel header.
 * Patches `ChannelActions`, then its `WrappedChannelNavButtons` and `ChannelActionButtons` for one render each.
 */
export function patchChannelActions(): void {
	const ChannelActions = metro.findByFilePath(CHANNEL_ACTIONS);

	if (typeof ChannelActions?.default !== 'function') {
		logger.warn('Jump to top skipped: Discord moved ChannelActions.');

		return;
	}

	patcher.react.after(ChannelActions, 'default', ({ result }) => {
		const wrapped = utils.react.findComponent(result, 'WrappedChannelNavButtons');

		if (!wrapped) return;

		patcher.react.after(
			wrapped,
			'type',
			({ result: nav }) => {
				if (isValidElement(nav) && typeof nav.type === 'function') patchButtonRow(nav);
			},
			{ once: true },
		);
	});
}
