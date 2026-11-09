import type { ListedAddon } from '@unbound-app/contracts/addons';
import type { AddonKind } from '@unbound-app/types/addons';
import { ScrollView, View } from 'react-native';
import { useEffect } from 'react';

import { loadStorePage } from '~/marketplace/store-page';
import { Discord, SafeArea } from '~/metro/components';

import VersionHistory from './version-history';
import StorePageBody from './store-page-body';
import AboutSection from './about-section';
import useStyles from './store-page.style';
import StoreHeader from './store-header';
import useResource from './use-resource';

/** The listed addon whose latest version's page the screen shows. */
export type StorePageParams = {
	addon: ListedAddon;
	kind: AddonKind;
};

type StorePageScreenProps = {
	route: { params: StorePageParams };
};

/**
 * @description A listed addon's store page, laid out like the website's: the header with its install
 * button, the ADDON.md banner, gallery and body, What's new, then About. Everything but the body comes
 * from the listing, so it draws at once; the body is fetched once per version and session.
 */
function StorePageScreen({ route }: StorePageScreenProps) {
	const styles = useStyles();
	const { addon, kind } = route.params;
	const { manifest, pageUrl } = addon.latestVersion;
	const navigation = Discord.useNavigation();
	const resource = useResource(pageUrl ?? null, loadStorePage);

	useEffect(() => {
		navigation.setOptions({ title: manifest.name });
	}, [manifest.name]);

	return (
		<ScrollView contentContainerStyle={styles.scroll}>
			<SafeArea.SafeAreaPaddingView bottom style={styles.content}>
				<View style={styles.inset}>
					<StoreHeader addon={addon} kind={kind} />
				</View>
				<StorePageBody resource={resource} name={manifest.name} />
				<View style={styles.inset}>
					<VersionHistory addon={addon} />
				</View>
				<View style={styles.inset}>
					<AboutSection addon={addon} />
				</View>
			</SafeArea.SafeAreaPaddingView>
		</ScrollView>
	);
}

export default StorePageScreen;
