/**
 * @description Tells whether a voice channel has room for one more person.
 * @param connected How many people are in it.
 * @param limit Its user limit; 0 means none.
 * @returns Whether you can join.
 */
export function hasSlot(connected: number, limit: number): boolean {
	return limit <= 0 || connected < limit;
}

export default hasSlot;
