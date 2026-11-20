export type MentionEvent = {
	nativeEvent?: { userId?: unknown; parsedUserId?: unknown; roleId?: unknown };
};

const SNOWFLAKE = /^\d{17,20}$/;

/**
 * @description Reads the user an @unknown-user mention points at: Discord sends its parsed id but no `userId` when it has
 * not loaded the user.
 * @param event The mention tap event.
 * @returns The user's id, or `undefined` for any other mention.
 */
export function unknownUserId(event: MentionEvent | undefined): string | undefined {
	const data = event?.nativeEvent;

	if (!data || data.userId != null || data.roleId != null) return undefined;

	const id = typeof data.parsedUserId === 'string' ? data.parsedUserId : undefined;

	return id && SNOWFLAKE.test(id) ? id : undefined;
}

export default { unknownUserId };
