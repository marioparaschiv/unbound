import { COLOURS, type AppEmoji } from '~/lib/constants';
import type { IconEmojiSpec } from '~/lib/icon-emojis';

/** Names each server log icon emoji, by the event it heads. */
export type LogIconKey =
	| 'messageDeleted'
	| 'messageEdited'
	| 'messagesPurged'
	| 'memberJoined'
	| 'memberLeft';

/** The uploaded icon emoji of each event; an event without one shows no icon. */
export type LogIcons = ReadonlyMap<LogIconKey, AppEmoji>;

/** The icon emojis server log posts show, tinted as their posts are. */
export const LOG_ICONS: Readonly<Record<LogIconKey, IconEmojiSpec>> = {
	messageDeleted: { icon: 'IconTrash', colour: COLOURS.danger },
	messageEdited: { icon: 'IconMsgPen', colour: COLOURS.info },
	messagesPurged: { icon: 'IconBroom', colour: COLOURS.danger },
	memberJoined: { icon: 'IconUserPlus', colour: COLOURS.positive },
	memberLeft: { icon: 'IconUserMinus', colour: COLOURS.warning },
};

export default { LOG_ICONS };
