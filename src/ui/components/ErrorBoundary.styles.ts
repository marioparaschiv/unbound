import { Constants, StyleSheet, Theme } from '@metro/common';

export default StyleSheet.createThemedStyleSheet({
    container: {
        backgroundColor: Theme.colors.BACKGROUND_TERTIARY,
  
        width: '100%',
        height: '100%',
  
        flex: 1
    },

    card: {
        backgroundColor: Theme.colors.BACKGROUND_PRIMARY,

        marginHorizontal: 20,
        marginBottom: 20,
        borderRadius: 20,

        ...Theme.shadows.SHADOW_LOW
    },

    headerChainIcon: {
        width: undefined,
        height: '40%',
        aspectRatio: 1,

        right: 30,
        top: '30%',

        borderRadius: 1000,
        position: 'absolute',
    },

    headerTitle: {
        color: Theme.colors.HEADER_PRIMARY,
        width: '60%',

        fontSize: 22,
        fontFamily: Constants.Fonts.PRIMARY_BOLD,
        letterSpacing: -0.5,

        marginTop: 20,
        marginBottom: 10,
        marginLeft: 20,
    },

    headerBody: {
        color: Theme.colors.TEXT_NORMAL,
        width: '50%',

        fontSize: 18,
        fontFamily: Constants.Fonts.PRIMARY_NORMAL,

        marginBottom: 20,
        marginLeft: 20,
    },

    outlineTitle: {
        color: Theme.colors.TEXT_NORMAL,
        width: '100%',
        textAlign: 'center',

        fontSize: 18,
        fontFamily: Constants.Fonts.PRIMARY_SEMIBOLD,
        letterSpacing: -0.5,

        marginVertical: 10
    },

    outlineCodeblock: {
        marginHorizontal: 10,
        marginBottom: 10,

        borderRadius: 16,
        flexGrow: 1,

        ...Theme.shadows.SHADOW_LOW
    }
})