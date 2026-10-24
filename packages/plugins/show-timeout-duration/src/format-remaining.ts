/**
 * @description Formats the time left until a deadline as its two largest units, such as `2d 3h` or `5m`.
 * @param deadline The deadline in milliseconds.
 * @param now The current time in milliseconds.
 * @returns The remaining time, rounded up to whole minutes and never below `1m`.
 */
export function formatRemaining(deadline: number, now: number = Date.now()): string {
	const totalMinutes = Math.max(1, Math.ceil((deadline - now) / 60_000));
	const days = Math.floor(totalMinutes / 1440);
	const hours = Math.floor((totalMinutes % 1440) / 60);
	const minutes = totalMinutes % 60;

	if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;

	if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;

	return `${minutes}m`;
}

export default formatRemaining;
