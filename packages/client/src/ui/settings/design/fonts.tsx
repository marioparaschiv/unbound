import { ScrollView } from 'react-native';

import RestartRow from '~/ui/settings-kit/restart-row';
import { Discord } from '~/metro/components';
import { ActionSheets } from '~/metro/api';
import { format } from '~/i18n/api';

import FontInstallSheet from './font-install-sheet';
import FontPresetsGroup from './font-presets-group';
import InstalledFontRow from './installed-font-row';
import FontOverrideRow from './font-override-row';
import useStyles from './fonts.style';
import useFonts from './use-fonts';

const INSTALL_SHEET = 'unbound-font-install';

function openInstallSheet() {
	ActionSheets.openLazy(Promise.resolve({ default: FontInstallSheet }), INSTALL_SHEET, {
		onClose: () => ActionSheets.hideActionSheet(INSTALL_SHEET),
	});
}

/**
 * @description The Fonts tab: one override row per Discord font group, the installed fonts with an
 * install row, and the presets. An override change offers a restart, which lays every text out again;
 * an older loader gets an update prompt.
 */
function FontsTab() {
	const styles = useStyles();
	const fonts = useFonts();

	if (!fonts.isSupported()) {
		return (
			<ScrollView contentContainerStyle={styles.content}>
				<Discord.TableRowGroup title={format('UNBOUND_FONTS')}>
					<Discord.TableRow
						label={format('UNBOUND_FONTS_UPDATE_LOADER')}
						subLabel={format('UNBOUND_FONTS_UPDATE_LOADER_HINT')}
					/>
				</Discord.TableRowGroup>
			</ScrollView>
		);
	}

	return (
		<ScrollView contentContainerStyle={styles.content}>
			{fonts.needsRestart() ? <RestartRow /> : null}
			<Discord.TableRowGroup
				title={format('UNBOUND_FONTS_GROUPS')}
				description={format('UNBOUND_FONTS_HINT')}
			>
				{fonts.getTargets().map((target) => (
					<FontOverrideRow key={target.group} group={target.group} />
				))}
			</Discord.TableRowGroup>
			<Discord.TableRowGroup title={format('UNBOUND_FONTS_INSTALLED')}>
				<Discord.TableRow
					label={format('UNBOUND_FONTS_INSTALL')}
					arrow
					onPress={openInstallSheet}
				/>
				{fonts.getFamilies().map((family) => (
					<InstalledFontRow key={family.family} family={family} />
				))}
			</Discord.TableRowGroup>
			<FontPresetsGroup />
		</ScrollView>
	);
}

export default FontsTab;
