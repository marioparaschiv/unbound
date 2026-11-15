import { useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import { useState } from 'react';

/**
 * @description Measures the view holding Discord's `SegmentedControlPages`, as Discord's own tabbed screens do, so pages
 * fit their container rather than the window; on iPad, settings is a sheet narrower than the screen. Uses the window's
 * width until the first layout, as Android's pager keeps the width its first render saw.
 * @returns The width to pass as `pageWidth`, and the `onLayout` to put on the pages' container.
 */
function usePageWidth() {
	const window = useWindowDimensions();
	const [width, setWidth] = useState(0);

	return {
		width: width || window.width,
		onLayout: (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width),
	};
}

export default usePageWidth;
