import { cloneElement, type ReactElement, type ReactNode } from 'react';

import ThreadChannelInfo from '~/components/thread-channel-info';
import { findThreadChannelSlot, type RenderNode } from '~/row-layout';
import { Patcher, ThreadChannel } from '~/modules';
import type { ChannelRowProps } from '~/types';
import { INDICATOR_KEY } from '~/constants';
import { replaceChild } from '~/elements';

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
 * @returns A function that removes the patches.
 */
export function patchThreadChannel(): () => void {
	if (typeof ThreadChannel.default !== 'function') {
		console.error('[Channel Typing Indicators] Skipped threads, the row is not a function.');

		return () => {};
	}

	let hooked: HookedRenderer | undefined;

	// The row renders an inner function component, which the patcher can only hook through a
	// holder object. The hook is redone only when Discord hands back a different component.
	function hookedRenderer(type: RowRenderer): RowRenderer {
		if (hooked?.type !== type) {
			hooked?.unpatch();

			const host = { render: type };
			const unpatch = Patcher.after(host, 'render', ({ args: [props], result }) =>
				addIndicator(result as RenderNode, props),
			);

			hooked = { type, host, unpatch };
		}

		return hooked.host.render;
	}

	const unpatch = Patcher.after(ThreadChannel, 'default', ({ result }) => {
		if (typeof result?.type !== 'function') return;

		const Renderer = hookedRenderer(result.type);

		return <Renderer {...result.props} key={result.key} />;
	});

	return () => {
		unpatch();
		hooked?.unpatch();
	};
}
