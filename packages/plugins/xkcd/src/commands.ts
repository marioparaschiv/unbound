import { openSheet } from '@unbound-plugins/shared/action-sheets/open-sheet';
import { commands } from '@unbound-app/api';

import ComicSheet from '~/components/comic-sheet';
import { parseRequest } from '~/lib/comics';

/**
 * @description Registers /xkcd, which opens a comic by number, the latest, a random one, or a title search.
 */
export function registerXkcdCommand(): void {
	commands.register({
		xkcd: {
			description: 'XKCD_DESC',
			options: { comic: commands.option.string({ description: 'COMIC_DESC' }) },
			execute: ({ comic }: { comic?: string }) => {
				openSheet('unbound-xkcd', ComicSheet, { request: parseRequest(comic) });
			},
		},
	});
}
