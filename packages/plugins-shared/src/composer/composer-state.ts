import { Dimensions } from 'react-native';
import { useRef } from 'react';
import type { FluxStore } from '@unbound-app/api/flux';
import { flux } from '@unbound-app/api';

import { composerState, type ComposerState } from './composer-layout';

declare module '@unbound-app/api/flux' {
	// oxlint-disable-next-line typescript/consistent-type-definitions -- merging needs an interface.
	interface FluxStores {
		Draft: FluxStore & { getDraft(channelId: string, draftType: number): string | undefined };
		UploadAttachment: FluxStore & {
			getUploadCount(channelId: string, draftType: number): number;
		};
	}
}

const CHANNEL_MESSAGE_DRAFT = 0;
const AVERAGE_CHARACTER_WIDTH = 8.5;
const RESERVED_WIDTH = 150;
const BUTTON_WIDTH = 40;

function charactersPerLine(buttonCount: number): number {
	const width = Dimensions.get('window').width - RESERVED_WIDTH - buttonCount * BUTTON_WIDTH;

	return Math.max(0, Math.floor(width / AVERAGE_CHARACTER_WIDTH));
}

/**
 * @description Follows what a channel's chat input holds, so its buttons can hide while it is empty and stack once it is crowded.
 * @param channelId The channel whose input to follow.
 * @param buttonCount How many plugin buttons share the input's row, which narrows the line the draft gets.
 * @returns The composer state.
 */
export function useComposerState(channelId: string, buttonCount = 0): ComposerState {
	const DraftStore = flux.getStore('Draft');
	const UploadStore = flux.getStore('UploadAttachment');
	const draft = flux.useStore(
		DraftStore,
		() => DraftStore.getDraft(channelId, CHANNEL_MESSAGE_DRAFT) ?? '',
		{ deps: [channelId] },
	);
	const uploads = flux.useStore(
		UploadStore,
		() => UploadStore.getUploadCount(channelId, CHANNEL_MESSAGE_DRAFT) ?? 0,
		{ deps: [channelId] },
	);

	const previous = useRef<ComposerState | undefined>(undefined);

	previous.current = composerState(
		draft,
		uploads,
		charactersPerLine(buttonCount),
		previous.current,
	);

	return previous.current;
}

export type { ComposerState };

export default useComposerState;
