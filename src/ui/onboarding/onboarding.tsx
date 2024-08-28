import type { SharedValue } from 'react-native-reanimated';
import { Constants, Reanimated } from '@metro/common';
import { callbackWithAnimation } from '@utilities';
import { SafeAreaView, Text } from 'react-native';
import { useSettingsStore } from '@api/storage';
import { Design } from '@metro/components';
import { getIDByName } from '@api/assets';
import { Strings } from '@api/i18n';

import Progress from './progress';
import useStyles from './styles';
import info from './info';

type OnboardingProps = {
	contentId: string;
	setContent: Fn,
	opacity: SharedValue<number>,
	onComplete: () => void;
};

const { withTiming, default: { View } } = Reanimated;

export default function Onboarding({ contentId, setContent, opacity, onComplete }: OnboardingProps) {
	const settings = useSettingsStore('unbound');
	const styles = useStyles();

	const step = settings.get('onboarding.step', 0);
	const completed = settings.get('onboarding.completed', false);
	const hidden = settings.get('onboarding.hidden', false);

	function onContinue() {
		function toggleHiddenWithOpacity(value: boolean) {
			const callback = () => settings.set('onboarding.hidden', value);

			value ? setTimeout(callback, 500) : callback();
			opacity.value = withTiming(value ? 0 : 1, { duration: 500 });
		}

		info[step].callback({
			show: () => toggleHiddenWithOpacity(false),
			hide: () => toggleHiddenWithOpacity(true),
			next: callbackWithAnimation(() => settings.set('onboarding.step', (() => {
				if (!info[step + 1]) {
					onComplete();
					return step;
				}

				return step + 1;
			})())),
			contentId,
			setContent: callbackWithAnimation(setContent),
			styles
		});
	}

	return !completed && !hidden && <Design.Backdrop blur={info[step + 1] ? 'strong' : 'subtle'} style={{ opacity }}>
		<View style={{ opacity, height: '100%' }}>
			<SafeAreaView style={styles.container}>
				<View style={styles.innerContainer}>
					<Progress step={step} />
					{info[step + 1] && <Design.Button
						key={'skip'}
						style={{ width: '80%', marginTop: 20 }}
						variant={'tertiary'}
						size={'md'}
						onPress={onComplete}
						icon={getIDByName('ic_message_retry')}
						text={Strings.UNBOUND_SKIP_ONBOARDING}
					/>}
				</View>

				<View style={styles.innerContainer}>
					{info[step].title && (
						<Text style={[{
							fontSize: 24,
							fontFamily: Constants.Fonts.PRIMARY_BOLD,
							marginBottom: 18
						}, styles.title]}>
							{info[step].title}
						</Text>
					)}
					{info[step].subtitle && (
						<Text style={[{
							fontSize: 16,
							fontFamily: Constants.Fonts.PRIMARY_NORMAL,
							marginTop: -6,
							marginBottom: 20
						}, styles.subtitle]}>
							{info[step].subtitle}
						</Text>
					)}
					{info[step].buttons.map(({ variant = 'primary', iconPosition = 'start', icon, text, onPress = onContinue }, i, array) => (
						<Design.Button
							key={'continue'}
							style={{ width: '100%', marginBottom: i !== array.length - 1 ? 16 : 0 }}
							variant={variant}
							size={'lg'}
							onPress={onPress}
							icon={getIDByName(icon)}
							iconPosition={iconPosition}
							text={text}
						/>
					))}
				</View>
			</SafeAreaView>
		</View>
	</Design.Backdrop>;
}