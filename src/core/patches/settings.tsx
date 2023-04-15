import { findInReactTree } from '@utilities';
import { React, i18n } from '@metro/common';
import { createPatcher } from '@patcher';
import { Screens } from '@constants';
import { findByName } from '@metro';
import { Icons } from '@api/assets';
import * as Icon from '@ui/icons';

import { Forms, Navigation } from '@metro/components';
import General from '@ui/settings/pages/general';
import Plugins from '@ui/settings/pages/plugins';
import Themes from '@ui/settings/pages/themes';

const Patcher = createPatcher('settings');

export function apply() {
  const [
    Settings,
    Scenes
  ] = findByName(
    { params: ['UserSettingsOverviewWrapper'], interop: false },
    { params: ['getScreens'], interop: false },
    { bulk: true }
  );

  const unpatch = Patcher.after(Settings, 'default', (_, __, wrapper) => {
    const instance = findInReactTree(wrapper, m => m.type?.name === 'UserSettingsOverview');
    if (!instance) return wrapper;

    patchSettings(instance);
    unpatch();
  });

  Patcher.after(Scenes, 'default', (_, __, res) => {
    return {
      ...res,
      [Screens.General]: {
        key: Screens.General,
        render: General,
        get title() {
          return i18n.Messages.SETTINGS;
        },
      },
      [Screens.Plugins]: {
        key: Screens.Plugins,
        render: Plugins,
        get title() {
          return i18n.Messages.ENMITY_PLUGINS;
        },
      },
      [Screens.Themes]: {
        key: Screens.Themes,
        render: Themes,
        get title() {
          return i18n.Messages.ENMITY_THEMES;
        }
      },
      [Screens.Updater]: {
        key: Screens.Updater,
        render: () => null,
        get title() {
          return i18n.Messages.ENMITY_UPDATER;
        }
      },
      [Screens.Custom]: {
        key: Screens.Custom,
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

    const index = children.findIndex(c => c?.props?.title === i18n.Messages.PREMIUM_SETTINGS_GENERIC);

    children.splice(index, 0, <>
      <Forms.FormSection key='Enmity' title='Enmity'>
        <Forms.FormRow
          label={i18n.Messages.SETTINGS}
          leading={<Forms.FormRow.Icon source={Icons['settings']} />}
          trailing={<Forms.FormArrow />}
          onPress={() => navigation.push(Screens.General, { ...self.props, ...res.props })}
        />
        <Forms.FormDivider />
        <Forms.FormRow
          label={i18n.Messages.ENMITY_PLUGINS}
          leading={<Icon.Puzzle height={24} width={24} />}
          trailing={<Forms.FormArrow />}
          onPress={() => navigation.push(Screens.Plugins, { ...self.props, ...res.props })}
        />
        <Forms.FormDivider />
        <Forms.FormRow
          label={i18n.Messages.ENMITY_THEMES}
          leading={<Icon.Palette height={24} width={24} />}
          trailing={<Forms.FormArrow />}
          onPress={() => navigation.push(Screens.Themes, { ...self.props, ...res.props })}
        />
        <Forms.FormDivider />
        <Forms.FormRow
          label={i18n.Messages.ENMITY_UPDATER}
          leading={<Forms.FormRow.Icon source={Icons['ic_download_24px']} />}
          trailing={<Forms.FormArrow />}
          onPress={() => navigation.push(Screens.Updater, { ...self.props, ...res.props })}
        />
      </Forms.FormSection>
    </>);

    // Remove "Upload Debug Logs" button
    const support = children.find(c => c?.props.title === i18n.Messages.SUPPORT);
    const entries = support?.props.children;

    if (entries) {
      support.props.children = entries.filter(e => e?.type?.name !== 'UploadLogsButton');
    }
  });
}

export function remove() {
  Patcher.unpatchAll();
}