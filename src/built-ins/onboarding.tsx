import { getStore, useSettingsStore } from '@api/storage';
import type { BuiltInData } from '@typings/built-ins';
import { Onboarding, Content } from '@ui/onboarding';
import { Reanimated } from '@api/metro/common';
import { useEffect, useState } from 'react';
import { createPatcher } from '@patcher';
import { findByName } from '@api/metro';

const Patcher = createPatcher('unbound::onboarding');
const Settings = getStore('unbound');

const { useSharedValue, withTiming } = Reanimated;

export const data: BuiltInData = {
	name: 'Onboarding',
	shouldInitialize: () => !Settings.get('onboarding.completed', false)
};

export function start() {
	if (!Settings.get('onboarding.completed', false)) {
		Settings.set('onboarding.hidden', false);
		Settings.set('onboarding.install', false);
	}

	const LaunchPadContainer = findByName('LaunchPadContainer', { interop: false });

	Patcher.after(LaunchPadContainer, 'default', (_, __, res) => {
		const settings = useSettingsStore('unbound', ({ key }) => key.startsWith('onboarding'));
		const [content, setContent] = useState({ id: '', instance: null });
		const contentOpacity = useSharedValue(0);
		const onboardingOpacity = useSharedValue(0);

		useEffect(() => {
			setTimeout(() => {
				contentOpacity.value = withTiming(1, { duration: 500 });
				onboardingOpacity.value = withTiming(1, { duration: 500 });
			});
		}, []);

		function onComplete() {
			contentOpacity.value = withTiming(0, { duration: 500 });
			onboardingOpacity.value = withTiming(0, { duration: 500 });
			setTimeout(() => settings.set('onboarding.completed', true), 500);
		}

		return <>
			{res}
			<Content
				instance={content.instance}
				opacity={contentOpacity}
			/>
			<Onboarding
				contentId={content.id}
				setContent={setContent}
				opacity={onboardingOpacity}
				onComplete={onComplete}
			/>
		</>;
	});
}

export function stop() {
	Patcher.unpatchAll();
}