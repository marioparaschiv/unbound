// This page should handle only the opening and closing of the theme editor
// Aka the floating button
//
// This button should only appear when the theme editor is enabled
// ie a theme has been selected by the user to be edited.
//
// NOTE: Use reanimated for fading the editor into view
import { React, ReactNative as RN } from '@metro/common';
import { createPatcher } from '@patcher';
import { findByName } from '@metro';
const Patcher = createPatcher('onboarding');

export const data = {
	id: 'modules.editor',
	default: true
};

export function initialize() {
	const LaunchPadContainer = findByName('LaunchPadContainer', { interop: false });

	Patcher.after(LaunchPadContainer, 'default', (_, __, res) => {
		return <>
			{res}
		</>;
	});
}

export function shutdown() {
	Patcher.unpatchAll();
}
