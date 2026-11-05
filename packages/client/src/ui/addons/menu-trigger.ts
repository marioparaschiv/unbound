import type { GestureResponderEvent, PressableProps, View } from 'react-native';
import type { Ref } from 'react';

/** What `Discord.ContextMenu` hands its trigger: press handlers, accessibility and the anchor ref. */
export type MenuTriggerProps = {
	onPress?: (event: GestureResponderEvent) => void;
	onLongPress?: (event: GestureResponderEvent) => void;
	accessibilityActions?: PressableProps['accessibilityActions'];
	onAccessibilityAction?: PressableProps['onAccessibilityAction'];
	ref?: Ref<View>;
};
