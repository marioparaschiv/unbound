export type UserpfpData = { avatars: Record<string, string> };

/**
 * @description Checks that the UserPFP list has the shape avatar links are read from.
 * @param value The parsed response.
 * @returns Whether it is a UserPFP list.
 */
export function isUserpfpData(value: unknown): value is UserpfpData {
	const data = value as Partial<UserpfpData> | null;

	return typeof data?.avatars === 'object' && data.avatars !== null;
}

/**
 * @description Picks a user's UserPFP avatar, as a still PNG when Discord asked for a static one.
 * @param data The UserPFP list.
 * @param userId The user.
 * @param animate Whether Discord wants the animated avatar.
 * @returns The avatar's link, or `undefined` when the user has none or the list has not loaded.
 */
export function userpfpAvatar(
	data: UserpfpData | undefined,
	userId: string | undefined,
	animate: boolean,
): string | undefined {
	const avatar = userId ? data?.avatars[userId] : undefined;

	if (typeof avatar !== 'string') return undefined;

	return !animate && avatar.endsWith('.gif') ? `${avatar.slice(0, -4)}.png` : avatar;
}
