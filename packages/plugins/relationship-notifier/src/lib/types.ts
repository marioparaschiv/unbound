import type { FluxStore } from '@unbound-app/api/flux';

declare module '@unbound-app/api/flux' {
	interface FluxActions {
		GUILD_DELETE: { guild?: { id?: string; unavailable?: boolean } };
		CHANNEL_DELETE: { channel?: { id?: string; type?: number } };
		RELATIONSHIP_REMOVE: { relationship?: { id?: string; type?: number } };
	}

	interface FluxStores {
		GuildAvailability: FluxStore & { isUnavailable?(guildId: string): boolean };
		GatewayConnection: FluxStore & { isConnected?(): boolean };
		Lurking: FluxStore & { isLurking?(guildId: string): boolean };
	}
}
