import { flux } from '@unbound-app/api';
import type { ReactNode } from 'react';

/** Draws a chat input toggle for a channel, with a gap after it. */
export type ToggleButtonFactory = (channelId: string, trailingGap: number) => ReactNode;

type ChannelProps = { channel?: { id?: string } };

/**
 * @description Reads the channel a chat input part belongs to, falling back to the selected channel.
 * @param props The part's props.
 * @returns The channel id, when there is one.
 */
export function channelOf(props: ChannelProps): string | undefined {
	return props.channel?.id ?? flux.getStore('SelectedChannel').getChannelId() ?? undefined;
}

export default channelOf;
