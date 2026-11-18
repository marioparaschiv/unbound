/** Unbound's server. */
export const UNBOUND_GUILD_ID = '950850315601711176';

/** The server's general chat, where the gate applies. */
export const CHAT_CHANNEL_ID = '950850316318933004';

/** The support forum the gate points to. */
export const SUPPORT_FORUM_ID = '1524151333039505470';

/** The roles that let a member past the gate when the server's roles can't be read: its hoisted roles. */
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

export type ServerRole = { id: string; hoist?: boolean };

/**
 * @description Lists the server's hoisted roles, the ones shown apart in the member list: staff, helpers, contributors,
 * sponsors and bots.
 * @param roles The server's roles.
 * @returns Their ids, or the known trusted roles when the server's roles can't be read.
 */
export function hoistedRoleIds(roles: readonly ServerRole[] | undefined): ReadonlySet<string> {
	const hoisted = (roles ?? []).filter((role) => role.hoist).map((role) => role.id);

	return hoisted.length ? new Set(hoisted) : TRUSTED_ROLE_IDS;
}

/**
 * @description Decides whether a member sees the support gate: everyone without a hoisted role.
 * @param roles The member's role ids.
 * @param hoisted The server's hoisted role ids.
 * @returns Whether the gate applies.
 */
export function needsSupportGate(roles: readonly string[], hoisted: ReadonlySet<string>): boolean {
	return !roles.some((role) => hoisted.has(role));
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
