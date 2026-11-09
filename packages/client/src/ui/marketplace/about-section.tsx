import type { ListedAddon } from '@unbound-app/contracts/addons';
import { View } from 'react-native';

import { formatBytes, sourceUrl } from '~/marketplace/listing-facts';
import { messages, format } from '~/i18n/api';
import { Discord } from '~/metro/components';
import { Linking } from '~/metro/api';
import { icons } from '~/assets/api';

import { formatListingDate } from './listing-date';
import useStyles from './about-section.style';
import StoreSection from './store-section';

type AboutSectionProps = {
	addon: ListedAddon;
};

const PLATFORM_LABELS: Record<string, string> = { ios: 'iOS', android: 'Android' };

/**
 * @description The store page's About card, as on the website: when the listed version was published,
 * its size, the Unbound it needs, its platforms, and a link to its source at the pinned commit.
 */
function AboutSection({ addon }: AboutSectionProps) {
	const styles = useStyles();
	const { manifest, publishedAt, bundleSize, source } = addon.latestVersion;
	const min = manifest.unbound?.min;
	const platforms = manifest.platforms ? Object.keys(manifest.platforms) : ['ios', 'android'];
	const facts = [
		[messages.UNBOUND_STORE_PAGE_UPDATED_LABEL, formatListingDate(publishedAt)],
		[messages.UNBOUND_STORE_PAGE_SIZE, formatBytes(bundleSize)],
		[
			messages.UNBOUND_STORE_PAGE_REQUIRES,
			min
				? format('UNBOUND_STORE_PAGE_REQUIRES_VERSION', { version: min })
				: messages.UNBOUND_STORE_PAGE_ANY_VERSION,
		],
		[
			messages.UNBOUND_STORE_PAGE_PLATFORMS,
			platforms.map((platform) => PLATFORM_LABELS[platform] ?? platform).join(', '),
		],
	];

	return (
		<StoreSection title={messages.UNBOUND_STORE_PAGE_ABOUT}>
			<View style={styles.facts}>
				{facts.map(([label, value]) => (
					<View key={label} style={styles.fact}>
						<Discord.Text variant='text-sm/medium' style={styles.label}>
							{label}
						</Discord.Text>
						<Discord.Text variant='text-sm/semibold' style={styles.value}>
							{value}
						</Discord.Text>
					</View>
				))}
			</View>
			{source ? (
				<Discord.Button
					size='md'
					variant='secondary'
					icon={icons['LinkExternalSmallIcon']}
					text={messages.UNBOUND_STORE_PAGE_SOURCE}
					onPress={() => void Linking.openURL(sourceUrl(source))}
				/>
			) : null}
		</StoreSection>
	);
}

export default AboutSection;
