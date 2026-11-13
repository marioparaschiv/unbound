import { openPage } from '@unbound-plugins/shared/navigation/open-page';
import { Discord } from '@unbound-app/api/metro/components';
import type { ReactNode } from 'react';
import { ui } from '@unbound-app/api';

/** Props of {@link EntityListRow}. */
export type EntityListRowProps = {
	/** The row's label, and the sub-page's title. */
	label: string;
	/** How many ids the list holds, drawn at the row's end. */
	count: number;
	/** Draws the sub-page's list, usually an {@link EntityList}; it renders in the new screen, so it reads its setting with hooks there. */
	renderList: () => ReactNode;
};

/**
 * @description A settings row with a list's size that pushes a sub-page holding the list, for a panel with several lists.
 * @param props The label, the list's size and what the sub-page draws.
 * @returns The row.
 */
function EntityListRow({ label, count, renderList }: EntityListRowProps) {
	const navigation = Discord.useNavigation();

	return (
		<ui.Row
			label={label}
			trailing={<Discord.TableRow.TrailingText text={String(count)} />}
			arrow
			onPress={() => openPage(navigation, label, () => <ui.Page>{renderList()}</ui.Page>)}
		/>
	);
}

export default EntityListRow;
