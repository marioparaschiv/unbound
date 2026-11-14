import { isUserpfpData, userpfpAvatar, type UserpfpData } from '~/lib/userpfp';

const USERPFP_LIST = 'https://userpfp.github.io/UserPFP/source/data.json';

let data: UserpfpData | undefined;

/**
 * @description Downloads the list of UserPFP avatars in the background.
 */
export async function loadAvatars(): Promise<void> {
	try {
		const response = await fetch(USERPFP_LIST);
		const body: unknown = await response.json();

		if (isUserpfpData(body)) data = body;
		else logger.warn('Failed to read the UserPFP list: it changed shape.');
	} catch (error) {
		logger.error(`Failed to load the UserPFP list from ${USERPFP_LIST}:`, error);
	}
}

/**
 * @description Looks up a user's UserPFP avatar.
 * @param userId The user.
 * @param animate Whether Discord wants the animated avatar.
 * @returns The avatar's link, or `undefined` when the user has none or the list has not loaded.
 */
export function avatarFor(userId: string | undefined, animate: boolean): string | undefined {
	return userpfpAvatar(data, userId, animate);
}
