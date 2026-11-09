import type { Navigation } from '@unbound-app/types/components';
import type { ReactNode } from 'react';

import { Screens } from '~/core/constants';

import type { ChangelogProps } from './changelog';

import Changelog from './changelog';

export type ChangelogTarget = Omit<ChangelogProps, 'children'> & {
	/** The action under the changelog that applies the update. */
	action: ReactNode;
};

/**
 * @description Opens a pending update's changelog page, with the action that applies it.
 * @param navigation The current screen's navigation.
 * @param target The update's name, icon, versions, changelogs and action.
 */
export function openChangelog(navigation: Navigation, { action, ...page }: ChangelogTarget): void {
	navigation.push(Screens.PanelHost, {
		title: page.name,
		render: () => <Changelog {...page}>{action}</Changelog>,
	});
}

export default openChangelog;
