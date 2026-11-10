import type { View } from 'react-native';
import { createContext } from 'react';

/** A view's frame on the screen, where Discord's media viewer lays out. */
export type ScreenRect = { x: number; y: number; width: number; height: number };

/** Measures a view's frame on the screen, then calls `done`; `undefined` when the view is gone. */
export type MeasureOnScreen = (
	view: View | null,
	done: (rect: ScreenRect | undefined) => void,
) => void;

function measureInWindow(view: View | null, done: (rect: ScreenRect | undefined) => void) {
	if (!view) {
		done(undefined);

		return;
	}

	view.measureInWindow((x, y, width, height) => done({ x, y, width, height }));
}

/**
 * The store page's measure, which corrects for the settings sheet it sits in; outside one a view's
 * window frame is already its screen frame.
 */
const ScreenRectContext = createContext<MeasureOnScreen>(measureInWindow);

export default ScreenRectContext;
