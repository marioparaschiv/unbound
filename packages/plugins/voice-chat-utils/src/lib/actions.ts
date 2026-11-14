/** A bulk voice action, the member edit it sends and the permission it needs. */
export type VoiceAction = {
	key: 'disconnect' | 'mute' | 'unmute' | 'deafen' | 'undeafen' | 'move';
	label: string;
	icon: string;
	permission: 'MOVE_MEMBERS' | 'MUTE_MEMBERS' | 'DEAFEN_MEMBERS';
	body: Record<string, boolean | string | null>;
};

export const ACTIONS: VoiceAction[] = [
	{
		key: 'disconnect',
		label: 'DISCONNECT_ALL',
		icon: 'PhoneHangUpIcon',
		permission: 'MOVE_MEMBERS',
		body: { channel_id: null },
	},
	{
		key: 'mute',
		label: 'MUTE_ALL',
		icon: 'MicrophoneSlashIcon',
		permission: 'MUTE_MEMBERS',
		body: { mute: true },
	},
	{
		key: 'unmute',
		label: 'UNMUTE_ALL',
		icon: 'MicrophoneIcon',
		permission: 'MUTE_MEMBERS',
		body: { mute: false },
	},
	{
		key: 'deafen',
		label: 'DEAFEN_ALL',
		icon: 'HeadphonesSlashIcon',
		permission: 'DEAFEN_MEMBERS',
		body: { deaf: true },
	},
	{
		key: 'undeafen',
		label: 'UNDEAFEN_ALL',
		icon: 'HeadphonesIcon',
		permission: 'DEAFEN_MEMBERS',
		body: { deaf: false },
	},
];

/** A voice state as `VoiceStateStore` keeps it. */
export type VoiceState = { userId?: string };

/** Voice and stage channels, by Discord's channel type. */
export const VOICE_TYPES = new Set([2, 13]);

/**
 * @description Lists the members a bulk action applies to: everyone in the channel but you, once each.
 * @param states The channel's voice states, by user id.
 * @param me Your user id.
 * @returns The member ids.
 */
export function targetsOf(states: Record<string, VoiceState | undefined>, me: string): string[] {
	const ids = Object.values(states)
		.map((state) => state?.userId)
		.filter((id): id is string => typeof id === 'string' && id !== me);

	return [...new Set(ids)];
}

/**
 * @description Runs member edits one at a time with a pause between, so a big channel does not hit the rate limit at once.
 * @param ids The members.
 * @param edit The request for one member.
 * @param pauseMs The pause between requests.
 * @returns How many edits succeeded.
 */
export async function runSequentially(
	ids: string[],
	edit: (id: string) => Promise<unknown>,
	pauseMs = 300,
): Promise<number> {
	let done = 0;

	for (const [index, id] of ids.entries()) {
		if (index > 0) await new Promise((resolve) => setTimeout(resolve, pauseMs));

		try {
			await edit(id);
			done++;
		} catch (error) {
			logger.warn(`Failed to change voice member ${id}:`, error);
		}
	}

	return done;
}
