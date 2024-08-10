import { StyleSheet, Theme } from '@metro/common';

export default StyleSheet.createStyles({
  editor: {
    width: '100%',
    height: '100%',
    backgroundColor: Theme.colors.BG_BASE_PRIMARY
  },

  title: {
    fontSize: 20,
    textAlign: 'center',
    color: Theme.colors.HEADER_PRIMARY
  },
});
