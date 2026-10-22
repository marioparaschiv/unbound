type ReactionRecord = Record<string, unknown>;

export function stripMessageReactions<T extends Record<string, unknown>>(message: T): T {
	Object.assign(message, { reactions: [] });
	return message;
}

export function reactionSnapshot(value: unknown): string {
	if (!Array.isArray(value)) return '[]';

	return JSON.stringify(
		value.map((reaction) => {
			if (!reaction || typeof reaction !== 'object') return reaction;

			const entry = reaction as ReactionRecord;
			const emoji = entry.emoji as ReactionRecord | undefined;
			const countDetails = entry.count_details as ReactionRecord | undefined;

			return {
				burstColors: entry.burst_colors ?? entry.burstColors,
				count: entry.count,
				countDetails: countDetails
					? { burst: countDetails.burst, normal: countDetails.normal }
					: undefined,
				emojiId: emoji?.id,
				emojiName: emoji?.name,
				me: entry.me,
				meBurst: entry.me_burst ?? entry.meBurst,
			};
		}),
	);
}
