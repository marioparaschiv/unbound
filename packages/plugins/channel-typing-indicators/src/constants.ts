// Bit flags stored in the `indicatorMode` setting.
export const IndicatorMode = {
	Dots: 1,
	Avatars: 2,
};

export const MAX_AVATARS = 3;

// Discord's own "is typing" strings for one, two, three, and several typing users.
export const TYPING_MESSAGE_IDS = ['lJ9sZX', 'rB0CUa', 'StKThj', 'uVDhqZ'];

// The key of every element the plugin inserts, which also marks a row as already patched.
export const INDICATOR_KEY = 'unbound.channel-typing-indicators';
