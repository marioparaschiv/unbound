import RestartRow from '~/ui/settings-kit/restart-row';
import { Discord } from '~/metro/components';
import { showDialog } from '~/dialogs/api';
import Page from '~/ui/components/page';
import { icons } from '~/assets/api';
import { format } from '~/i18n/api';

import FontInstallDialog from './font-install-dialog';
import FontPresetsGroup from './font-presets-group';
import InstalledFontRow from './installed-font-row';
import FontOverrideRow from './font-override-row';
import FontPreview from './font-preview';
import useFonts from './use-fonts';

function openInstallDialog() {
	showDialog({
		title: format('UNBOUND_FONTS_INSTALL'),
		body: format('UNBOUND_FONTS_INSTALL_HINT'),
		content: FontInstallDialog,
		cancel: format('UNBOUND_CANCEL'),
	});
}

/**
 * @description The Fonts tab: a live preview, one row per Discord font group, the installed fonts with an
 * install row, and the presets. An override change offers a restart, which lays every text out again;
 * an older loader gets an update prompt.
 */
function FontsTab() {
	const fonts = useFonts();

	if (!fonts.isSupported()) {
		return (
			<Page>
				<Discord.TableRowGroup title={format('UNBOUND_FONTS')}>
					<Discord.TableRow
						label={format('UNBOUND_FONTS_UPDATE_LOADER')}
						subLabel={format('UNBOUND_FONTS_UPDATE_LOADER_HINT')}
					/>
				</Discord.TableRowGroup>
			</Page>
		);
	}

	return (
		<Page>
			{fonts.needsRestart() ? <RestartRow /> : null}
			<FontPreview />
			<Discord.TableRowGroup
				title={format('UNBOUND_FONTS_GROUPS')}
				helperText={format('UNBOUND_FONTS_GROUPS_HINT')}
			>
				{fonts.getTargets().map((target) => (
					<FontOverrideRow key={target.group} group={target.group} />
				))}
			</Discord.TableRowGroup>
			<Discord.TableRowGroup title={format('UNBOUND_FONTS_INSTALLED')}>
				<Discord.TableRow
					label={format('UNBOUND_FONTS_INSTALL')}
					icon={<Discord.TableRowIcon source={icons.DownloadIcon} />}
					arrow
					onPress={openInstallDialog}
				/>
				{fonts.getFamilies().map((family) => (
					<InstalledFontRow key={family.family} family={family} />
				))}
			</Discord.TableRowGroup>
			<FontPresetsGroup />
		</Page>
	);
}

export default FontsTab;
