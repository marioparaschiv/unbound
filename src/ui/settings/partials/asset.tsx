import { Constants, React, ReactNative as RN, StyleSheet } from '@metro/common';
import { Asset } from '@typings/api/assets';
import { Forms, Media } from '@metro/components';

const styles = StyleSheet.createThemedStyleSheet({
  label: {
    fontFamily: Constants.Fonts.DISPLAY_SEMIBOLD,
    color: Constants.ThemeColorMap.TEXT_NORMAL,
    fontSize: 16
  },
  image: {
    width: 24,
    height: 24
  }
});

export default class extends React.PureComponent<{ item: Asset; }> {
  render() {
    const { item } = this.props;

    return <Forms.FormRow
      label={() => <RN.Text style={styles.label}>
        {item.name}
      </RN.Text>}
      leading={() => <RN.Image style={styles.image} source={item.id} />}
      subLabel={item.type.toUpperCase()}
      onPress={this.open.bind(this)}
    />;
  }

  open() {
    Media.openMediaModal;
  }
}