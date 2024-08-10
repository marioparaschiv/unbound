import type { DimensionValue } from 'react-native';

export type EditorProps = {
  left: DimensionValue;
  setEditorVisibility: (value: EditorState) => void;
};

export const EditorStates = {
  VISIBLE: 0,
  HIDDEN: '-100%'
} as const;

export type EditorState = typeof EditorStates[keyof typeof EditorStates];
