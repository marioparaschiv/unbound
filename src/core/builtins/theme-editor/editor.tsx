// This page should allow you to edit your theme.
// Every time a property on the screen changes,
// the theme updates and this means discord
// updates to reflect these changes

// This means
// -- save the theme
// -- update the json containing the theme on the runtime
// -- reapply the theme
//
// This may cause performance issues so this should be disable-able.
// If disabled, add an easy-to-access save button
import { ReactNative as RN, Reanimated } from '@metro/common';
import useStyles from './styles';
import { Redesign } from '@metro/components';
import { getIDByName } from '@api/assets';
import type { DimensionValue } from 'react-native';
import { EditorStates, type EditorProps } from './common';

export default function({ left, setEditorVisibility }: EditorProps) {
  const styles = useStyles();

  return <RN.SafeAreaView style={[
    styles.editor,
    { position: 'absolute', left, bottom: 0 }
  ]}>
    <RN.Text style={styles.title}>Editing meow</RN.Text>
    <RN.View style={{ position: 'absolute', bottom: 100, left: 0, width: '100%' }}>
      <RN.View style={{ marginHorizontal: 40 }}>
        <Redesign.Button
          onPress={() => setEditorVisibility(EditorStates.HIDDEN)}
          icon={getIDByName('close')}
          variant={'primary'}
          size={'md'}
          text={'Close Theme Editor'}
        />
      </RN.View>
    </RN.View>
  </RN.SafeAreaView>;
}
