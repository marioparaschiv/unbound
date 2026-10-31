export type FakeDiscordUser = {
	username: string;
	global_name?: string | null;
	avatar?: string | null;
	banner?: string | null;
	/** The banner they set for a guild alone, served by every member lookup. */
	member_banner?: string | null;
};

export type FakeDiscordRequest = {
	path: string;
	authorization: string | null;
};

export type FakeDiscordOverride = (id: string) => Response | Promise<Response> | undefined;

/** Answers a guild member request in place of the fake, given the member's user id. */
export type FakeMembersOverride = (id: string) => Response | Promise<Response> | undefined;

export type FakeDiscordOptions = {
	/** The role ids each user holds in each guild, by guild id, then user id. */
	guilds?: Record<string, Record<string, string[]>>;
	/** The port to listen on; a free one when omitted. */
	port?: number;
};

export type FakeDiscord = {
	url: URL;
	apiUrl: string;
	users: Map<string, FakeDiscordUser>;
	/** Each guild's members and their role ids; edit it to change what the next lookup returns. */
	guilds: Map<string, Map<string, string[]>>;
	requests: FakeDiscordRequest[];
	override(handler: FakeDiscordOverride | null): void;
	overrideMembers(handler: FakeMembersOverride | null): void;
	stop(): Promise<void>;
};

const NOT_FOUND = { message: '404: Not Found', code: 0 };

/**
 * @description Serves a fake Discord `GET /api/v10/users/{id}` and
 * `GET /api/v10/guilds/{id}/members/{user id}` that records every request.
 * @param users The known users by id.
 * @param options The guild members and the port.
 * @returns The running fake.
 */
export function serveDiscord(
	users: Record<string, FakeDiscordUser> = {},
	options: FakeDiscordOptions = {},
): FakeDiscord {
	const known = new Map(Object.entries(users));
	const guilds = new Map(
		Object.entries(options.guilds ?? {}).map(([id, members]) => [
			id,
			new Map(Object.entries(members)),
		]),
	);
	const requests: FakeDiscordRequest[] = [];
	let handler: FakeDiscordOverride | null = null;
	let membersHandler: FakeMembersOverride | null = null;

	function readMember(guildId: string, id: string) {
		const members = guilds.get(guildId);

		if (!members) {
			return Response.json({ message: 'Unknown Guild', code: 10004 }, { status: 404 });
		}

		const roles = members.get(id);

		if (!roles) {
			return Response.json({ message: 'Unknown Member', code: 10007 }, { status: 404 });
		}

		const user = known.get(id);

		return Response.json({
			user: {
				id,
				username: user?.username ?? `user${id}`,
				global_name: user?.global_name ?? null,
				avatar: user?.avatar ?? null,
				banner: user?.banner ?? null,
			},
			roles,
			banner: user?.member_banner ?? null,
		});
	}

	function handle(request: Request): Response | Promise<Response> {
		const url = new URL(request.url);
		const path = url.pathname;

		requests.push({ path, authorization: request.headers.get('authorization') });

		const [, guildId, memberId] =
			/^\/api\/v10\/guilds\/(\d+)\/members\/(\d+)$/.exec(path) ?? [];

		if (guildId && memberId) {
			return membersHandler?.(memberId) ?? readMember(guildId, memberId);
		}

		const id = /^\/api\/v10\/users\/(\d+)$/.exec(path)?.[1];

		if (!id) {
			return Response.json(NOT_FOUND, { status: 404 });
		}

		const overridden = handler?.(id);

		if (overridden) {
			return overridden;
		}

		const user = known.get(id);

		if (!user) {
			return Response.json({ message: 'Unknown User', code: 10013 }, { status: 404 });
		}

		return Response.json({
			id,
			username: user.username,
			global_name: user.global_name ?? null,
			avatar: user.avatar ?? null,
			banner: user.banner ?? null,
		});
	}

	const server = Bun.serve({ port: options.port ?? 0, fetch: handle });

	return {
		url: server.url,
		apiUrl: new URL('/api/v10', server.url).href,
		users: known,
		guilds,
		requests,
		override(next) {
			handler = next;
		},
		overrideMembers(next) {
			membersHandler = next;
		},
		async stop() {
			await server.stop(true);
		},
	};
}
