import { cloneElement, type ReactElement, type ReactNode } from 'react';
import { patcher } from '@unbound-app/api';

import ThreadChannelInfo from '~/typing-indicator/components/thread-channel-info';
import { findThreadChannelSlot, type RenderNode } from '~/typing-indicator/row-layout';
import { ThreadChannel } from '~/typing-indicator/modules';
import { replaceChild } from '~/typing-indicator/elements';
import type { ChannelRowProps } from '~/types';
import { INDICATOR_KEY } from '~/constants';

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
 * @description Shows the typing indicator in thread rows, after the thread's channel info.
 */
export function patchThreadChannel(): void {
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
