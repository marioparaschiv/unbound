import { useSettingsStore } from '@api/storage';
import { React, i18n } from '@metro/common';
import TableRowGroupWrapper, { endStyle } from '@ui/components/TableRowGroupWrapper';
import { Keys, Links } from '@constants';
import Assets from '@api/assets';

import { Redesign, Forms, Navigation } from '@metro/components';
import AssetBrowser from './assets';
import Logs from './logger';

const { TableRow, TableSwitchRow, TableRowIcon } = Redesign;

export default function () {
	const navigation = Navigation.useNavigation();
	const settings = useSettingsStore('unbound');

	const Icons = {
		Debug: Assets.getIDByName('debug'),
		Browser: Assets.getIDByName('ic_image'),
        Trash: Assets.getIDByName('trash')
	};

	return <ReactNative.ScrollView>
        <TableRowGroupWrapper title={i18n.Messages.UNBOUND_MISC}>
            <TableRow
                label={i18n.Messages.UNBOUND_FORCE_GARBAGE_COLLECTION_TITLE}
                subLabel={i18n.Messages.UNBOUND_FORCE_GARBAGE_COLLECTION_DESC}
                icon={<TableRowIcon source={Icons.Trash} />}
                onPress={window.gc}
                arrow
            />
            <TableRow
                label={i18n.Messages.UNBOUND_ASSET_BROWSER}
                icon={<TableRowIcon source={Icons.Browser} />}
                onPress={() => navigation.push(Keys.Custom, {
                    title: i18n.Messages.UNBOUND_ASSET_BROWSER,
                    render: AssetBrowser
                })}
                arrow
            />
            <TableRow
                label={i18n.Messages.UNBOUND_DEBUG_LOGS}
                icon={<TableRowIcon source={Icons.Debug} />}
                onPress={() => navigation.push(Keys.Custom, {
                    title: i18n.Messages.UNBOUND_DEBUG_LOGS,
                    render: Logs
                })}
                arrow
            />
        </TableRowGroupWrapper>
        <TableRowGroupWrapper title={i18n.Messages.UNBOUND_DEBUG_BRIDGE}>
            <TableSwitchRow
                label={i18n.Messages.UNBOUND_ENABLED}
                subLabel={i18n.Messages.UNBOUND_DEBUG_BRIDGE_DESC}
                value={settings.get('dev.debugBridge.enabled', false)}
                onValueChange={() => settings.toggle('dev.debugBridge.enabled', false)}
            />
            <Forms.FormInput
                value={settings.get('dev.debugBridge.host', '192.168.0.35:9090')}
                onChange={v => settings.set('dev.debugBridge.host', v)}
                title={i18n.Messages.UNBOUND_DEBUG_BRIDGE_IP}
                disabled={!settings.get('dev.debugBridge.enabled', false)}
                style={endStyle}
            />
        </TableRowGroupWrapper>
        <TableRowGroupWrapper title={i18n.Messages.UNBOUND_LOADER}>
            <TableSwitchRow
                label={i18n.Messages.UNBOUND_ENABLED}
                subLabel={i18n.Messages.UNBOUND_LOADER_ENABLED_DESC}
                value={settings.get('loader.enabled', true)}
                onValueChange={() => settings.toggle('loader.enabled', true)}
            />
            <TableSwitchRow
                label={i18n.Messages.UNBOUND_LOADER_DEVTOOLS}
                subLabel={i18n.Messages.UNBOUND_LOADER_DEVTOOLS_DESC}
                value={settings.get('loader.devtools', false)}
                onValueChange={() => settings.toggle('loader.devtools', false)}
            />
            <TableSwitchRow
                label={i18n.Messages.UNBOUND_LOADER_UPDATER_FORCE}
                subLabel={i18n.Messages.UNBOUND_LOADER_UPDATER_FORCE_DESC}
                value={settings.get('loader.update.force', false)}
                onValueChange={() => settings.toggle('loader.update.force', false)}
            />
            <Forms.FormInput
                value={settings.get('loader.update.url', Links.Bundle)}
                onChange={v => settings.set('loader.update.url', v)}
                title={i18n.Messages.UNBOUND_LOADER_CUSTOM_BUNDLE}
                disabled={!settings.get('loader.update.force', false)}
                style={endStyle}
            />
        </TableRowGroupWrapper>
        <TableRowGroupWrapper title={i18n.Messages.UNBOUND_ERROR_BOUNDARY}>
            <TableSwitchRow
                label={i18n.Messages.UNBOUND_ERROR_BOUNDARY}
                subLabel={i18n.Messages.UNBOUND_ERROR_BOUNDARY_DESC}
                value={settings.get('dev.errorBoundary', true)}
                onValueChange={() => settings.toggle('dev.errorBoundary', true)}
            />
            <TableRow
                label={i18n.Messages.UNBOUND_ERROR_BOUNDARY_TRIGGER_TITLE}
                subLabel={i18n.Messages.UNBOUND_ERROR_BOUNDARY_TRIGGER_DESC}
                onPress={() => navigation.push(Keys.Custom, {
                    title: null,
                    
                    // @ts-expect-error -- purposefully trip the boundary by rendering undefined
                    render: () => <undefined />
                })}
                arrow
            />
        </TableRowGroupWrapper>
        <ReactNative.View style={{ marginBottom: 50 }} />
	</ReactNative.ScrollView>;
}