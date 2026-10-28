import uuid from '@unbound-app/utils/uuid';

/** The prefix of themes made in the editor. `--` fails the marketplace id schema, so the updater skips them. */
export const LOCAL_THEME_PREFIX = 'local--';

/** A theme id this device minted in the theme editor. */
export type LocalThemeId = `${typeof LOCAL_THEME_PREFIX}${string}`;

/**
 * @description Mints the id for a new theme editor session.
 * @returns A fresh local theme id.
 */
export function createLocalThemeId(): LocalThemeId {
	return `${LOCAL_THEME_PREFIX}${uuid(16)}`;
}

/**
 * @description Tells whether a theme was made in the theme editor.
 * @param id The theme id.
 * @returns Whether the id is in the local namespace.
 */
export function isLocalThemeId(id: string): id is LocalThemeId {
	return id.startsWith(LOCAL_THEME_PREFIX) && id.length > LOCAL_THEME_PREFIX.length;
}

export default { LOCAL_THEME_PREFIX, createLocalThemeId, isLocalThemeId };
