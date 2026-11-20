/**
 * @description Says whether an hour falls in a night that may wrap past midnight, such as 21 to 7.
 * @param hour The hour to check, 0 to 23.
 * @param start The hour the night starts.
 * @param end The hour the night ends, not included.
 * @returns Whether the hour is at night; a night that starts and ends at the same hour never is.
 */
export function isNightHour(hour: number, start: number, end: number): boolean {
	if (start === end) return false;

	return start < end ? hour >= start && hour < end : hour >= start || hour < end;
}

export default { isNightHour };
