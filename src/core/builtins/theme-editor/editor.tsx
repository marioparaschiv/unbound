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
import { Dispatcher, ReactNative as RN, Reanimated, Theme } from '@metro/common';
import useStyles from './styles';
import { Redesign } from '@metro/components';
import { getIDByName } from '@api/assets';
import { EditorStates, type EditorProps } from './common';
import { Themes } from '@managers';
import { ColorBlock } from './color';

export default function({ left, setEditorVisibility, settings }: EditorProps) {
  const themes = Themes.useEntities();
  const styles = useStyles();
  const themeId = settings.get('selected', null);
  const theme = themes.find(theme => theme.id == themeId);

  if (!settings.get('enabled', false)) return null;

  return <RN.SafeAreaView style={[
    styles.editor,
    { position: 'absolute', left, bottom: 0 }
  ]}>
    <RN.Text style={styles.title}>Editing {theme.data.name}</RN.Text>
    <RN.ScrollView style={{ paddingHorizontal: 20 }}>
      <Redesign.TableRowGroup title='Semantic Colors'>
        {Object.keys(Theme.colors).map(key => {
          return <Redesign.TableRow
            key={key}
            label={key}
            trailing={<ColorBlock
              color={Theme.internal.resolveSemanticColor(theme.id, Theme.colors[key])}
            />}
            arrow
          />;
        })}
      </Redesign.TableRowGroup>
      <Redesign.TableRowGroup title='Raw Colors'>
        {Object.keys(Theme.unsafe_rawColors).map(key => {
          return <Redesign.TableRow
            key={key}
            label={key}
            trailing={<ColorBlock color={Theme.unsafe_rawColors[key]} />}
            arrow
          />;
        })}
      </Redesign.TableRowGroup>
    </RN.ScrollView>
    <RN.View style={{ position: 'absolute', bottom: 100, left: 0, width: '100%' }}>
      <RN.View style={{ marginHorizontal: 40, gap: 10 }}>
        <Redesign.Button
          onPress={() => setEditorVisibility(EditorStates.HIDDEN)}
          icon={getIDByName('close')}
          variant={'primary'}
          size={'md'}
          text={'Close Theme Editor'}
        />
        <Redesign.Button
          onPress={() => {
            setEditorVisibility(EditorStates.HIDDEN);
            settings.set('enabled', false);
            settings.set('current', null);

            Dispatcher.dispatch({ type: 'DISABLE_THEME_EDITOR' })
          }}
          icon={getIDByName('close')}
          variant={'primary'}
          size={'md'}
          text={'Exit Theme Editor'}
        />
      </RN.View>
    </RN.View>
  </RN.SafeAreaView>;
}
