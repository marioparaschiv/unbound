import { Section, useFormStyles } from '@ui/misc/forms';
import { useSettingsStore } from '@api/storage';
import { ScrollView, View } from 'react-native';
import { Discord } from '@api/metro/components';
import { useCallback, useState } from 'react';
import { showToast } from '@api/toasts';
import { Strings } from '@api/i18n';
import { Icons } from '@api/assets';
import { noop } from '@utilities';

import useStyles from './toasts.style';


function Toasts() {
	const [alternate, setAlternate] = useState(true);
	const settings = useSettingsStore('unbound');
	const { endStyle } = useFormStyles();
	const styles = useStyles();

	const maxOnScreen = settings.get('toasts.maxOnScreen', 3);
	const duration = settings.get('toasts.duration', 0);
	const opacity = settings.get('toasts.opacity', 0.8);
	const blur = settings.get('toasts.blur', 0.15);

	const openExampleToast = useCallback(() => {
		const toast = showToast({
			get title() {
				return Strings[`UNBOUND_${alternate ? 'TOASTS' : 'TESTING'}`];
			},

			get content() {
				return Strings[`UNBOUND_TOASTS_EXAMPLE_CONTENT_${alternate ? 'ALTERNATE' : 'PRIMARY'}`];
			},

			icon: alternate ? 'ic_star_filled' : 'StarIcon'
		});

		setAlternate(p => !p);

		// Add buttons after the toast has loaded to allow for using toast.close
		toast.update({
			buttons: alternate ? [
				{
					get content() {
						return Strings.CLOSE;
					},

					onPress: toast.close,
				},
				{
					get content() {
						return Strings.NONE;
					},

					onPress: noop,
					variant: 'tertiary'
				}
			] : []
		});

		setTimeout(
			() => toast.update({
				get title() {
					return Strings[`UNBOUND_TOASTS_EXAMPLE_TITLE_UPDATE_${alternate ? 'ALTERNATE' : 'PRIMARY'}`];
				},

				get content() {
					return Strings[`UNBOUND_TOASTS_EXAMPLE_CONTENT_UPDATE_${alternate ? 'ALTERNATE' : 'PRIMARY'}`];
				},

				icon: alternate ? 'smile' : 'MusicIcon',
				buttons: [
					{
						get content() {
							return Strings[alternate ? 'CLOSE' : 'NONE'];
						},

						onPress: alternate ? toast.close : noop,
						variant: 'primary'
					}
				]
			}),
			1000
		);
	}, [alternate]);

	return <ScrollView>
		<Section>
			<Discord.TableSwitchRow
				label={Strings.UNBOUND_ENABLED}
				subLabel={Strings.UNBOUND_TOASTS_DESC}
				icon={<Discord.TableRowIcon source={Icons['ic_notification_settings']} />}
				value={settings.get('toasts.enabled', true)}
				onValueChange={() => settings.toggle('toasts.enabled', true)}
			/>
			<Discord.TableSwitchRow
				label={Strings.UNBOUND_TOASTS_ANIMATIONS}
				subLabel={Strings.UNBOUND_TOASTS_ANIMATIONS_DESC}
				icon={<Discord.TableRowIcon source={Icons['ic_wand']} />}
				value={settings.get('toasts.animations', true)}
				onValueChange={() => settings.toggle('toasts.animations', true)}
			/>
			<Discord.TableRow
				arrow={true}
				label={Strings.UNBOUND_SHOW_TOAST}
				icon={<Discord.TableRowIcon source={Icons['ic_star_filled']} />}
				onPress={openExampleToast}
			/>
		</Section>
		<Section title={Strings.APPEARANCE}>
			<Discord.TableRow
				label={Strings.UNBOUND_TOAST_BACKGROUND_BLUR}
				trailing={(
					<Discord.Text variant='text-sm/normal' color='text-muted'>
						{Math.round(blur * 100) + '%'}
					</Discord.Text>
				)}
			/>
			<View style={endStyle}>
				<Discord.Slider
					style={styles.slider}
					value={blur}
					onValueChange={v => settings.set('toasts.blur', Math.round(v * 100) / 100)}
					minimumValue={0}
					maximumValue={1}
					tapToSeek
				/>
			</View>
		</Section>
		<Section>
			<Discord.TableRow
				label={Strings.UNBOUND_TOAST_BACKGROUND_OPACITY}
				trailing={(
					<Discord.Text variant='text-sm/normal' color='text-muted'>
						{Math.round(opacity * 100) + '%'}
					</Discord.Text>
				)}
			/>
			<View style={endStyle}>
				<Discord.Slider
					style={styles.slider}
					value={opacity}
					onValueChange={v => settings.set('toasts.opacity', Math.round(v * 100) / 100)}
					minimumValue={0}
					maximumValue={1}
					tapToSeek
				/>
			</View>
		</Section>


		<Section title={Strings.UNBOUND_BEHAVIOUR}>
			<Discord.TableRow
				label={Strings.UNBOUND_TOAST_MAX_ON_SCREEN}
				trailing={(
					<Discord.Text variant='text-sm/normal' color='text-muted'>
						{maxOnScreen === 0 ? Strings.UNBOUND_INFINITE : maxOnScreen}
					</Discord.Text>
				)}
			/>
			<View style={endStyle}>
				<Discord.Slider
					style={styles.slider}
					value={maxOnScreen}
					onValueChange={v => settings.set('toasts.maxOnScreen', Math.round(v))}
					minimumValue={0}
					maximumValue={6}
					tapToSeek
				/>
			</View>
		</Section>

		<Section>
			<Discord.TableRow
				label={Strings.UNBOUND_TOAST_DURATION}
				trailing={(
					<Discord.Text variant='text-sm/normal' color='text-muted'>
						{duration === 0 ? Strings.UNBOUND_INDEFINITE : Strings.DURATION_SECONDS.format({ seconds: duration })}
					</Discord.Text>
				)}
			/>
			<View style={endStyle}>
				<Discord.Slider
					style={styles.slider}
					value={duration}
					onValueChange={v => settings.set('toasts.duration', Math.round(v * 10) / 10)}
					minimumValue={0}
					maximumValue={10}
					tapToSeek
				/>
			</View>
		</Section>
		<Discord.Text variant='text-xs/normal' color='text-muted' style={styles.durationHint}>
			{Strings.UNBOUND_TOAST_DURATION_DESC}
		</Discord.Text>
	</ScrollView>;
}

export default Toasts;
