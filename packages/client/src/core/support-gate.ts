/** Unbound's server. */
export const UNBOUND_GUILD_ID = '950850315601711176';

/** The server's general chat, where the gate applies. */
export const CHAT_CHANNEL_ID = '950850316318933004';

/** The support forum the gate points to. */
export const SUPPORT_FORUM_ID = '1524151333039505470';

/** Roles that show the member knows the server: staff, contributors, sponsors and boosters, bots. */
export const TRUSTED_ROLE_IDS: ReadonlySet<string> = new Set([
	'950850582984392704',
	'952688684107456612',
	'962523565230555227',
	'965128576057868318',
	'967799585844113418',
	'997233808522874910',
	'997239658608070659',
	'1033960685538910280',
	'1104801545305993396',
	'1115010238110769312',
	'1170093685862576248',
	'1284255487520673875',
	'1524150823070863582',
	'1568273357043138723',
]);

const DAY_MS = 24 * 60 * 60 * 1000;
const DISCORD_EPOCH = 1420070400000n;

/** An account younger than this is new. */
export const NEW_ACCOUNT_DAYS = 90;

/** A member who joined more recently than this is new to the server. */
export const NEW_MEMBER_DAYS = 30;

export type GateMember = {
	userId: string;
	roles: readonly string[];
	joinedAt?: string | number | Date;
};

/**
 * @description Reads when a Discord account was made from its id.
 * @param userId The user's id.
 * @returns The creation time in milliseconds.
 */
export function accountCreatedAt(userId: string): number {
	return Number((BigInt(userId) >> 22n) + DISCORD_EPOCH);
}

/**
 * @description Decides whether a member sees the support gate: new to Discord or new to the server, and without a
 * role that shows they know their way around.
 * @param member The member's id, roles and join time.
 * @param now The current time in milliseconds.
 * @returns Whether the gate applies.
 */
export function needsSupportGate(member: GateMember, now: number): boolean {
	if (member.roles.some((role) => TRUSTED_ROLE_IDS.has(role))) {
		return false;
	}

	const joinedAt = member.joinedAt === undefined ? now : new Date(member.joinedAt).getTime();
	const newAccount = now - accountCreatedAt(member.userId) < NEW_ACCOUNT_DAYS * DAY_MS;
	const newMember = Number.isFinite(joinedAt) && now - joinedAt < NEW_MEMBER_DAYS * DAY_MS;

	return newAccount || newMember;
}

/** The answers the gate's question offers; only `forum` is right. */
export const ANSWERS = ['chat', 'forum', 'dm'] as const;

export type Answer = (typeof ANSWERS)[number];

/**
 * @description Orders the answers differently each time, so the right one is never in the same place.
 * @param random A source of numbers from 0 to 1.
 * @returns The answers, shuffled.
 */
export function shuffledAnswers(random: () => number = Math.random): Answer[] {
	const answers = [...ANSWERS];

	for (let index = answers.length - 1; index > 0; index--) {
		const swap = Math.floor(random() * (index + 1));

		[answers[index], answers[swap]] = [answers[swap], answers[index]] as [Answer, Answer];
	}

	return answers;
}
