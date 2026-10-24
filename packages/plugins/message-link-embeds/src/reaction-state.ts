type Reaction = {
	burst_colors?: unknown;
	burstColors?: unknown;
	count?: unknown;
	count_details?: { burst?: unknown; normal?: unknown };
	emoji?: { id?: unknown; name?: unknown };
	me?: unknown;
	me_burst?: unknown;
	meBurst?: unknown;
};

/**
 * @description Serializes the parts of a message's reactions that change its rendered height.
 * @param value The message's `reactions` array.
 * @returns A string that differs whenever a reaction is added, removed, or recounted.
 */
export function reactionSnapshot(value: unknown): string {
	if (!Array.isArray(value)) return '[]';

	return JSON.stringify(
		value.map((reaction: Reaction | null) => {
			if (!reaction || typeof reaction !== 'object') return reaction;

			const details = reaction.count_details;

			return {
				burstColors: reaction.burst_colors ?? reaction.burstColors,
				count: reaction.count,
				countDetails: details
					? { burst: details.burst, normal: details.normal }
					: undefined,
				emojiId: reaction.emoji?.id,
				emojiName: reaction.emoji?.name,
				me: reaction.me,
				meBurst: reaction.me_burst ?? reaction.meBurst,
			};
		}),
	);
}
