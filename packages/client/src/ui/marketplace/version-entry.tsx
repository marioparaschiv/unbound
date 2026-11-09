import type { AddonVersion } from '@unbound-app/contracts/addons';
import { View } from 'react-native';

import AddonTag from '~/ui/components/addon-tag';
import { Discord } from '~/metro/components';
import { messages } from '~/i18n/api';

import ChangelogSections from './changelog-sections';
import { formatListingDate } from './listing-date';
import useStyles from './version-entry.style';

type VersionEntryProps = {
	version: AddonVersion;
	latest: boolean;
	/** Ends the timeline's rail at this entry's dot. */
	last: boolean;
};

/** @description One version on the store page's timeline: its number, date and what changed in it. */
function VersionEntry({ version, latest, last }: VersionEntryProps) {
	const styles = useStyles();
	const { changes, changelog } = version;

	return (
		<View style={styles.entry}>
			<View style={styles.rail}>
				<View style={[styles.dot, latest ? styles.latestDot : null]} />
				{last ? null : <View style={styles.line} />}
			</View>
			<View style={[styles.body, last ? null : styles.spaced]}>
				<View style={styles.title}>
					<Discord.Text
						variant={latest ? 'text-md/bold' : 'text-md/semibold'}
						style={styles.version}
					>
						{`v${version.version}`}
					</Discord.Text>
					{latest ? (
						<AddonTag variant='brand'>{messages.UNBOUND_STORE_PAGE_LATEST}</AddonTag>
					) : null}
				</View>
				<Discord.Text variant='text-xs/medium' style={styles.date}>
					{formatListingDate(version.publishedAt)}
				</Discord.Text>
				{changes?.sections.length ? (
					<ChangelogSections changes={changes} />
				) : (
					<Discord.Text variant='text-sm/normal' style={styles.plain}>
						{changelog ?? messages.UNBOUND_UPDATES_NO_CHANGELOG}
					</Discord.Text>
				)}
			</View>
		</View>
	);
}

export default VersionEntry;
