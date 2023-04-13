import { i18n, React, ReactNative as RN } from '@metro/common';
import { Navigation } from '@metro/components';
import Themes from '@managers/themes';
import { Icons } from '@api/assets';
import { Dialog } from '@metro/ui';

import InstallModal from '../components/installmodal';
import Addons from '../components/addons';
import ErrorBoundary from '@ui/components/ErrorBoundary';
import { Screens } from '@constants';

export default () => {
  const navigation = Navigation.useNavigation();
  const addons = Themes.useEntities();


  React.useEffect(() => {
    navigation.setOptions({ headerRight: () => <Add /> });
  }, []);

  return <ErrorBoundary>
    <RN.View style={{ flex: 1 }}>
      <Addons
        shouldRestart={true}
        type='themes'
        addons={addons}
      />
    </RN.View>
  </ErrorBoundary>;
};

function Add() {
  const navigation = Navigation.useNavigation();
  const ref = React.useRef();

  return <RN.TouchableOpacity style={{ marginRight: 20 }} onPress={() => {
    Dialog.confirm({
      title: i18n.Messages.ENMITY_INSTALL_TITLE.format({ type: 'theme' }),
      confirmText: i18n.Messages.ENMITY_THEME_GET_OPTION_CREATE,
      cancelText: i18n.Messages.ENMITY_THEME_GET_OPTION_IMPORT,

      body: i18n.Messages.ENMITY_THEME_GET_DESC,

      // On theme create
      onConfirm: () => {
        navigation.push(Screens.Custom, {
          title: i18n.Messages.ENMITY_THEME_EDITOR,
          render: () => <RN.Text>hi</RN.Text>
        });
      },

      // On theme import
      onCancel: () => {
        Dialog.confirm({
          title: i18n.Messages.ENMITY_INSTALL_TITLE.format({ type: 'plugin' }),
          children: <InstallModal manager={Themes} ref={ref} />,
          confirmText: i18n.Messages.ENMITY_INSTALL,
          onConfirm: () => {
            alert(ref?.current?.getInput());
            // Themes.install(ref?.current?.getInput())
          }
        });
      }
    });
  }}>
    <RN.Image source={Icons['ic_add_circle']} />
  </RN.TouchableOpacity>;
}