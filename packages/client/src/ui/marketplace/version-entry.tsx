import type { AddonVersion } from '@unbound-app/contracts/addons';
import { View } from 'react-native';

import AddonTag from '~/ui/components/addon-tag';
import { Discord } from '~/metro/components';
import { messages } from '~/i18n/api';

import ChangelogMarkdown from './changelog-markdown';
import ChangelogSections from './changelog-sections';
import { formatListingDate } from './listing-date';
import useStyles from './version-entry.style';

/** One release on a timeline: an addon version, or a loader release, which has no typed `changes`. */
export type TimelineVersion = Pick<AddonVersion, 'version' | 'changelog' | 'publishedAt'> &
	Partial<Pick<AddonVersion, 'changes'>>;

type VersionEntryProps = {
	version: TimelineVersion;
	latest: boolean;
	/** Ends the timeline's rail at this entry's dot. */
	last: boolean;
};

/** @description One version on a changelog timeline: its number, date and what changed in it. */
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
				) : changelog ? (
					<ChangelogMarkdown text={changelog} />
				) : (
					<Discord.Text variant='text-sm/normal' style={styles.plain}>
						{messages.UNBOUND_UPDATES_NO_CHANGELOG}
					</Discord.Text>
				)}
			</View>
		</View>
	);
}

export default VersionEntry;
