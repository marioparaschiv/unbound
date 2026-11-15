/** Who acts on whom, and where each stands in the role hierarchy. */
export type TargetCheck = {
	moderatorId: string;
	targetId: string;
	botId: string;
	ownerId: string;
	/** The position of the moderator's highest role. */
	moderatorPosition: number;
	/** The position of the target's highest role; undefined when the target is not in the server. */
	targetPosition?: number;
	/** The position of the bot's highest role. */
	botPosition: number;
};

/**
 * @description Tells why a moderator may not act on a target, as Discord's role hierarchy rules it.
 * @param check The moderator, the target, the bot and the owner, with their role positions.
 * @returns The problem to reply with, or undefined when the action may go ahead.
 */
export function findTargetProblem(check: TargetCheck): string | undefined {
	const { moderatorId, targetId, botId, ownerId, targetPosition } = check;

	if (targetId === moderatorId) {
		return 'You cannot moderate yourself.';
	}

	if (targetId === botId) {
		return 'I cannot moderate myself.';
	}

	if (targetId === ownerId) {
		return 'Nobody can moderate the server owner.';
	}

	if (targetPosition === undefined) return;

	if (moderatorId !== ownerId && targetPosition >= check.moderatorPosition) {
		return 'You can only moderate members whose highest role is below yours.';
	}

	if (targetPosition >= check.botPosition) {
		return 'I can only moderate members whose highest role is below mine.';
	}
}

export default { findTargetProblem };
