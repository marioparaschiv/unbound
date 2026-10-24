import ChannelTypingIndicator from '~/components/channel-typing-indicator';
import { findTextChannelSlot } from '~/row-layout';
import type { ChannelRowProps } from '~/types';
import { Patcher, TextChannel } from '~/modules';
import { INDICATOR_KEY } from '~/constants';
import { replaceChild, withChildren } from '~/elements';

/**
 * @description Shows the typing indicator in text channel rows, just before the channel info.
 * @returns A function that removes the patch.
 */
export function patchTextChannel(): () => void {
	if (typeof TextChannel.default?.type !== 'function') {
		console.error('[Channel Typing Indicators] Skipped text channels, the row is not a memo.');

		return () => {};
	}

	return Patcher.after(TextChannel.default, 'type', ({ args: [props], result }) => {
		const { channel, muted } = props as ChannelRowProps;

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
