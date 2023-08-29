import { React, i18n } from '@metro/common';
import { Icons } from '@api/assets';
import { Button, Navigation } from '@metro/components';
import { Keys } from '@constants';
import { Dialog } from '@metro/ui';

import { InstallModal } from '@ui/settings/components';
import Themes from '@managers/themes';

import Create from './create';
import Load from './load';
import Editor from './editor';
import { Manifest } from '@typings/managers';
import { StaticSection, styles } from './index';

const background = Icons['background'];
const splash = Icons['screenshare_halfsheet_splash'];

const handleLoad = async (url: string, navigation: any) => {
	const manifest = await fetch(url, { cache: 'no-cache' }).then(r => r.json()) as Manifest;

	try {
		Themes.validateManifest(manifest as Manifest);
	} catch (e) {
		return Themes.logger.debug('Failed to validate manifest:', e.message);
	}

	const bundle = await fetch((manifest as any).bundle, { cache: 'no-cache' }).then(r => r.json());

	navigation.push(Keys.Custom, {
		title: 'Edit Theme',
		render: () => <Editor
			manifest={manifest}
			bundle={bundle}
		/>
	});
};

export default () => {
	const navigation = Navigation.useNavigation();
	const ref = React.useRef<InstanceType<typeof InstallModal>>();
	const url = React.useCallback(() => ref.current?.getInput(), [ref.current]);

	return <ReactNative.ImageBackground
		source={background}
		style={styles.background}
	>
		<StaticSection>
			<ReactNative.Image source={splash} />
			<ReactNative.Text style={styles.header}>
				{i18n.Messages.UNBOUND_THEME_EDITOR_CREATE_TITLE}
			</ReactNative.Text>
			<ReactNative.Text style={styles.subheader}>
				{i18n.Messages.UNBOUND_THEME_EDITOR_CREATE_DESC}
			</ReactNative.Text>
		</StaticSection>
		<StaticSection>
			<Button
				color={Button.Colors.BRAND}
				text={i18n.Messages.UNBOUND_THEME_EDITOR_CREATE_NEW}
				onPress={() => navigation.push(Keys.Custom, {
					title: i18n.Messages.UNBOUND_THEME_EDITOR_CREATE_NEW,
					render: Create
				})}
				size={Button.Sizes.MEDIUM}
				style={styles.button}
				look={Button.Looks.FILLED}
			/>
			<Button
				color={Button.Colors.BRAND}
				text={i18n.Messages.UNBOUND_THEME_EDITOR_LOAD_EXISTING}
				onPress={() => navigation.push(Keys.Custom, {
					title: i18n.Messages.UNBOUND_THEME_EDITOR_CREATE_NEW,
					render: Load
				})}
				size={Button.Sizes.MEDIUM}
				style={styles.button}
				look={Button.Looks.OUTLINED}
			/>
			<ReactNative.TouchableOpacity onPress={() => {
				Dialog.confirm({
					title: i18n.Messages.UNBOUND_THEME_EDITOR_LOAD_THEME_TITLE,
					children: <InstallModal manager={Themes} ref={ref} />,
					confirmText: i18n.Messages.UNBOUND_THEME_EDITOR_LOAD_THEME_CONFIRM,
					onConfirm: () => url() && handleLoad(url(), navigation)
				});
			}}>
				<ReactNative.Text style={styles.link}>{i18n.Messages.UNBOUND_THEME_EDITOR_LOAD_FROM_LINK}</ReactNative.Text>
			</ReactNative.TouchableOpacity>
		</StaticSection>
	</ReactNative.ImageBackground>;
};