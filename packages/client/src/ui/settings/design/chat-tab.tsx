import { createLogger } from '@unbound-app/logger';
import { Image } from 'react-native';
import { useMemo } from 'react';

import { isPickedChatBackground, pickChatBackground } from '~/themes/pick-chat-background';
import type { ChatBackgroundSource } from '~/themes/chat-background';
import { getDefault, useUnboundSettings } from '~/settings/unbound';
import SliderRow from '~/ui/settings-kit/slider-row';
import RadioRow from '~/ui/settings-kit/radio-row';
import UrlRow from '~/ui/settings-kit/url-row';
import { Discord } from '~/metro/components';
import ThemeStore from '~/themes/state';
import Page from '~/ui/components/page';
import { messages } from '~/i18n/api';
import { icons } from '~/assets/api';
import { show } from '~/toasts/api';

import useStyles from './chat-tab.style';

const Logger = createLogger('Themes', 'ChatBackground');

const SOURCES: ChatBackgroundSource[] = ['theme', 'custom', 'off'];

function isSource(value: string): value is ChatBackgroundSource {
	return SOURCES.some((source) => source === value);
}

function formatPercent(fraction: number): string {
	return `${Math.round(fraction * 100)}%`;
}

/**
 * @description The Chat tab, laid out as Discord's appearance settings: a radio group for where the chat background
 * comes from, then the user's own photo or image URL and how it looks when they pick Custom.
 */
function ChatTab() {
	const styles = useStyles();
	const settings = useUnboundSettings(({ key }) => key?.startsWith('chat-background.'));
	const recommended = ThemeStore((state) => Boolean(state.data?.background));
	const source = settings.get('chat-background.source');
	const url = settings.get('chat-background.url');
	const picked = isPickedChatBackground(url);

	async function choosePhoto() {
		try {
			const chosen = await pickChatBackground(url);

			if (chosen) {
				settings.set('chat-background.url', chosen);
			}
		} catch (error) {
			Logger.error('Failed to choose chat background photo:', error);
			show({
				title: messages.UNBOUND_CHAT_BACKGROUND_PHOTO_FAILED,
				content: error instanceof Error ? error.message : String(error),
				icon: 'CircleXIcon',
			});
		}
	}
	const options = useMemo(
		() => [
			{
				value: 'theme',
				label: messages.UNBOUND_CHAT_BACKGROUND_THEME,
				subLabel: recommended
					? messages.UNBOUND_CHAT_BACKGROUND_THEME_HINT
					: messages.UNBOUND_CHAT_BACKGROUND_NO_THEME_HINT,
			},
			{
				value: 'custom',
				label: messages.UNBOUND_CHAT_BACKGROUND_CUSTOM,
				subLabel: messages.UNBOUND_CHAT_BACKGROUND_CUSTOM_HINT,
			},
			{
				value: 'off',
				label: messages.UNBOUND_CHAT_BACKGROUND_OFF,
				subLabel: messages.UNBOUND_CHAT_BACKGROUND_OFF_HINT,
			},
		],
		[recommended],
	);

	return (
		<Page>
			<RadioRow
				title={messages.UNBOUND_CHAT_BACKGROUND}
				value={source}
				options={options}
				onChange={(value) => {
					if (isSource(value)) {
						settings.set('chat-background.source', value);
					}
				}}
			/>
			{source === 'custom' ? (
				<Discord.TableRowGroup title={messages.UNBOUND_CHAT_BACKGROUND_IMAGE}>
					<Discord.TableRow
						label={messages.UNBOUND_CHAT_BACKGROUND_PHOTO}
						icon={<Discord.TableRowIcon source={icons.ImageIcon} />}
						trailing={
							picked ? (
								<Image
									source={{ uri: url }}
									resizeMode='cover'
									style={styles.thumbnail}
								/>
							) : undefined
						}
						arrow
						onPress={() => void choosePhoto()}
					/>
					<UrlRow
						label={messages.UNBOUND_CHAT_BACKGROUND_URL}
						value={picked ? '' : url}
						placeholder={messages.UNBOUND_CHAT_BACKGROUND_URL_UNSET}
						onChange={(next) => settings.set('chat-background.url', next)}
					/>
					<SliderRow
						label={messages.UNBOUND_CHAT_BACKGROUND_BLUR}
						value={settings.get('chat-background.blur')}
						defaultValue={getDefault('chat-background.blur')}
						minimum={0}
						maximum={30}
						unit='px'
						onChange={(blur) => settings.set('chat-background.blur', blur)}
					/>
					<SliderRow
						label={messages.UNBOUND_CHAT_BACKGROUND_OPACITY}
						value={settings.get('chat-background.opacity')}
						defaultValue={getDefault('chat-background.opacity')}
						minimum={0}
						maximum={1}
						step={0.05}
						format={formatPercent}
						onChange={(opacity) => settings.set('chat-background.opacity', opacity)}
					/>
				</Discord.TableRowGroup>
			) : null}
		</Page>
	);
}

export default ChatTab;
