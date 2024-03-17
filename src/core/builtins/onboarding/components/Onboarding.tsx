import { Constants, Reanimated, ReactNative as RN } from '@metro/common';
import type { SharedValue } from 'react-native-reanimated';
import { callbackWithAnimation } from '@utilities';
import { useSettingsStore } from '@api/storage';
import { Redesign } from '@metro/components';
import { getIDByName } from '@api/assets';
import { Strings } from '@api/i18n';
import useStyles from '../styles';
import Progress from './Progress';
import info from '../info';


type OnboardingProps = {
	contentId: string;
	setContent: Fn,
	opacity: SharedValue<number>,
	onComplete: () => void
}

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

	return !completed && !hidden && <Redesign.Backdrop blur={info[step + 1] ? 'strong' : 'subtle'} style={{ opacity }}>
		<View style={{ opacity, height: '100%' }}>
			<RN.SafeAreaView style={styles.container}>
				<RN.View style={styles.innerContainer}>
					<Progress step={step} />
					{info[step + 1] && <Redesign.Button
						key={'skip'}
						style={{ width: '80%', marginTop: 20 }}
						variant={'tertiary'}
						size={'md'}
						onPress={onComplete}
						icon={getIDByName('ic_message_retry')}
						text={Strings.UNBOUND_SKIP_ONBOARDING}
					/>}
				</RN.View>

				<RN.View style={styles.innerContainer}>
					{info[step].title && (
						<RN.Text style={[{
							fontSize: 24,
							fontFamily: Constants.Fonts.PRIMARY_BOLD,
							marginBottom: 18
						}, styles.title]}>
							{info[step].title}
						</RN.Text>
					)}
					{info[step].subtitle && (
						<RN.Text style={[{
							fontSize: 16,
							fontFamily: Constants.Fonts.PRIMARY_NORMAL,
							marginTop: -6,
							marginBottom: 20
						}, styles.subtitle]}>
							{info[step].subtitle}
						</RN.Text>
					)}
					{info[step].buttons.map(({ variant = 'primary', iconPosition = 'start', icon, text, onPress = onContinue }, i, array) => (
						<Redesign.Button
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
				</RN.View>
			</RN.SafeAreaView>
		</View>
	</Redesign.Backdrop>;
}