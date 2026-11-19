const LOCAL_MESSAGES = '__ubdLocalMessages';

/**
 * @description Tells whether a message exists only on this device because `ubd debug message add` made it, so its
 * removal is test cleanup, not a deletion to log. The command keeps its message ids per channel on `globalThis`.
 * @param channelId The message's channel.
 * @param messageId The message.
 * @returns Whether the debug command added it.
 */
export function isDebugLocalMessage(channelId: string, messageId: string): boolean {
	const owned: unknown = Reflect.get(globalThis, LOCAL_MESSAGES);

	if (typeof owned !== 'object' || owned === null) return false;

	const ids: unknown = Reflect.get(owned, channelId);

	return Array.isArray(ids) && ids.includes(messageId);
}

export default { isDebugLocalMessage };
