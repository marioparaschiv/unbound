import { Section, useFormStyles } from '@ui/components/misc';
import { Constants, ReactNative as RN, Theme } from '@metro/common';
import { Redesign, Slider } from '@metro/components';
import { useSettingsStore } from '@api/storage';
import { Keys, Links } from '@constants';
import { Strings } from '@api/i18n';
import Assets from '@api/assets';
import Toasts from '@api/toasts';

import AssetBrowser from './assets';
import Logs from './logger';

const {
	TableSwitchRow,
	TextInput,
	TableRow,
	TableRowIcon
} = Redesign;

export default function Developer() {
	const navigation = Redesign.useNavigation();
	const settings = useSettingsStore('unbound');
	const { endStyle, formText } = useFormStyles();

	const Icons = {
		Debug: Assets.getIDByName('debug'),
		Browser: Assets.getIDByName('ImageTextIcon'),
		Trash: Assets.getIDByName('trash')
	};

	return <RN.ScrollView>
		<Section title={Strings.UNBOUND_DEBUG_BRIDGE}>
			<TableSwitchRow
				label={Strings.UNBOUND_ENABLED}
				subLabel={Strings.UNBOUND_DEBUG_BRIDGE_DESC}
				value={settings.get('dev.debugBridge.enabled', false)}
				onValueChange={() => settings.toggle('dev.debugBridge.enabled', false)}
			/>
			<RN.View style={endStyle}>
				<RN.View style={{ margin: 8 }}>
					<TextInput
						isRound
						size='md'
						value={settings.get('dev.debugBridge.host', '192.168.0.35:9090')}
						onChange={v => settings.set('dev.debugBridge.host', v)}
						label={Strings.UNBOUND_DEBUG_BRIDGE_IP}
						disabled={!settings.get('dev.debugBridge.enabled', false)}
					/>
				</RN.View>
			</RN.View>
		</Section>
		<Section title={Strings.UNBOUND_LOADER}>
			<TableSwitchRow
				label={Strings.UNBOUND_ENABLED}
				subLabel={Strings.UNBOUND_LOADER_ENABLED_DESC}
				value={settings.get('loader.enabled', true)}
				onValueChange={() => settings.toggle('loader.enabled', true)}
			/>
			<TableSwitchRow
				label={Strings.UNBOUND_LOADER_DEVTOOLS}
				subLabel={Strings.UNBOUND_LOADER_DEVTOOLS_DESC}
				value={settings.get('loader.devtools', false)}
				onValueChange={() => settings.toggle('loader.devtools', false)}
			/>
			<TableSwitchRow
				label={Strings.UNBOUND_LOADER_UPDATER_FORCE}
				subLabel={Strings.UNBOUND_LOADER_UPDATER_FORCE_DESC}
				value={settings.get('loader.update.force', false)}
				onValueChange={() => settings.toggle('loader.update.force', false)}
			/>
			<RN.View style={endStyle}>
				<RN.View style={{ margin: 8 }}>
					<TextInput
						isRound
						size='md'
						value={settings.get('loader.update.url', Links.Bundle)}
						onChange={v => settings.set('loader.update.url', v)}
						label={Strings.UNBOUND_LOADER_CUSTOM_BUNDLE}
					/>
				</RN.View>
			</RN.View>
		</Section>
		<Section title={Strings.UNBOUND_ERROR_BOUNDARY}>
			<TableSwitchRow
				label={Strings.UNBOUND_ERROR_BOUNDARY}
				subLabel={Strings.UNBOUND_ERROR_BOUNDARY_DESC}
				value={settings.get('dev.errorBoundary', true)}
				onValueChange={() => settings.toggle('dev.errorBoundary', true)}
			/>
			<TableRow
				label={Strings.UNBOUND_ERROR_BOUNDARY_TRIGGER_TITLE}
				subLabel={Strings.UNBOUND_ERROR_BOUNDARY_TRIGGER_DESC}
				onPress={() => navigation.push(Keys.Custom, {
					title: null,

					// @ts-expect-error -- purposefully trip the boundary by rendering undefined
					render: () => <undefined />
				})}
				arrow
			/>
		</Section>
		<Section title={Strings.UNBOUND_LOGGING}>
			<TableRow
				label={Strings.UNBOUND_LOGGING_DEPTH}
				trailing={(
					<RN.Text style={formText}>
						{Strings.UNBOUND_LOGGING_DEPTH_DESC.format({ depth: settings.get('dev.logging.depth', 3) })}
					</RN.Text>
				)}
			/>
			<RN.View style={[endStyle, { borderBottomRightRadius: 0, borderBottomLeftRadius: 0 }]}>
				<Slider
					style={{ marginHorizontal: 15, marginVertical: 5 }}
					value={settings.get('dev.logging.depth', 3)}
					onValueChange={v => settings.set('dev.logging.depth', Math.round(v))}
					minimumValue={1}
					maximumValue={6}
					minimumTrackTintColor={Theme.unsafe_rawColors.BRAND_500}
					maximumTrackTintColor={Constants.UNSAFE_Colors.GREY2}
					tapToSeek
				/>
			</RN.View>
			<TableRow
				label={Strings.UNBOUND_DEBUG_LOGS}
				icon={<TableRowIcon source={Icons.Debug} />}
				onPress={() => navigation.push(Keys.Custom, {
					title: Strings.UNBOUND_DEBUG_LOGS,
					render: Logs
				})}
				arrow
			/>
		</Section>
		<Section title={Strings.UNBOUND_MISC}>
			<TableRow
				label={Strings.UNBOUND_FORCE_GARBAGE_COLLECTION}
				icon={<TableRowIcon source={Icons.Trash} />}
				arrow
				onPress={async () => {
					await window.gc();
					Toasts.showToast({
						title: Strings.UNBOUND_GARBAGE_COLLECTION,
						content: Strings.UNBOUND_GARBAGE_COLLECTION_TOAST,
						icon: Icons.Trash
					});
				}}
			/>
			<TableRow
				label={Strings.UNBOUND_ASSET_BROWSER}
				icon={<TableRowIcon source={Icons.Browser} />}
				onPress={() => navigation.push(Keys.Custom, {
					title: Strings.UNBOUND_ASSET_BROWSER,
					render: AssetBrowser
				})}
				arrow
			/>
		</Section>
		<RN.View style={{ marginBottom: 50 }} />
	</RN.ScrollView>;
}