import { ActivityIndicator, View } from 'react-native';

import { findPageMedia, type AddonPageContent } from '~/marketplace/addon-page';
import Empty from '~/ui/components/empty-state';
import { Discord } from '~/metro/components';
import { messages } from '~/i18n/api';

import type { ResourceHandle } from './use-resource';

import useStyles from './addon-page.style';
import PageMarkdown from './page-markdown';
import PageGallery from './page-gallery';
import PageMedia from './page-media';

type AddonPageBodyProps = {
	resource: ResourceHandle<AddonPageContent>;
	name: string;
};

/**
 * @description The part of a addon page its ADDON.md supplies: the banner, the gallery and the body in a
 * card. It spins in place while the page loads, so the header above it never waits.
 */
function AddonPageBody({ resource, name }: AddonPageBodyProps) {
	const styles = useStyles();
	const { state, retry } = resource;

	if (state.status === 'missing') {
		return null;
	}

	if (state.status === 'loading') {
		return <ActivityIndicator style={styles.loading} />;
	}

	if (state.status === 'failed') {
		return (
			<View style={styles.inset}>
				<Empty>{messages.UNBOUND_STORE_PAGE_FAILED}</Empty>
				<Discord.Button
					text={messages.UNBOUND_UPDATES_RETRY}
					variant='secondary'
					onPress={retry}
				/>
			</View>
		);
	}

	const page = state.value;
	const frontmatter = page.measured?.frontmatter;
	const banner = frontmatter ? findPageMedia(page, frontmatter.banner) : undefined;

	return (
		<>
			{banner ? (
				<View style={styles.inset}>
					<PageMedia media={banner} alt={name} />
				</View>
			) : null}
			{frontmatter?.media.length ? (
				<PageGallery page={page} entries={frontmatter.media} />
			) : null}
			<View style={styles.inset}>
				<Discord.Card variant='primary' border='subtle' style={styles.card}>
					<PageMarkdown page={page} />
				</Discord.Card>
			</View>
		</>
	);
}

export default AddonPageBody;
