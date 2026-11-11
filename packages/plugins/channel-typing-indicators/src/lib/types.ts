import type { FluxStore } from '@unbound-app/api/flux';

export type Channel = { id: string; guild_id?: string };
export type ChannelRowProps = { channel?: Channel; muted?: boolean };

declare module '@unbound-app/api/flux' {
	interface FluxStores {
		UserGuildSettings: FluxStore & {
			isChannelMuted?(guildId: string | undefined, channelId: string): boolean;
		};
	}
}
