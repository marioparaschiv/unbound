export type StreamStatus = { live: true; uptime: string } | { live: false };

const UNITS: Record<string, string> = { day: 'd', hour: 'h', minute: 'm' };

/**
 * @description Reads decapi.me's uptime answer: a duration while the stream is live, "<channel> is offline" otherwise.
 * @param text The response body.
 * @returns The stream's status, or `undefined` for an answer it does not recognise.
 */
export function readStatus(text: string): StreamStatus | undefined {
	const answer = text.trim();

	if (/ is offline$/i.test(answer)) return { live: false };

	const parts = [...answer.matchAll(/(\d+) (day|hour|minute)s?/g)].map(
		([, amount, unit]) => `${amount}${UNITS[unit!]}`,
	);

	if (!parts.length && !/\d+ seconds?/.test(answer)) return undefined;

	return { live: true, uptime: parts.slice(0, 2).join(' ') || '<1m' };
}

export default readStatus;
