import type { FluxStore } from '@unbound-app/api/flux';

export type { Sticker } from '@unbound-plugins/shared/stickers/staged-stickers';

export type DraftStore = FluxStore & {
	getDraft(channelId: string, draftType: number): string | undefined;
};

declare module '@unbound-app/api/flux' {
	interface FluxStores {
		Draft: DraftStore;
	}
}
