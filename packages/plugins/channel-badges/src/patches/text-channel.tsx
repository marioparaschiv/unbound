import { replaceChild, withChildren } from '@unbound-plugins/shared/react/element-children';
import { findTextChannelSlot, type RenderNode } from '@unbound-plugins/shared/channels/row-layout';
import { metro, patcher } from '@unbound-app/api';

import ChannelBadges from '~/components/channel-badges';
import type { ChannelRowProps } from '~/lib/types';
import { BADGES_KEY } from '~/lib/constants';

/**
 * @description Shows a text channel row's badges right after its name, by patching the render of Discord's `TextChannel`.
 */
export function patchTextChannel(): void {
	const TextChannel = metro.findByFilePath(
		'modules/channel_list_v2/native/items/TextChannel.tsx',
		{
			interop: false,
		},
	);

	if (!TextChannel) {
		logger.warn('Channel badges skipped: Discord moved TextChannel.');

		return;
	}

	patcher.react.after(TextChannel, 'default', ({ props, result: rendered }) => {
		const { channel } = props as ChannelRowProps;
		const result = rendered as RenderNode;

		if (!channel?.id) return;

		const slot = findTextChannelSlot(result, channel.id, BADGES_KEY);

		if (!slot) return;

		const parts = [
			...slot.parts.slice(0, slot.index + 1),
			<ChannelBadges key={BADGES_KEY} channel={channel} />,
			...slot.parts.slice(slot.index + 1),
		];

		return replaceChild(
			result,
			slot.row,
			replaceChild(slot.row, slot.content, withChildren(slot.content, parts)),
		);
	});
}

export default patchTextChannel;
