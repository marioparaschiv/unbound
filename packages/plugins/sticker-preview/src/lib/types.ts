import type * as Flux from '@unbound-app/api/flux';

import type { Sticker } from '@unbound-plugins/shared/stickers/staged-stickers';

export type StickerProps = { animated: boolean; opaque: boolean; size: number; sticker: Sticker };

export type SlowmodeChannel = Flux.FluxChannel & { rateLimitPerUser?: number };

export type DraftStore = Flux.FluxStore & {
	getDraft(channelId: string, type: number): string | undefined;
};

export type SelectedChannels = Flux.SelectedChannelStore & {
	getCurrentlySelectedChannelId(): string | undefined;
};

declare module '@unbound-app/api/flux' {
	interface FluxStores {
		Draft: DraftStore;
	}
}
