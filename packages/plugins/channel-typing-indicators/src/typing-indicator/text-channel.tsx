import { patcher } from '@unbound-app/api';

import ChannelTypingIndicator from '~/typing-indicator/components/channel-typing-indicator';
import { replaceChild, withChildren } from '~/typing-indicator/elements';
import { findTextChannelSlot, type RenderNode } from '~/typing-indicator/row-layout';
import { TextChannel } from '~/typing-indicator/modules';
import type { ChannelRowProps } from '~/types';
import { INDICATOR_KEY } from '~/constants';

/**
 * @description Shows the typing indicator in text channel rows, just before the channel info.
 */
export function patchTextChannel(): void {
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
