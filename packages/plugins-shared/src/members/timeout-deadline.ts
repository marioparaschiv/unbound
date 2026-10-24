type TimeoutEnd = string | Date | null | undefined;

/**
 * @description Reads when a member's timeout ends, if it has not ended yet.
 * @param until The member's `communicationDisabledUntil`.
 * @param now The current time in milliseconds.
 * @returns The end of the timeout in milliseconds, or `null` when the member is not timed out.
 */
export function getTimeoutDeadline(until: TimeoutEnd, now: number = Date.now()): number | null {
	if (!until) return null;

	const deadline = new Date(until).getTime();

	return deadline > now ? deadline : null;
}

export default getTimeoutDeadline;
