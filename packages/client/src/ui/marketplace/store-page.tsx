import { ActivityIndicator, ScrollView, View } from 'react-native';
import type { ListedAddon } from '@unbound-app/contracts/addons';
import type { AddonKind } from '@unbound-app/types/addons';
import { useEffect } from 'react';

import AddonCardHeader from '~/ui/components/addon-card-header';
import { findPageMedia } from '~/marketplace/store-page';
import { Discord, SafeArea } from '~/metro/components';
import Empty from '~/ui/components/empty-state';
import { messages } from '~/i18n/api';

import useStorePage from './use-store-page';
import PageGallery from './page-gallery';
import PageMedia from './page-media';
import PageBody from './page-body';

/** The listed addon whose latest version's page the screen shows. */
export type StorePageParams = {
	addon: ListedAddon;
	kind: AddonKind;
};

type StorePageScreenProps = {
	route: { params: StorePageParams };
};

/**
 * @description A listed addon's store page: the banner, the addon's header, the gallery, then the
 * ADDON.md body. A version without a page on the CDN says so; a failed fetch offers a retry.
 */
function StorePageScreen({ route }: StorePageScreenProps) {
	const { addon, kind } = route.params;
	const { manifest, pageUrl } = addon.latestVersion;
	const navigation = Discord.useNavigation();
	const { state, retry } = useStorePage(pageUrl ?? null);

	useEffect(() => {
		navigation.setOptions({ title: manifest.name });
	}, [manifest.name]);

	if (state.status === 'missing') {
		return <Empty>{messages.UNBOUND_STORE_PAGE_MISSING}</Empty>;
	}

	if (state.status === 'loading') {
		return <ActivityIndicator style={{ flex: 1 }} />;
	}

	if (state.status === 'failed') {
		return (
			<View style={{ flex: 1 }}>
				<Empty>{messages.UNBOUND_STORE_PAGE_FAILED}</Empty>
				<Discord.Button
					text={messages.UNBOUND_UPDATES_RETRY}
					variant='secondary'
					onPress={retry}
				/>
			</View>
		);
	}

	const { page } = state;
	const frontmatter = page.measured?.frontmatter;
	const banner = frontmatter ? findPageMedia(page, frontmatter.banner) : undefined;

	return (
		<ScrollView contentContainerStyle={{ paddingVertical: 16 }}>
			<SafeArea.SafeAreaPaddingView bottom style={{ gap: 16 }}>
				{banner ? (
					<View style={{ paddingHorizontal: 16 }}>
						<PageMedia media={banner} alt={manifest.name} />
					</View>
				) : null}
				<View style={{ paddingHorizontal: 16 }}>
					<AddonCardHeader id={addon.id} kind={kind} manifest={manifest} />
				</View>
				{frontmatter?.media.length ? (
					<PageGallery page={page} entries={frontmatter.media} />
				) : null}
				<View style={{ paddingHorizontal: 16 }}>
					<PageBody page={page} />
				</View>
			</SafeArea.SafeAreaPaddingView>
		</ScrollView>
	);
}

export default StorePageScreen;
