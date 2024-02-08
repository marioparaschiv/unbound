import { getStore, useSettingsStore } from '@api/storage';
import { Reanimated } from '@metro/common';
import { createPatcher } from '@patcher';
import { findByName } from '@metro';


import Onboarding from './components/Onboarding';
import Content from './components/Content';

const Patcher = createPatcher('onboarding');
const { useSharedValue, withTiming } = Reanimated;

export const data = {
	id: 'modules.onboarding',
	default: true
};

export function initialize() {
	const store = getStore('unbound');

	if (!store.get('onboarding.completed', false)) {
		store.set('onboarding.hidden', false);
		store.set('onboarding.install', false);
	} else {
		return;
	};

	const LaunchPadContainer = findByName('LaunchPadContainer', { interop: false });

	Patcher.after(LaunchPadContainer, 'default', (_, __, res) => {
		const [content, setContent] = React.useState({ id: '', instance: null });
		const settings = useSettingsStore('unbound');
		const contentOpacity = useSharedValue(0);
		const onboardingOpacity = useSharedValue(0);

		React.useEffect(() => {
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

export function shutdown() {
	Patcher.unpatchAll();
}