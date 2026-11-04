import { selfTestYoutubeEmbeds, startYoutubeEmbeds } from '~/youtube-embeds';

let stopEmbeds = async () => {};

export function start() {
	stopEmbeds = startYoutubeEmbeds();
}

export function stop() {
	return stopEmbeds();
}

export { selfTestYoutubeEmbeds as selfTest };
