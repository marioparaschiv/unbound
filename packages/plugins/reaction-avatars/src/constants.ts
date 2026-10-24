export const Avatar = {
	// At most this many faces are shown; the rest collapse into a `+N` badge.
	limit: 5,
	size: 18,
	// Horizontal offset between overlapping faces.
	step: 5,
	// The stack overlaps the reaction pill's trailing padding by this much.
	leadingInset: 4,
	trailingPadding: 4,
};

export const SURFACE_HEIGHT = 36;

export const NativeClass = {
	messageCell: 'DCDMessageTableViewCell',
	table: 'DCDTableView',
};

export const REACTION_ACTIONS = [
	'MESSAGE_REACTION_ADD',
	'MESSAGE_REACTION_REMOVE',
	'MESSAGE_REACTION_REMOVE_ALL',
	'MESSAGE_REACTION_REMOVE_EMOJI',
];
