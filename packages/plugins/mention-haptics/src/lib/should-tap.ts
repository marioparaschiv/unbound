/** What decides whether a new message taps. */
export type TapFacts = {
	fromMe: boolean;
	mentioned: boolean;
	direct: boolean;
	open: boolean;
	optimistic: boolean;
};

/**
 * @description Decides whether a new message should tap the phone.
 * @param facts Who sent it, whether it mentions you, whether it is a DM and whether its channel is open.
 * @param options Whether DMs and the open channel tap too.
 * @returns Whether to tap.
 */
export function shouldTap(
	facts: TapFacts,
	options: { directMessages: boolean; openChannel: boolean },
): boolean {
	if (facts.fromMe || facts.optimistic) return false;

	if (facts.open && !options.openChannel) return false;

	return facts.mentioned || (facts.direct && options.directMessages);
}

export default shouldTap;
