import type { useSettingsStore } from '@api/storage';
import type { DimensionValue } from 'react-native';

export type EditorProps = {
  left: DimensionValue;
  setEditorVisibility: (value: EditorState) => void;
  settings: ReturnType<typeof useSettingsStore>
};

export const EditorStates = {
  VISIBLE: 0,
  HIDDEN: '-100%'
} as const;

export type EditorState = typeof EditorStates[keyof typeof EditorStates];
