export type UsrbgData = {
	endpoint: string;
	bucket: string;
	prefix: string;
	users: Record<string, string>;
};

/**
 * @description Checks that the USRBG list has the shape the banner links are built from.
 * @param value The parsed response.
 * @returns Whether it is a USRBG list.
 */
export function isUsrbgData(value: unknown): value is UsrbgData {
	const data = value as Partial<UsrbgData> | null;

	return (
		typeof data?.endpoint === 'string' &&
		typeof data.bucket === 'string' &&
		typeof data.prefix === 'string' &&
		typeof data.users === 'object' &&
		data.users !== null
	);
}

/**
 * @description Builds the link to a user's USRBG banner.
 * @param data The USRBG list.
 * @param userId The user.
 * @returns The banner's link, or `undefined` when the user has none.
 */
export function usrbgBanner(
	data: UsrbgData | undefined,
	userId: string | undefined,
): string | undefined {
	const etag = userId ? data?.users[userId] : undefined;

	if (!data || !userId || etag === undefined) return;

	return `${data.endpoint}/${data.bucket}/${data.prefix}${userId}?${etag}`;
}
