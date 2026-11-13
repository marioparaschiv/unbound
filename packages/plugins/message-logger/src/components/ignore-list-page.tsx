import EntityList from '@unbound-plugins/shared/entities/entity-list';
import type { EntityKind } from '@unbound-plugins/shared/entities/entity';
import { settings, useSetting } from '@unbound-app/settings';
import { messages } from '@unbound-app/i18n';
import { ui } from '@unbound-app/api';

import { formatIdList, idList } from '~/lib/filters';

/** A setting that stores ignored ids. */
export type IgnoreListKey = 'ignoreUsers' | 'ignoreChannels' | 'ignoreGuilds';

type IgnoreListTexts = {
	title: string;
	description: string;
	add: string;
	search: string;
	unknown: string;
};

type IgnoreList = {
	kind: EntityKind;
	/** Reads the texts in the user's current locale. */
	texts: () => IgnoreListTexts;
};

/** What each ignore list holds and its texts. */
export const IGNORE_LISTS: Record<IgnoreListKey, IgnoreList> = {
	ignoreUsers: {
		kind: 'user',
		texts: () => ({
			title: messages.IGNORE_USERS,
			description: messages.IGNORE_USERS_SUBTITLE,
			add: messages.ADD_USER,
			search: messages.SEARCH_USERS,
			unknown: messages.UNKNOWN_USER,
		}),
	},
	ignoreChannels: {
		kind: 'channel',
		texts: () => ({
			title: messages.IGNORE_CHANNELS,
			description: messages.IGNORE_CHANNELS_SUBTITLE,
			add: messages.ADD_CHANNEL,
			search: messages.SEARCH_CHANNELS,
			unknown: messages.UNKNOWN_CHANNEL,
		}),
	},
	ignoreGuilds: {
		kind: 'guild',
		texts: () => ({
			title: messages.IGNORE_GUILDS,
			description: messages.IGNORE_GUILDS_SUBTITLE,
			add: messages.ADD_SERVER,
			search: messages.SEARCH_SERVERS,
			unknown: messages.UNKNOWN_SERVER,
		}),
	},
};

/**
 * @description The sub-page of one ignore list: the ignored users, channels or servers, an add row and a remove button each.
 * @param props The setting that stores the list.
 * @returns The page.
 */
function IgnoreListPage({ setting }: { setting: IgnoreListKey }) {
	const { kind, texts } = IGNORE_LISTS[setting];
	const { description, add, search, unknown } = texts();
	const value = useSetting(setting);

	return (
		<ui.Page>
			<EntityList
				kind={kind}
				description={description}
				value={[...idList(value)]}
				labels={{
					add,
					title: add,
					search,
					noResults: messages.NO_RESULTS,
					unknown,
					remove: messages.REMOVE,
				}}
				onChange={(ids) => {
					settings[setting] = formatIdList(ids);
				}}
			/>
		</ui.Page>
	);
}

export default IgnoreListPage;
