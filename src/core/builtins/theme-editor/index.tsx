// This page should handle only the opening and closing of the theme editor
// Aka the floating button
//
// This button should only appear when the theme editor is enabled
// ie a theme has been selected by the user to be edited.
//
// NOTE: Use reanimated for fading the editor into view
import { Dispatcher, React, ReactNative as RN } from '@metro/common';
import { createPatcher } from '@patcher';
import { findByName } from '@metro';
import { Redesign } from '@metro/components';
import Editor from './editor';
import { getIDByName } from '@api/assets';
import { callbackWithAnimation } from '@utilities';
import type { DimensionValue } from 'react-native';
import { EditorStates, type EditorState } from './common';
import { Draggable } from '@ui/components/internal';
import { useSettingsStore } from '@api/storage';

const Patcher = createPatcher('onboarding');

export const data = {
  id: 'modules.editor',
  default: true
};

export function initialize() {
  const LaunchPadContainer = findByName('LaunchPadContainer', { interop: false });

  Patcher.after(LaunchPadContainer, 'default', (_, __, res) => {
    const [left, setLeft] = React.useState<EditorState>(EditorStates.HIDDEN);
    const settings = useSettingsStore('theme-editor');
    const setEditorVisibility = callbackWithAnimation(setLeft);

    React.useEffect(() => {
      Dispatcher.subscribe('ENABLE_THEME_EDITOR', () => {
        setEditorVisibility(EditorStates.VISIBLE);
      });
    }, [])

    return <>
      {res}
      {settings.get('enabled', false) && <Draggable layout={{ width: 48, height: 48 }}>
        <Redesign.IconButton
          onPress={() => setEditorVisibility(EditorStates.VISIBLE)}
          icon={getIDByName('ic_paint_brush')}
          variant={'primary'}
          size={'lg'}
        />
      </Draggable>}
      <Editor
        left={left}
        setEditorVisibility={setEditorVisibility}
        settings={settings}
      />
    </>;
  });
}

export function shutdown() {
  Patcher.unpatchAll();
}
