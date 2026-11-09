import type { ReactNode } from 'react';

import { Discord } from '~/metro/components';

import type { ChangelogEntry } from './changelog';

import { openChangelog } from './open-changelog';

/** The fields an addon's and the loader's pending update share, as the row and its changelog read them. */
export type UpdateInfo = {
	version: string;
	changelog: string | null;
	changelogs: ChangelogEntry[];
};

type UpdateRowShellProps = {
	name: string;
	icon: number | undefined;
	/** The installed version, shown before the arrow. */
	installed: string;
	update: UpdateInfo;
	/** Appended to the version jump, such as the version a held addon stays on. */
	note?: string;
	/** The row's trailing action. */
	action: ReactNode;
	/** The changelog page's action. */
	actionLarge: ReactNode;
};

/**
 * @description One pending update: the version jump and what changed most recently, opening its changelog
 * with the action that applies it.
 * @param props The update, its installed and offered versions, and the two actions that apply it.
 * @returns The row.
 */
function UpdateRowShell({
	name,
	icon,
	installed,
	update,
	note,
	action,
	actionLarge,
}: UpdateRowShellProps) {
	const navigation = Discord.useNavigation();
	const versions = `v${installed} → v${update.version}`;
	const jump = note ? `${versions} · ${note}` : versions;

	return (
		<Discord.TableRow
			label={name}
			subLabel={jump}
			labelLineClamp={1}
			subLabelLineClamp={1}
			icon={<Discord.TableRowIcon source={icon} />}
			trailing={action}
			onPress={() =>
				openChangelog(navigation, {
					name,
					icon,
					installed,
					offered: update.version,
					changelogs: update.changelogs,
					action: actionLarge,
				})
			}
		/>
	);
}

export default UpdateRowShell;
