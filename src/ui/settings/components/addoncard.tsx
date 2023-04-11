import { Constants, Theme, React, ReactNative as RN, StyleSheet, i18n } from '@metro/common';
import { Addon } from '@typings/managers';
import { AsyncUsers } from '@metro/api';
import { Users } from '@metro/stores';
import { Profiles } from '@metro/ui';

interface AddonCardProps {
  addon: Addon;
}

const { Fonts } = Constants;
const { colors } = Theme;

export default class extends React.Component<AddonCardProps> {
  render() {
    return <RN.View style={this.styles.card}>
      <RN.View style={this.styles.header}>
        {this.renderMetadata()}
        {this.renderAuthors()}
        <RN.Switch />
      </RN.View>
      <RN.View style={this.styles.info}>
        {this.renderBody()}
      </RN.View>
    </RN.View>;
  }

  renderMetadata() {
    const { addon } = this.props;

    return <>
      <RN.Text style={this.styles.name}>
        {addon.data.name}
      </RN.Text>
      <RN.Text style={this.styles.version}>
        {addon.data.version ?? '?.?.?'}
      </RN.Text>
    </>;
  }

  renderAuthors() {
    const { addon } = this.props;

    return <>
      <RN.Text style={this.styles.by}>by</RN.Text>
      <RN.FlatList
        data={addon.data.authors ?? [{ name: '???' }]}
        horizontal
        style={{ flex: 1 }}
        keyExtractor={(_, idx) => String(idx)}
        renderItem={({ item, index }) => {
          const isLast = index === (addon.data.authors ?? [{ name: '???' }]).length - 1;

          const divider = !isLast && <RN.Text style={this.styles.authors}>
            {', '}
          </RN.Text>;

          if (item.name && item.id) {
            return <RN.TouchableOpacity style={this.styles.authorContainer} onPress={this.onTapAuthor.bind(this, item)}>
              <RN.Text style={{ ...this.styles.authors, ...this.styles.touchable }}>
                {item.name}
              </RN.Text>
              {divider}
            </RN.TouchableOpacity>;
          } else {
            return <RN.View style={this.styles.authorContainer}>
              <RN.Text style={this.styles.authors}>
                {(item.name ?? item) as String}
              </RN.Text>
              {divider}
            </RN.View>;
          }
        }}
      />
    </>;
  }

  renderBody() {
    const { addon } = this.props;

    return <RN.Text style={this.styles.description}>
      {addon.data.description ?? i18n.Messages.ENMITY_ADDON_NO_DESCRIPTION}
    </RN.Text>;
  }

  async onTapAuthor(item) {
    if (!Users.getUser(item.id)) {
      await AsyncUsers.fetchProfile(item.id);
    }

    Profiles.showUserProfile({ userId: item.id });
  }

  styles = StyleSheet.createThemedStyleSheet({
    card: {
      backgroundColor: colors.BACKGROUND_SECONDARY,
      marginHorizontal: 10,
      borderRadius: 5,
      marginTop: 10
    },
    header: {
      backgroundColor: colors.BACKGROUND_TERTIARY,
      borderTopRightRadius: 5,
      borderTopLeftRadius: 5,
      paddingHorizontal: 15,
      flexDirection: 'row',
      alignItems: 'center',
      padding: 10,
      flex: 1
    },
    name: {
      color: colors.TEXT_NORMAL,
      fontFamily: Fonts.PRIMARY_BOLD,
      marginRight: 2.5,
      fontSize: 16,
    },
    version: {
      fontFamily: Fonts.PRIMARY_SEMIBOLD,
      color: colors.TEXT_MUTED,
      marginRight: 2.5,
      fontSize: 14
    },
    by: {
      fontFamily: Fonts.PRIMARY_NORMAL,
      color: colors.TEXT_MUTED,
      marginRight: 2.5,
      fontSize: 14
    },
    authors: {
      fontFamily: Fonts.PRIMARY_SEMIBOLD,
      color: colors.TEXT_MUTED,
      fontSize: 14,
      flex: 1
    },
    authorContainer: {
      flexDirection: 'row'
    },
    touchable: {
      color: colors.TEXT_NORMAL
    },
    info: {
      padding: 15,
    },
    description: {
      fontFamily: Fonts.PRIMARY_SEMIBOLD,
      color: colors.TEXT_NORMAL,
      fontSize: 14,
    }
  });
}