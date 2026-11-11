import type { ListedAddon } from '@unbound-app/contracts/addons';
import { Dimensions, ScrollView, View } from 'react-native';
import type { AddonKind } from '@unbound-app/types/addons';
import { useCallback, useEffect, useRef } from 'react';

import { loadAddonPage } from '~/marketplace/addon-page';
import { Discord, SafeArea } from '~/metro/components';

import ScreenRectContext, { type MeasureOnScreen } from './screen-rect-context';
import AddonPageHeader from './addon-page-header';
import VersionHistory from './version-history';
import AddonPageBody from './addon-page-body';
import AboutSection from './about-section';
import useStyles from './addon-page.style';
import useResource from './use-resource';

/** The listed addon whose latest version's page the screen shows. */
export type AddonPageParams = {
	addon: ListedAddon;
	kind: AddonKind;
};

type AddonPageScreenProps = {
	route: { params: AddonPageParams };
};

/**
 * @description A listed addon's addon page, laid out like the website's: the header with its install
 * button, the ADDON.md banner, gallery and body, What's new, then About. Everything but the body comes
 * from the listing, so it draws at once; the body is fetched once per version and session.
 */
function AddonPageScreen({ route }: AddonPageScreenProps) {
	const styles = useStyles();
	const { addon, kind } = route.params;
	const { manifest, pageUrl } = addon.latestVersion;
	const navigation = Discord.useNavigation();
	const resource = useResource(pageUrl ?? null, loadAddonPage);
	const screen = useRef<View>(null);

	// Settings is a bottom-anchored sheet with its own root; the media viewer lays out from the screen's top.
	// The gap under the page's bottom edge is how far down the sheet sits.
	const measureOnScreen = useCallback<MeasureOnScreen>((view, done) => {
		if (!view || !screen.current) {
			done(undefined);

			return;
		}

		const page = screen.current;

		view.measureInWindow((x, y, width, height) =>
			page.measureInWindow((_x, pageY, _width, pageHeight) =>
				done({
					x,
					y: y + Dimensions.get('window').height - (pageY + pageHeight),
					width,
					height,
				}),
			),
		);
	}, []);

	useEffect(() => {
		navigation.setOptions({ title: manifest.name });
	}, [manifest.name]);

	return (
		<ScreenRectContext.Provider value={measureOnScreen}>
			<View ref={screen} style={styles.screen}>
				<ScrollView contentContainerStyle={styles.scroll}>
					<SafeArea.SafeAreaPaddingView bottom style={styles.content}>
						<View style={styles.inset}>
							<AddonPageHeader addon={addon} kind={kind} />
						</View>
						<AddonPageBody resource={resource} name={manifest.name} />
						<View style={styles.inset}>
							<VersionHistory addon={addon} />
						</View>
						<View style={styles.inset}>
							<AboutSection addon={addon} />
						</View>
					</SafeArea.SafeAreaPaddingView>
				</ScrollView>
			</View>
		</ScreenRectContext.Provider>
	);
}

export default AddonPageScreen;
