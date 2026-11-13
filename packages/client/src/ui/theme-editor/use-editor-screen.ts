import type { NativeScrollEvent, NativeSyntheticEvent, ScrollView } from 'react-native';
import { useEffect, useRef } from 'react';

import ThemeEditorStore, { type ThemeEditorRoute } from '~/themes/editor-state';
import { Discord } from '~/metro/components';

type ScrollEvent = NativeSyntheticEvent<NativeScrollEvent>;

/**
 * @description Marks the calling screen as an open theme editor screen: it hides the floating button while mounted, becomes
 * the screen the button returns to when focused, and keeps its scroll offset across visits.
 * @param route The screen and its params.
 * @returns The props for the screen's `Page`.
 */
function useEditorScreen(route: ThemeEditorRoute) {
	const navigation = Discord.useNavigation();
	const ref = useRef<ScrollView>(null);
	const restored = useRef(false);
	const key = route.params?.group ?? route.screen;

	useEffect(() => {
		const store = ThemeEditorStore.getState();

		store.mount();
		store.visit(route);

		const offFocus = navigation.addListener('focus', () =>
			ThemeEditorStore.getState().visit(route),
		);

		return () => {
			offFocus();
			ThemeEditorStore.getState().unmount();
		};
	}, []);

	function record(event: ScrollEvent) {
		ThemeEditorStore.getState().setOffset(key, event.nativeEvent.contentOffset.y);
	}

	// Android ignores `contentOffset`, so the offset is restored once the content is tall enough to hold it.
	function restore(_width: number, height: number) {
		const offset = ThemeEditorStore.getState().offsets[key] ?? 0;

		if (restored.current || height < offset) return;

		restored.current = true;
		ref.current?.scrollTo({ y: offset, animated: false });
	}

	return {
		ref,
		onScrollEndDrag: record,
		onMomentumScrollEnd: record,
		onContentSizeChange: restore,
	};
}

export default useEditorScreen;
