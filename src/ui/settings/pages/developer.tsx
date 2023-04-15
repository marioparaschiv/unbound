import { useSettingsStore } from '@api/storage';
import { React, i18n } from '@metro/common';
import { Screens } from '@constants';
import Assets from '@api/assets';

import { Forms, Navigation } from '@metro/components';
import AssetBrowser from './assets';
import Logs from './logger';

export default function () {
  const navigation = Navigation.useNavigation();
  const settings = useSettingsStore('enmity');

  const Icons = {
    Debug: Assets.getIDByName('debug')
  };

  return <>
    <Forms.FormSection title={i18n.Messages.ENMITY_DEBUG_BRIDGE}>
      <Forms.FormRow
        label={i18n.Messages.ENMITY_DEBUG_BRIDGE_CONNECT}
        trailing={<Forms.FormSwitch
          value={settings.get('dev.debugBridge', false)}
          onValueChange={() => settings.toggle('dev.debugBridge', false)}
        />}
      />
      {settings.get('dev.debugBridge', false) && <>
        <Forms.FormDivider />
        <Forms.FormInput
          value={settings.get('dev.debugBridgeHost', '192.168.0.35:9090')}
          onChange={v => settings.set('dev.debugBridgeHost', v)}
          title={i18n.Messages.ENMITY_DEBUG_BRIDGE_IP}
        />
      </>}
    </Forms.FormSection>
    <Forms.FormSection title={i18n.Messages.ENMITY_MISC}>
      <Forms.FormRow
        label={i18n.Messages.ENMITY_ERROR_BOUNDARY}
        subLabel={i18n.Messages.ENMITY_ERROR_BOUNDARY_DESC}
        trailing={<Forms.FormSwitch
          value={settings.get('dev.errorBoundaryEnabled', true)}
          onValueChange={() => settings.toggle('dev.errorBoundaryEnabled', true)}
        />}
      />
      <Forms.FormDivider />
      <Forms.FormRow
        label={i18n.Messages.ENMITY_ASSET_BROWSER}
        leading={<Forms.FormRow.Icon source={Icons.Debug} />}
        trailing={Forms.FormRow.Arrow}
        onPress={() => navigation.push(Screens.Custom, {
          title: i18n.Messages.ENMITY_ASSET_BROWSER,
          render: AssetBrowser
        })}
      />
      <Forms.FormDivider />
      <Forms.FormRow
        label={i18n.Messages.ENMITY_DEBUG_LOGS}
        leading={<Forms.FormRow.Icon source={Icons.Debug} />}
        trailing={Forms.FormRow.Arrow}
        onPress={() => navigation.push(Screens.Custom, {
          title: i18n.Messages.ENMITY_DEBUG_LOGS,
          render: Logs
        })}
      />
    </Forms.FormSection>
  </>;
}