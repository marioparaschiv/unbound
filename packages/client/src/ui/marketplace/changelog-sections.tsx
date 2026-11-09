import type { ChangeType, Changelog } from '@unbound-app/contracts/changelog';
import { View } from 'react-native';

import { Discord } from '~/metro/components';
import { messages } from '~/i18n/api';

import useStyles from './changelog-sections.style';

type ChangelogSectionsProps = {
	changes: Changelog;
};

const LABELS: Record<ChangeType, () => string> = {
	added: () => messages.UNBOUND_CHANGE_ADDED,
	changed: () => messages.UNBOUND_CHANGE_CHANGED,
	fixed: () => messages.UNBOUND_CHANGE_FIXED,
	removed: () => messages.UNBOUND_CHANGE_REMOVED,
};

/** @description A release's typed changelog: one tinted label and bulleted list per change type. */
function ChangelogSections({ changes }: ChangelogSectionsProps) {
	const styles = useStyles();

	return (
		<View style={styles.sections}>
			{changes.sections.map((section) => (
				<View key={section.type} style={styles.section}>
					<Discord.Text
						variant='text-xs/bold'
						style={[styles.label, styles[section.type]]}
					>
						{LABELS[section.type]().toUpperCase()}
					</Discord.Text>
					{section.items.map((item, index) => (
						<View key={index} style={styles.item}>
							<Discord.Text variant='text-sm/normal' style={styles.bullet}>
								•
							</Discord.Text>
							<Discord.Text variant='text-sm/normal' style={styles.text}>
								{item}
							</Discord.Text>
						</View>
					))}
				</View>
			))}
		</View>
	);
}

export default ChangelogSections;
