export type JumpOptions = {
	channelId?: string;
	messageId?: string;
	returnMessageId?: string;
};

type Tapped = { channelId: string; messageId: string; at: number };

export type ReturnTargets = {
	remember(channelId: string, messageId: string): void;
	withReturn(options: JumpOptions): JumpOptions;
};

const PENDING_MS = 5000;

/**
 * @description Remembers the reply tapped last, so the jump it starts can carry the reply as the place to return to.
 * @param now The clock, in milliseconds.
 * @returns `remember`, called on a reply tap, and `withReturn`, which adds the reply to a jump that leaves it.
 */
export function createReturnTargets(now: () => number = Date.now): ReturnTargets {
	let tapped: Tapped | undefined;

	return {
		remember(channelId, messageId) {
			tapped = { channelId, messageId, at: now() };
		},
		withReturn(options) {
			const reply = tapped;

			tapped = undefined;

			if (!reply || now() - reply.at > PENDING_MS || options.returnMessageId) return options;

			if (options.channelId !== reply.channelId || options.messageId === reply.messageId)
				return options;

			return { ...options, returnMessageId: reply.messageId };
		},
	};
}

export default createReturnTargets;
