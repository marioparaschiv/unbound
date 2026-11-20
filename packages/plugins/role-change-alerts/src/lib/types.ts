import type { FluxStore } from '@unbound-app/api/flux';

declare module '@unbound-app/api/flux' {
	interface FluxActions {
		GUILD_MEMBER_UPDATE: { guildId?: string; user?: { id?: string }; roles?: string[] };
	}

	interface FluxStores {
		GuildRole: FluxStore & {
			getRole?(guildId: string, roleId: string): { name?: string } | undefined;
		};
	}
}
