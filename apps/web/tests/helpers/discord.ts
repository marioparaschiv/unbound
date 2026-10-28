export type FakeDiscordUser = {
	username: string;
	global_name?: string | null;
	avatar?: string | null;
};

export type FakeDiscordRequest = {
	path: string;
	authorization: string | null;
};

export type FakeDiscordOverride = (id: string) => Response | Promise<Response> | undefined;

/** Answers a guild member page request in place of the fake, given the request's `after`. */
export type FakeMembersOverride = (after: string) => Response | Promise<Response> | undefined;

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
	/** Each guild's members and their role ids; edit it to change what the next listing returns. */
	guilds: Map<string, Map<string, string[]>>;
	requests: FakeDiscordRequest[];
	override(handler: FakeDiscordOverride | null): void;
	overrideMembers(handler: FakeMembersOverride | null): void;
	stop(): Promise<void>;
};

const NOT_FOUND = { message: '404: Not Found', code: 0 };

/**
 * @description Serves a fake Discord `GET /api/v10/users/{id}` and `GET /api/v10/guilds/{id}/members`
 * (paged by `limit` and `after`, ordered by user id) that records every request.
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

	function listMembers(guildId: string, params: URLSearchParams) {
		const members = guilds.get(guildId);

		if (!members) {
			return Response.json({ message: 'Unknown Guild', code: 10004 }, { status: 404 });
		}

		const after = BigInt(params.get('after') ?? '0');
		const limit = Number(params.get('limit') ?? '1');

		return Response.json(
			[...members]
				.filter(([id]) => BigInt(id) > after)
				.toSorted(([a], [b]) => (BigInt(a) < BigInt(b) ? -1 : 1))
				.slice(0, limit)
				.map(([id, roles]) => {
					const user = known.get(id);

					return {
						user: {
							id,
							username: user?.username ?? `user${id}`,
							global_name: user?.global_name ?? null,
							avatar: user?.avatar ?? null,
						},
						roles,
					};
				}),
		);
	}

	function handle(request: Request): Response | Promise<Response> {
		const url = new URL(request.url);
		const path = url.pathname;

		requests.push({ path, authorization: request.headers.get('authorization') });

		const guildId = /^\/api\/v10\/guilds\/(\d+)\/members$/.exec(path)?.[1];

		if (guildId) {
			return (
				membersHandler?.(url.searchParams.get('after') ?? '0') ??
				listMembers(guildId, url.searchParams)
			);
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
