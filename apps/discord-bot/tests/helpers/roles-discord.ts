import { DiscordAPIError, RESTJSONErrorCodes } from 'discord.js';

import type {
	JoinedMember,
	RolesClient,
	RolesGuild,
	RolesMember,
	RolesRole,
} from '~/dispatchers/roles';

export type FakeDiscordOptions = {
	guildId?: string;
	/** Role ids each guild member holds, by Discord id; anyone else is not in the guild. */
	members: Record<string, string[]>;
	guildRoles?: RolesRole[];
	/** Role ids at or above the bot's highest role. */
	aboveBot?: string[];
	manageRoles?: boolean;
	/** Discord ids whose role adds reject. */
	failAdd?: string[];
};

export type Added = { discordId: string; roleId: string };

export type FakeDiscord = {
	client: RolesClient;
	added: Added[];
	fetched: string[];
	listeners: number;
	/** Adds the member to the guild and fires `guildMemberAdd`. */
	join: (discordId: string, guildId?: string) => void;
	/** The roles a member holds now; a moderator may edit the set. */
	held: (discordId: string) => Set<string> | undefined;
};

export const FAKE_GUILD_ID = 'guild-1';

export const GUILD_ROLES: RolesRole[] = [
	{ id: 'r-c', name: 'Contributor', position: 1 },
	{ id: 'r-a', name: 'Addon Developer', position: 2 },
	{ id: 'r-s', name: 'Sponsor', position: 3 },
];

const BOT_ROLE: RolesRole = { id: 'r-bot', name: 'Unbound', position: 5 };

/**
 * @description A guild with one bot member, recording every fetch and role add.
 * @param options Members, guild roles, hierarchy and permission.
 * @returns The client, the recorded calls and `join()`.
 */
export function fakeDiscord(options: FakeDiscordOptions): FakeDiscord {
	const {
		guildId = FAKE_GUILD_ID,
		guildRoles = GUILD_ROLES,
		aboveBot = [],
		manageRoles = true,
		failAdd = [],
	} = options;
	const members = new Map(
		Object.entries(options.members).map(([id, roles]) => [id, new Set(roles)]),
	);
	const roles = new Map(guildRoles.map((role) => [role.id, role]));
	const listeners: ((member: JoinedMember) => void)[] = [];
	const added: Added[] = [];
	const fetched: string[] = [];

	function memberOf(discordId: string, held: Set<string>): RolesMember {
		const fake: RolesMember = {
			roles: {
				cache: held,
				async add(roleId) {
					if (failAdd.includes(discordId)) {
						throw new Error(`Missing Permissions for ${discordId}`);
					}

					held.add(roleId);
					added.push({ discordId, roleId });

					return fake;
				},
			},
		};

		return fake;
	}

	const guild: RolesGuild = {
		roles: { cache: roles },
		members: {
			me: {
				permissions: { has: () => manageRoles },
				roles: {
					highest: {
						...BOT_ROLE,
						comparePositionTo: (roleId) => (aboveBot.includes(roleId) ? 0 : 1),
					},
				},
			},
			async fetch({ user }) {
				fetched.push(user);

				const held = members.get(user);

				if (!held) {
					throw new DiscordAPIError(
						{ code: RESTJSONErrorCodes.UnknownMember, message: 'Unknown Member' },
						RESTJSONErrorCodes.UnknownMember,
						404,
						'GET',
						`/guilds/${guildId}/members/${user}`,
						{},
					);
				}

				return memberOf(user, held);
			},
		},
	};

	return {
		client: {
			guilds: {
				async fetch(id) {
					if (id !== guildId) {
						throw new Error(`Unknown guild ${id}`);
					}

					return guild;
				},
			},
			on(_, listener) {
				listeners.push(listener);
			},
		},
		added,
		fetched,
		get listeners() {
			return listeners.length;
		},
		join(discordId, joinedGuildId = guildId) {
			members.set(discordId, members.get(discordId) ?? new Set());

			for (const listener of listeners) {
				listener({ id: discordId, guild: { id: joinedGuildId } });
			}
		},
		held: (discordId) => members.get(discordId),
	};
}
