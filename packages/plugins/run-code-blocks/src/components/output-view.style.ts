import { Discord } from '@unbound-app/api/metro/components';

export default Discord.createStyles({
	card: {
		paddingVertical: 8,
		paddingHorizontal: 12,
	},
	// Long output scrolls inside the card, so the dialog's buttons stay on screen.
	scroll: {
		maxHeight: 320,
	},
});
