import type { SendArgs, SendGuard } from './held-send';

export type SendDecision = 'send' | 'restore';

/**
 * @description Asks a send guard about one message. A guard that throws or rejects lets the message go out, so a
 * broken guard never loses what the user sent; the failure is logged under the feature's name.
 * @param feature The guarding feature's name, for the log.
 * @param guard Decides whether the message goes out.
 * @param args The send's arguments.
 * @returns `send` to let Discord send it, `restore` to put it back in the chat input.
 */
export async function decideSend(
	feature: string,
	guard: SendGuard,
	args: SendArgs,
): Promise<SendDecision> {
	try {
		return (await guard(args)) ? 'send' : 'restore';
	} catch (error) {
		logger.error(`Failed to check a message for ${feature} in channel ${args[0]}:`, error);

		return 'send';
	}
}

export default { decideSend };
