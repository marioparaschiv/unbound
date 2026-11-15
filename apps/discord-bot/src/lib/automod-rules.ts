/** What automod does to a message or its author, as Carl-bot's punishments were named. */
export type Punishment = 'delete' | 'dm' | 'warn' | 'mute' | 'kick' | 'ban';

/** A rate a member must reach to be punished: `count` within `seconds`; a zero turns the rule off, as in Carl-bot. */
export type Rate = { count: number; seconds: number };

const INVITE =
	/(?:https?:\/\/)?(?:www\.)?(?:discord(?:app)?\.com\/invite|discord\.gg|dsc\.gg)\/([\w-]+)/gi;
const URL_HOST = /https?:\/\/([^\s/?#<>]+)/gi;
const PUNCTUATION = /[^\p{L}\p{N}\s]/gu;

/**
 * @description Finds the Discord invite codes in a message.
 * @param content The message text.
 * @returns The codes, each once.
 */
export function findInviteCodes(content: string): string[] {
	return [...new Set([...content.matchAll(INVITE)].map(([, code = '']) => code))];
}

/**
 * @description Finds the first bad word in a message, as Carl-bot matched them: any case, inside words, punctuation ignored.
 * @param content The message text.
 * @param words The bad words.
 * @returns The word found, or undefined.
 */
export function findBadWord(content: string, words: readonly string[]): string | undefined {
	const plain = content.toLowerCase().replaceAll(PUNCTUATION, '');

	return words.find((word) => {
		const target = word.toLowerCase().replaceAll(PUNCTUATION, '');

		return target !== '' && plain.includes(target);
	});
}

/**
 * @description Finds the first link to a blacklisted domain or one of its subdomains.
 * @param content The message text.
 * @param domains The blacklisted domains, e.g. `grabify.link`.
 * @returns The domain matched, or undefined.
 */
export function findBlacklistedLink(
	content: string,
	domains: readonly string[],
): string | undefined {
	const hosts = [...content.matchAll(URL_HOST)].map(([, host = '']) =>
		host.toLowerCase().replace(/:\d+$/, ''),
	);

	return domains.find((domain) => {
		const target = domain.toLowerCase();

		return hosts.some((host) => host === target || host.endsWith(`.${target}`));
	});
}

/**
 * @description Counts the capital letters in a message.
 * @param content The message text.
 * @returns How many letters are upper case.
 */
export function countCaps(content: string): number {
	return content.match(/\p{Lu}/gu)?.length ?? 0;
}

/**
 * @description Whether a rule with this rate is switched on.
 * @param rate The rate.
 * @returns False when either part is zero.
 */
export function isRateOn({ count, seconds }: Rate): boolean {
	return count > 0 && seconds > 0;
}

/** Counts each member's recent messages, mentions or files, to tell when they pass a rate. */
export type RateCounter = {
	/** Adds `amount` for `key` at `now` and resolves whether the total within the rate's window reached its count. */
	hit: (key: string, amount: number, rate: Rate, now: number) => boolean;
	/** Forgets a key, once its member is punished, so one burst is punished once. */
	reset: (key: string) => void;
};

/**
 * @description Creates a sliding-window counter.
 * @returns The counter.
 */
export function createRateCounter(): RateCounter {
	const hits = new Map<string, { at: number; amount: number }[]>();

	return {
		hit(key, amount, { count, seconds }, now) {
			const since = now - seconds * 1000;
			const recent = (hits.get(key) ?? []).filter((entry) => entry.at > since);

			recent.push({ at: now, amount });
			hits.set(key, recent);

			return recent.reduce((total, entry) => total + entry.amount, 0) >= count;
		},
		reset(key) {
			hits.delete(key);
		},
	};
}

export default {
	findInviteCodes,
	findBadWord,
	findBlacklistedLink,
	countCaps,
	isRateOn,
	createRateCounter,
};
