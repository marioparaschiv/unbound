import type { Discord } from '@unbound-app/api/metro/components';
import type { ReactNode } from 'react';

/** A settings screen's navigation, as `Discord.useNavigation()` returns it. */
export type Navigation = ReturnType<typeof Discord.useNavigation>;

// Unbound's settings route that draws whatever `render` returns, under `title`.
const PAGE_ROUTE = 'UNBOUND_CUSTOM';

/**
 * @description Pushes a settings sub-page, such as one item of a plugin's settings; the back button returns.
 * @param navigation The current settings screen's navigation.
 * @param title The page's header title.
 * @param render Draws the page; it renders inside the new screen, so its hooks see that screen's navigation.
 */
export function openPage(navigation: Navigation, title: string, render: () => ReactNode): void {
	navigation.push(PAGE_ROUTE, { title, render });
}

export default openPage;
