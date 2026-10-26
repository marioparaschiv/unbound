import type {
	AuditEvent,
	BotReads,
	Member,
	MemberQuery,
	PublicAddon,
	Release,
} from '@unbound-app/web/bot';

export type FakeReads = {
	reads: BotReads;
	/** The listings the reads serve, by addon id; delete one to make the addon gone. */
	addons: Map<string, PublicAddon>;
	events: AuditEvent[];
	releases: Release[];
	members: Member[];
	/** User ids per addon id, for `{ by: 'addon' }`. */
	maintainers: Map<string, string[]>;
};

/** A listed plugin as the read model shows it. */
export const ADDON: PublicAddon = {
	id: 'addon-1',
	type: 'plugin',
	name: 'Silent Typing',
	description: 'Hides your typing indicator.',
	version: '1.0.0',
	authors: [{ name: 'Mario', discordId: '1' }],
	pageUrl: 'https://unbound.rip/addons/addon-1',
	listed: true,
};

export const EVENT: AuditEvent = {
	id: 1,
	kind: 'addon.delisted',
	subjectType: 'addon',
	subjectId: 'addon-1',
	subjectName: 'Silent Typing',
	actor: { id: 'user-1', name: 'Mario', image: null },
	data: {},
	reason: null,
	createdAt: new Date('2026-10-01T00:00:00.000Z'),
};

export const RELEASE: Release = {
	platform: 'ios',
	version: '1.2.3',
	url: 'https://example.com/unbound.ipa',
	changelog: 'Fixes.',
	publishedAt: new Date('2026-10-01T00:00:00.000Z'),
};

export const MEMBER: Member = {
	userId: 'user-1',
	discordId: '1',
	githubId: '42',
	isAddonDeveloper: true,
	isSponsor: false,
};

function matches(fake: FakeReads, member: Member, query: MemberQuery) {
	switch (query.by) {
		case 'all': {
			return true;
		}
		case 'user': {
			return query.ids.includes(member.userId);
		}
		case 'discord': {
			return query.ids.includes(member.discordId);
		}
		case 'github': {
			return member.githubId !== null && query.ids.includes(member.githubId);
		}
		case 'addon': {
			return query.ids.some((id) => fake.maintainers.get(id)?.includes(member.userId));
		}
	}
}

/**
 * @description An in-memory read model for tests that pin Discord behaviour, where web rows add nothing.
 * @returns The reads and the collections they serve, which a test edits directly.
 */
export function createFakeReads(): FakeReads {
	const fake: FakeReads = {
		addons: new Map(),
		events: [],
		releases: [],
		members: [],
		maintainers: new Map(),
		reads: {
			addon: async (id) => fake.addons.get(id),
			addons: async () => [...fake.addons.values()],
			eventsAfter: async (afterId, limit) =>
				fake.events
					.filter((event) => event.id > afterId)
					.toSorted((a, b) => a.id - b.id)
					.slice(0, limit),
			newestEventId: async () => Math.max(0, ...fake.events.map((event) => event.id)),
			release: async (key) =>
				fake.releases.find(
					(release) =>
						release.platform === key.platform && release.version === key.version,
				),
			releasesSince: async (since) =>
				fake.releases
					.filter((release) => release.publishedAt >= since)
					.toSorted((a, b) => a.publishedAt.getTime() - b.publishedAt.getTime()),
			members: async (query) => fake.members.filter((member) => matches(fake, member, query)),
		},
	};

	return fake;
}
