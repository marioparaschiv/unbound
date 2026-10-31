import type { FluxStore } from '@unbound-app/api/flux';

export type DraftStore = FluxStore & {
	getDraft(channelId: string, draftType: number): string | undefined;
};

declare module '@unbound-app/api/flux' {
	interface FluxStores {
		Draft: DraftStore;
	}
}
