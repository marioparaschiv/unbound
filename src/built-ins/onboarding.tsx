import { Icons } from '@api/assets';
import { Strings } from '@api/i18n';
import { findByProps } from '@api/metro';
import { Constants, Navigation, Theme } from '@api/metro/common';
import { Discord, Forms } from '@api/metro/components';
import { ManagerIcons, ManagerKind } from '@constants';
import type { BuiltInData } from '@typings/built-ins';
import { Section } from '@ui/misc/forms';
import { noop } from '@utilities';
import { Image, ScrollView, Text, TouchableOpacity, View } from 'react-native';

export const data: BuiltInData = {
	name: 'Onboarding'
};

const useStyles = Discord.createStyles({
  title: {
    fontSize: 32,
    color: Theme.colors.HEADER_PRIMARY,
    marginBottom: 12,
    fontFamily: Constants.Fonts.PRIMARY_BOLD
  },

  subtitle: {
    fontSize: 14,
    color: Theme.colors.HEADER_SECONDARY,
    marginHorizontal: 48,
    marginBottom: 16,
    fontFamily: Constants.Fonts.DISPLAY_NORMAL,
    textAlign: 'center'
  }
})

export function start() {
  window.openOnboardingModal = () => Navigation.push(({ onClose }) => (
    <Discord.StepModal
      initialRouteName='welcome'
      screens={{
        welcome: {
          headerLeft() {
            return React.createElement(Discord.getHeaderCloseButton(onClose));
          },
          render(_, navigation) {
            const styles = useStyles();

            return <Discord.ModalScreen>
              <ScrollView style={{ flex: 1 }}>
                <View style={{ alignItems: 'center' }}>
                  <Image
                    source={{ uri: 'https://raw.githubusercontent.com/unbound-mod/assets/main/logo/logo.png' }}
                    style={{ width: 100, aspectRatio: 1, borderRadius: 9999, marginTop: 40, marginBottom: 24 }}
                  />
                  <Text style={styles.title}>
                    {Strings['UNBOUND_WELCOME_TITLE']}
                  </Text>
                  <Text style={styles.subtitle}>
                    {Strings['UNBOUND_WELCOME_SUBTITLE']}
                  </Text>
                </View>
                <Section style={{ paddingHorizontal: 12 }}>
                  <Discord.TableRow
                    icon={<Discord.TableRowIcon
                      source={Icons[ManagerIcons[ManagerKind.PLUGINS]]}
                      variant={'blurple'}
                    />}
                    label={Strings.UNBOUND_PLUGINS}
                    subLabel={Strings.UNBOUND_SHORT_DESC_PLUGINS}
                    onPress={noop}
                  />
                  <Discord.TableRow
                    icon={<Discord.TableRowIcon
                      source={Icons[ManagerIcons[ManagerKind.THEMES]]}
                      variant={'blurple'}
                    />}
                    label={Strings.UNBOUND_THEMES}
                    subLabel={Strings.UNBOUND_SHORT_DESC_THEMES}
                    onPress={noop}
                  />
                  <Discord.TableRow
                    icon={<Discord.TableRowIcon
                      source={Icons[ManagerIcons[ManagerKind.ICONS]]}
                      variant={'blurple'}
                    />}
                    label={Strings.UNBOUND_ICONS}
                    subLabel={Strings.UNBOUND_SHORT_DESC_ICONS}
                    onPress={noop}
                  />
                  <Discord.TableRow
                    icon={<Discord.TableRowIcon
                      source={Icons[ManagerIcons[ManagerKind.FONTS]]}
                      variant={'blurple'}
                    />}
                    label={Strings.UNBOUND_FONTS}
                    subLabel={Strings.UNBOUND_SHORT_DESC_FONTS}
                    onPress={noop}
                  />
                  <Discord.TableRow
                    icon={<Discord.TableRowIcon
                      source={Icons[ManagerIcons[ManagerKind.SOURCES]]}
                      variant={'blurple'}
                    />}
                    label={Strings.UNBOUND_SOURCES}
                    subLabel={Strings.UNBOUND_SHORT_DESC_SOURCES}
                    onPress={noop}
                  />
                </Section>
              </ScrollView>
              <Discord.ModalFooter>
                <Discord.ModalDisclaimer>
                  {Strings.UNBOUND_CONTINUE_DISCOVER}
                </Discord.ModalDisclaimer>
                <Discord.ModalActionButton
                  text={'Continue'}
                  variant={'primary'}
                  onPress={() => navigation.push('test')}
                />
              </Discord.ModalFooter>
            </Discord.ModalScreen>
          }
        },
        test: {
          headerLeft() {
            return React.createElement(Discord.getHeaderCloseButton(onClose));
          },
          render(_, navigation) {
            return <Discord.ModalScreen>
              <ScrollView style={{ flex: 1 }} />
              <Discord.ModalFooter>
                <Discord.ModalActionButton
                  text={'Go back'}
                  variant={'primary'}
                  onPress={navigation.goBack}
                />
                <Discord.ModalActionButton
                  text={'Close'}
                  variant={'secondary'}
                  onPress={Navigation.pop}
                />
              </Discord.ModalFooter>
            </Discord.ModalScreen>
          }
        }
      }}
      steps={['welcome', 'test']}
    />
  ));

  setTimeout(() => window.openOnboardingModal(), 1000);
}

export function stop() {

}
