import { cloneElement, type ReactElement, type ReactNode } from 'react';
import { metro, patcher } from '@unbound-app/api';

import ThreadChannelInfo from '~/components/thread-channel-info';
import { findThreadChannelSlot, type RenderNode } from '~/lib/row-layout';
import { replaceChild } from '~/lib/elements';
import type { ChannelRowProps } from '~/lib/types';
import { INDICATOR_KEY } from '~/lib/constants';

type RowRenderer = (props: ChannelRowProps) => ReactNode;
type ThreadRowProps = { channelInfo: ReactNode };
type HookedRenderer = {
	type: RowRenderer;
	host: { render: RowRenderer };
	unpatch: () => void;
};

function addIndicator(result: RenderNode, { channel, muted }: ChannelRowProps) {
	if (!channel?.id) return;

	const slot = findThreadChannelSlot(result, channel.id);

	if (!slot) return;

	const row = cloneElement(slot.row as ReactElement<ThreadRowProps>, {
		channelInfo: (
			<ThreadChannelInfo
				key={INDICATOR_KEY}
				info={slot.row.props?.channelInfo}
				channel={channel}
				muted={Boolean(muted)}
			/>
		),
	});

	return replaceChild(result, slot.container, replaceChild(slot.container, slot.row, row));
}

/**
 * @description Shows the typing indicator in thread rows, after the thread's channel info, by patching the render of
 * Discord's `ThreadChannel`.
 */
export function patchThreadChannel(): void {
	const ThreadChannel = metro.findByFilePath(
		'modules/channel_list_v2/native/items/ThreadChannel.tsx',
		{ interop: false },
	);
	const { Theme } = metro.common;

	if (!ThreadChannel || !Theme) {
		logger.warn('Thread channels skipped: Discord moved ThreadChannel or Theme.');

		return;
	}

	let hooked: HookedRenderer | undefined;

	// The row renders an inner function component, which the patcher can only hook through a
	// holder object. The hook is redone only when Discord hands back a different component.
	function hookedRenderer(type: RowRenderer): RowRenderer {
		if (hooked?.type !== type) {
			hooked?.unpatch();

			const host = { render: type };
			const unpatch = patcher.after(host, 'render', ({ args: [props], result }) =>
				addIndicator(result as RenderNode, props),
			);

			hooked = { type, host, unpatch };
		}

		return hooked.host.render;
	}

	patcher.react.after(ThreadChannel, 'default', ({ result: rendered }) => {
		const result = rendered as ReactElement<ChannelRowProps> | null | undefined;

		if (typeof result?.type !== 'function') return;

		const Renderer = hookedRenderer(result.type as RowRenderer);

		return <Renderer {...result.props} key={result.key} />;
	});
}
