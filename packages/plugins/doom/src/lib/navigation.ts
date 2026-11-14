import { DOOM_ORIGIN } from '~/lib/constants';

/**
 * @description Keeps the web view on the game: its own pages load, anything else stays out.
 * @param url The page the web view is about to load.
 * @returns Whether to load it.
 */
export function staysOnGame(url: string): boolean {
	return url === 'about:blank' || url === DOOM_ORIGIN || url.startsWith(`${DOOM_ORIGIN}/`);
}

export default staysOnGame;
