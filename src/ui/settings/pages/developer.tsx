import { ReactNative as RN, React, i18n } from '@metro/common';
import { Forms, Navigation } from '@metro/components';
import Assets from '@api/assets';
import Logs from './logger';

export default function () {
  const navigation = Navigation.useNavigation();

  const Icons = {
    Debug: Assets.getIDByName('debug')
  };

  return <>
    <Forms.FormSection title={i18n.Messages.ENMITY_DEBUG_BRIDGE}>
      <Forms.FormRow
        label={i18n.Messages.ENMITY_DEBUG_BRIDGE_CONNECT}
        trailing={<Forms.FormSwitch
          value={true}
          onValueChange={() => {
            // settings.toggle('autoConnectWS', false);

            // try {
            //   if (settings.get('autoConnectWS', false)) {
            //     connectWebsocket();
            //   } else {
            //     socket.close();
            //   }
            // } catch {
            //   // Ignore if anything throws, the socket is most likely not present.
            // }
          }}
        />}
      />

      <Forms.FormDivider />
      <Forms.FormInput
        value='192.168.0.35:9090'
        // value={settings.get('debugWSAddress', '192.168.0.1:9090')}
        // onChange={v => settings.set('debugWSAddress', v)}
        title={i18n.Messages.ENMITY_DEBUG_BRIDGE_IP}
      />
    </Forms.FormSection>
    <Forms.FormSection>
      <Forms.FormRow
        label={i18n.Messages.ENMITY_ASSET_BROWSER}
        leading={<Forms.FormRow.Icon source={Icons.Debug} />}
        trailing={Forms.FormRow.Arrow}
        onPress={() => navigation.push('Custom', {
          title: i18n.Messages.ENMITY_DEBUG_LOGS,
          render: Logs
        })}
      />
      <Forms.FormRow
        label={i18n.Messages.ENMITY_DEBUG_LOGS}
        leading={<Forms.FormRow.Icon source={Icons.Debug} />}
        trailing={Forms.FormRow.Arrow}
        onPress={() => navigation.push('Custom', {
          title: i18n.Messages.ENMITY_DEBUG_LOGS,
          render: Logs
        })}
      />
    </Forms.FormSection>
  </>;
}