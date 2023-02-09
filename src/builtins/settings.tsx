import { Forms, Navigation } from '@metro/components';
import { findInReactTree } from '@utilities';
import { React, i18n } from '@metro/common';
import { createPatcher } from '@patcher';
import { findByName } from '@metro';
import { Icons } from 'api/assets';
import * as Icon from '@ui/icons';

import General from '@ui/settings/pages/general';
import Plugins from '@ui/settings/pages/plugins';
import Themes from '@ui/settings/pages/themes';

const Patcher = createPatcher('Core - Settings');

const Settings = findByName('UserSettingsOverviewWrapper', { interop: false });
const Scenes = findByName('getScreens', { interop: false });

export function initialize() {
  const unpatch = Patcher.after(Settings, 'default', (_, __, wrapper) => {
    const instance = findInReactTree(wrapper, m => m.type?.name === 'UserSettingsOverview');
    if (!instance) return wrapper;

    patchSettings(instance);
    unpatch();
  });

  Patcher.after(Scenes, 'default', (_, args, res) => {
    return {
      ...res,
      Enmity: {
        key: 'Enmity',
        title: 'Enmity',
        render: General
      },
      EnmityPlugins: {
        key: 'EnmityPlugins',
        render: Plugins,
        get title() {
          return i18n.Messages.ENMITY_PLUGINS;
        },
      },
      EnmityThemes: {
        key: 'EnmityThemes',
        render: Themes,
        get title() {
          return i18n.Messages.ENMITY_THEMES;
        }
      },
      EnmityUpdater: {
        key: 'EnmityUpdater',
        render: () => null,
        get title() {
          return i18n.Messages.ENMITY_UPDATER;
        }
      },
      Custom: {
        key: 'Custom',
        title: 'Page',
        render: ({ title, render: Component, ...props }: { title: string; render: React.ComponentType; }) => {
          const navigation = Navigation.useNavigation();

          React.useEffect(() => {
            if (title) {
              navigation.setOptions({ title });
            }
          }, []);

          return <Component {...props} />;
        }
      }
    };
  });
}

function patchSettings(instance) {
  Patcher.after(instance.type.prototype, 'render', (self, __, res) => {
    const { navigation } = self.props;
    const { children } = res.props;

    const searchable = [i18n.Messages.BILLING_SETTINGS, i18n.Messages.PREMIUM_SETTINGS];
    const index = children.findIndex(c => ~searchable.indexOf(c.props.title));

    children.splice(index === -1 ? 4 : index, 0, <>
      <Forms.FormSection key='Enmity' title='Enmity'>
        <Forms.FormRow
          label={i18n.Messages.ENMITY_GENERAL}
          leading={<Forms.FormRow.Icon source={{ uri: 'https://files.enmity.app/icon-64.png' }} />}
          trailing={<Forms.FormArrow />}
          onPress={() => navigation.push('Enmity', { ...self.props, ...res.props })}
        />
        <Forms.FormDivider />
        <Forms.FormRow
          label={i18n.Messages.ENMITY_PLUGINS}
          leading={<Icon.Puzzle height={24} width={24} />}
          trailing={<Forms.FormArrow />}
          onPress={() => navigation.push('EnmityPlugins', { ...self.props, ...res.props })}
        />
        <Forms.FormDivider />
        <Forms.FormRow
          label={i18n.Messages.ENMITY_THEMES}
          leading={<Icon.Palette height={24} width={24} />}
          trailing={<Forms.FormArrow />}
          onPress={() => navigation.push('EnmityThemes', { ...self.props, ...res.props })}
        />
        <Forms.FormDivider />
        <Forms.FormRow
          label={i18n.Messages.ENMITY_UPDATER}
          leading={<Forms.FormRow.Icon source={Icons['ic_download_24px']} />}
          trailing={<Forms.FormArrow />}
          onPress={() => navigation.push('EnmityUpdater', { ...self.props, ...res.props })}
        />
      </Forms.FormSection>
    </>);

    // Remove "Upload Debug Logs" button
    const supporter = children.find(c => c.props.title === i18n.Messages.SUPPORT);
    const entries = supporter?.props.children;

    if (entries) {
      supporter.props.children = entries.filter(e => e?.type?.name !== 'UploadLogsButton');
    }
  });

  Patcher.after(instance.type.prototype, 'renderChangeLog', (self, args, res) => {
    if (!Array.isArray(res.props.children)) {
      res.props.children = [res.props.children];
    }

    const [discord] = res.props.children;
    const { navigation } = self.props;

    discord.props.label += ' - Discord';

    res.props.children.push(<Forms.FormRow
      leading={<Forms.FormRow.Icon source={Icons['ic_info_24px']} />}
      label={i18n.Messages.WHATS_NEW + ' - Enmity'}
      onPress={() => navigation.push('EnmityChangelog', { ...self.props, ...res.props })}
    />);
  });
}

export function shutdown() {
  Patcher.unpatchAll();
}

export default { initialize, shutdown };