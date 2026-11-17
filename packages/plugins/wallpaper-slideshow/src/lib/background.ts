import { storage } from '@unbound-app/api';
import { settings } from '@unbound-app/settings';

import { nextPosition, usableLinks } from '~/lib/rotation';

type Saved = { source: string; url: string };

const SOURCE = 'chat-background.source';
const URL = 'chat-background.url';

let saved: Saved | undefined;
let timer: ReturnType<typeof setInterval> | undefined;

function core() {
	return storage.getBucket('unbound');
}

function show(position: number) {
	const links = usableLinks(settings.wallpapers);
	const link = links[position % Math.max(1, links.length)];

	if (!link) return;

	saved ??= { source: String(core().get(SOURCE, 'theme')), url: String(core().get(URL, '')) };
	core().set(SOURCE, 'custom');
	core().set(URL, link);
}

/**
 * @description Moves to the next wallpaper and shows it as the chat background.
 */
export function advance(): void {
	const count = usableLinks(settings.wallpapers).length;

	settings.position = nextPosition(settings.position, count, settings.shuffle, Math.random());
	show(settings.position);
}

/**
 * @description Shows the current wallpaper and changes it on the chosen interval; restarting picks up a changed list
 * or interval.
 */
export function startSlideshow(): void {
	clearInterval(timer);
	show(settings.position);
	timer = setInterval(advance, Math.max(60_000, settings.interval));
}

/**
 * @description Stops changing wallpapers and puts back the chat background you had before the slideshow.
 */
export function stopSlideshow(): void {
	clearInterval(timer);
	timer = undefined;

	if (!saved) return;

	core().set(SOURCE, saved.source);
	core().set(URL, saved.url);
	saved = undefined;
}
