import { i18n, React, ReactNative as RN, StyleSheet, Theme } from '@metro/common';
import { Navigation } from '@metro/components';
import Addons from '../components/addons';

import Plugins from '@managers/plugins';
import assets from '@api/assets';
import { Dialog } from '@metro/ui';

const styles = StyleSheet.createThemedStyleSheet({
  input: {
    height: 40,
    margin: 12,
    borderBottomWidth: 1,
    borderBottomColor: Theme.colors.INTERACTIVE_NORMAL,
    padding: 10,
  }
});

export default () => {
  const navigation = Navigation.useNavigation();

  React.useEffect(() => {
    navigation.setOptions({ headerRight: () => <Add /> });
  }, []);

  return <RN.View style={{ flex: 1 }}>
    <Addons
      type='plugins'
      addons={Plugins.addons}
    />
  </RN.View>;
};

function Add() {
  return <RN.TouchableOpacity style={{ marginRight: 20 }} onPress={() => {
    Dialog.confirm({
      title: i18n.Messages.ENMITY_INSTALL_TITLE.format({ type: 'plugin' }),
      body: <InstallModal key='install-input' />,
      confirmText: i18n.Messages.ENMITY_INSTALL,
      onConfirm: () => alert('hi')
    });
  }}>
    <RN.Image source={assets.getIDByName('ic_add_circle')} />
  </RN.TouchableOpacity>;
}

class InstallModal extends React.PureComponent {
  state = { url: '' };

  render() {
    return <RN.View>
      <RN.TextInput
        onChangeText={url => this.setState({ url })}
        value={this.state.url}
        style={styles.input}
        placeholder='https://example.com'
      />
    </RN.View>;
  }
}