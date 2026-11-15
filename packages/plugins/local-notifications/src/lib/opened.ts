export type Posted<T> = { id: string; target: T };

/**
 * @description Finds the notification that was most likely tapped: the newest one no longer delivered.
 * @param posted The notifications posted, oldest first.
 * @param delivered The identifiers still delivered.
 * @returns The tapped notification's target, if any disappeared, and the ones still delivered.
 */
export function tappedTarget<T>(
	posted: Posted<T>[],
	delivered: string[],
): { target?: T; remaining: Posted<T>[] } {
	const still = new Set(delivered);
	const gone = posted.filter((item) => !still.has(item.id));

	return { target: gone.at(-1)?.target, remaining: posted.filter((item) => still.has(item.id)) };
}
