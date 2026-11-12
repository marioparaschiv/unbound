import type { ListedAddon } from '@unbound-app/contracts/addons';
import { ActivityIndicator } from 'react-native';
import { useState } from 'react';

import { fetchAddonVersions } from '~/addons/versions';
import { Discord } from '~/metro/components';
import { messages } from '~/i18n/api';

import VersionEntry from './version-entry';
import useResource from './use-resource';
import PageCard from './page-card';

type VersionHistoryProps = {
	addon: ListedAddon;
};

/**
 * @description The addon page's What's new card: the listed version's changes from the catalog, then
 * every version on a timeline once asked for, which is the only request the card makes.
 */
function VersionHistory({ addon }: VersionHistoryProps) {
	const [expanded, setExpanded] = useState(false);
	const { state, retry } = useResource(expanded ? addon.id : null, fetchAddonVersions);
	const versions = state.status === 'ready' ? state.value : [addon.latestVersion];

	return (
		<PageCard title={messages.UNBOUND_UPDATES_CHANGELOG}>
			{versions.map((version, index) => (
				<VersionEntry
					key={version.version}
					version={version}
					latest={index === 0}
					last={index === versions.length - 1}
				/>
			))}
			{expanded ? null : (
				<Discord.Button
					size='md'
					variant='secondary'
					text={messages.UNBOUND_STORE_PAGE_ALL_VERSIONS}
					onPress={() => setExpanded(true)}
				/>
			)}
			{expanded && state.status === 'loading' ? <ActivityIndicator /> : null}
			{expanded && state.status === 'failed' ? (
				<Discord.Button
					size='md'
					variant='secondary'
					text={messages.UNBOUND_VERSIONS_FAILED}
					onPress={retry}
				/>
			) : null}
		</PageCard>
	);
}

export default VersionHistory;
