import { Theme, i18n, React, ReactNative as RN, StyleSheet } from '@metro/common';
import { Forms, Navigation } from '@metro/components';
import { Invite, Links, Screens } from '@constants';
import { Invites } from '@metro/actions';
import * as Icon from '@ui/icons';
import Assets from '@api/assets';

import Plugins from '@managers/plugins';
import Themes from '@managers/themes';

import Developer from './developer';
import Toasts from './toasts';

const { colors } = Theme;

const styles = StyleSheet.createThemedStyleSheet({
  trailingText: {
    color: colors.TEXT_MUTED
  },
  container: {
    marginBottom: 50
  }
});

function General() {
  const navigation = Navigation.useNavigation();

  const Icons = {
    Twitter: Assets.getIDByName('img_account_sync_twitter_white'),
    GitHub: Assets.getIDByName('img_account_sync_github_white'),
    Development: Assets.getIDByName('ic_progress_wrench_24px'),
    Toasts: Assets.getIDByName('ic_notification_settings'),
    Discord: Assets.getIDByName('Discord'),
  };

  return <RN.ScrollView>
    <RN.KeyboardAvoidingView
      enabled={true}
      behavior='position'
      style={styles.container}
      keyboardVerticalOffset={100}
      contentContainerStyle={{ backfaceVisibility: 'hidden' }}
    >
      <Forms.FormSection>
        <Forms.FormRow
          label={i18n.Messages.ENMITY_TOAST_SETTINGS}
          leading={<Forms.FormRow.Icon source={Icons.Toasts} />}
          trailing={Forms.FormRow.Arrow}
          onPress={() => navigation.push(Screens.Custom, {
            title: i18n.Messages.ENMITY_TOAST_SETTINGS,
            render: Toasts
          })}
        />
        <Forms.FormDivider />
        <Forms.FormRow
          label={i18n.Messages.ENMITY_DEVELOPMENT_SETTINGS}
          leading={<Forms.FormRow.Icon source={Icons.Development} />}
          trailing={Forms.FormRow.Arrow}
          onPress={() => navigation.push(Screens.Custom, {
            title: i18n.Messages.ENMITY_DEVELOPMENT_SETTINGS,
            render: Developer
          })}
        />
      </Forms.FormSection>
      <Forms.FormSection title='Stats'>
        <Forms.FormRow
          label='Installed Plugins'
          leading={<Icon.Puzzle width={24} height={24} />}
          trailing={() => <RN.Text style={styles.trailingText}>
            {Plugins.addons.length}
          </RN.Text>}
        />
        <Forms.FormDivider />
        <Forms.FormRow
          label='Installed Themes'
          leading={<Icon.Palette width={24} height={24} />}
          trailing={() => <RN.Text style={styles.trailingText}>
            {Themes.addons.length}
          </RN.Text>}
        />
      </Forms.FormSection>
      <Forms.FormSection title='Links'>
        <Forms.FormRow
          label='Discord Server'
          leading={<Forms.FormRow.Icon source={Icons.Discord} />}
          trailing={Forms.FormRow.Arrow}
          onPress={() => Invites.acceptInviteAndTransitionToInviteChannel({ inviteKey: Invite })}
        />
        <Forms.FormDivider />
        <Forms.FormRow
          label='GitHub'
          leading={<Forms.FormRow.Icon source={Icons.GitHub} />}
          trailing={Forms.FormRow.Arrow}
          onPress={() => RN.Linking.openURL(Links.GitHub)}
        />
        <Forms.FormDivider />
        <Forms.FormRow
          label='Twitter'
          leading={<Forms.FormRow.Icon source={Icons.Twitter} />}
          trailing={Forms.FormRow.Arrow}
          onPress={() => RN.Linking.openURL(Links.Twitter)}
        />
      </Forms.FormSection>
    </RN.KeyboardAvoidingView>
  </RN.ScrollView>;
}

export default General;