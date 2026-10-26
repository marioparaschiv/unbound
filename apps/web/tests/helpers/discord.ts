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

export type FakeDiscord = {
	url: URL;
	apiUrl: string;
	users: Map<string, FakeDiscordUser>;
	requests: FakeDiscordRequest[];
	override(handler: FakeDiscordOverride | null): void;
	stop(): Promise<void>;
};

/**
 * @description Serves a fake Discord `GET /api/v10/users/{id}` that records every request.
 * @param users The known users by id.
 * @returns The running fake.
 */
export function serveDiscord(users: Record<string, FakeDiscordUser> = {}): FakeDiscord {
	const known = new Map(Object.entries(users));
	const requests: FakeDiscordRequest[] = [];
	let handler: FakeDiscordOverride | null = null;

	function handle(request: Request): Response | Promise<Response> {
		const path = new URL(request.url).pathname;

		requests.push({ path, authorization: request.headers.get('authorization') });

		const id = /^\/api\/v10\/users\/(\d+)$/.exec(path)?.[1];

		if (!id) {
			return Response.json({ message: '404: Not Found', code: 0 }, { status: 404 });
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

	const server = Bun.serve({ port: 0, fetch: handle });

	return {
		url: server.url,
		apiUrl: new URL('/api/v10', server.url).href,
		users: known,
		requests,
		override(next) {
			handler = next;
		},
		async stop() {
			await server.stop(true);
		},
	};
}
