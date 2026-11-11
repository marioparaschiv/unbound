import { metro, patcher } from '@unbound-app/api';

import ChannelTypingIndicator from '~/components/channel-typing-indicator';
import { replaceChild, withChildren } from '~/lib/elements';
import { findTextChannelSlot, type RenderNode } from '~/lib/row-layout';
import type { ChannelRowProps } from '~/lib/types';
import { INDICATOR_KEY } from '~/lib/constants';

/**
 * @description Shows the typing indicator in text channel rows, just before the channel info, by patching the render of
 * Discord's `TextChannel`.
 */
export function patchTextChannel(): void {
	const TextChannel = metro.findByFilePath(
		'modules/channel_list_v2/native/items/TextChannel.tsx',
		{
			interop: false,
		},
	);
	const { Theme } = metro.common;

	if (!TextChannel || !Theme) {
		logger.warn('Text channels skipped: Discord moved TextChannel or Theme.');

		return;
	}

	patcher.react.after(TextChannel, 'default', ({ props, result: rendered }) => {
		const { channel, muted } = props as ChannelRowProps;
		const result = rendered as RenderNode;

		if (!channel?.id) return;

		const slot = findTextChannelSlot(result, channel.id);

		if (!slot) return;

		const indicator = (
			<ChannelTypingIndicator key={INDICATOR_KEY} channel={channel} muted={Boolean(muted)} />
		);
		const parts = [
			...slot.parts.slice(0, slot.index),
			indicator,
			...slot.parts.slice(slot.index),
		];
		const content = withChildren(slot.content, parts);

		return replaceChild(result, slot.row, replaceChild(slot.row, slot.content, content));
	});
}
