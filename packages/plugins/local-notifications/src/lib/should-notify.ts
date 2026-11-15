export type NotifyFacts = {
	fromMe: boolean;
	optimistic: boolean;
	mentioned: boolean;
	direct: boolean;
	muted: boolean;
	active: boolean;
};

/**
 * @description Decides whether a new message posts a notification: mentions, and DMs when enabled, while Discord is
 * in the background, never your own messages or muted channels.
 * @param facts What is known about the message and the app.
 * @param options Whether DMs notify without a mention.
 * @returns Whether to notify.
 */
export function shouldNotify(facts: NotifyFacts, options: { directMessages: boolean }): boolean {
	if (facts.active || facts.fromMe || facts.optimistic) return false;
	if (facts.mentioned) return true;

	return facts.direct && options.directMessages && !facts.muted;
}
