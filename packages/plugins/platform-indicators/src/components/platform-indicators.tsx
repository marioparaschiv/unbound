import { useSetting } from '@unbound-app/settings';
import { toasts } from '@unbound-app/api';
import { messages, useMessages } from '@unbound-app/i18n';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import PlatformIcon from '~/components/platform-icon';
import { describePlatforms, platformLabel } from '~/lib/platforms';
import { usePlatformStatuses } from '~/lib/status-map';

type PlatformIndicatorsProps = {
	setting: 'memberList' | 'profiles';
	userId: string;
	small: boolean;
	pressable: boolean;
	style?: StyleProp<ViewStyle>;
};

function showPlatform(platform: string) {
	toasts.show({
		id: 'platform-indicators',
		title: messages.PLATFORM_INDICATORS,
		content: platformLabel(platform),
	});
}

function PlatformIndicators({ setting, userId, small, pressable, style }: PlatformIndicatorsProps) {
	const enabled = useSetting(setting);
	const statuses = usePlatformStatuses(userId);
	const locale = useMessages();

	// Hides itself when its switch turns off, so rows already on screen follow it.
	if (!enabled || !statuses.length) return null;

	return (
		<View
			accessible={!pressable}
			accessibilityLabel={describePlatforms(statuses, locale)}
			style={[
				{ flexDirection: 'row', alignItems: 'center', gap: 2, marginLeft: small ? 4 : 0 },
				style,
			]}
		>
			{statuses.map(({ platform, status }) =>
				pressable ? (
					<Pressable
						key={platform}
						accessibilityRole='button'
						accessibilityLabel={platformLabel(platform)}
						hitSlop={4}
						onPress={() => showPlatform(platform)}
					>
						<PlatformIcon platform={platform} status={status} small={small} />
					</Pressable>
				) : (
					<PlatformIcon
						key={platform}
						platform={platform}
						status={status}
						small={small}
					/>
				),
			)}
		</View>
	);
}

export default PlatformIndicators;
