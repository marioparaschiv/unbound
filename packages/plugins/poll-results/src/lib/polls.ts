export type PollMessage = {
	id?: string;
	poll?: {
		expiry?: string | null;
		results?: { is_finalized?: boolean; answer_counts?: { me_voted?: boolean }[] } | null;
	} | null;
};

/**
 * @description Whether a message holds a poll still open that you haven't voted in, whose results Discord hides.
 * @param message The message.
 * @param now The current time, in milliseconds.
 * @returns Whether to show its results.
 */
export function hidesResults(message: PollMessage | undefined, now: number): boolean {
	const poll = message?.poll;

	if (!message?.id || !poll || poll.results?.is_finalized) return false;

	if (poll.expiry && Date.parse(poll.expiry) <= now) return false;

	return !poll.results?.answer_counts?.some((count) => count.me_voted);
}
