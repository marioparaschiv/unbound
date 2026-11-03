import { toasts } from '@unbound-app/api';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import PlatformIcon from '~/components/platform-icon';
import { describePlatforms, platformLabel } from '~/platforms';
import { usePlatformStatuses } from '~/status-map';

type PlatformIndicatorsProps = {
	userId: string;
	small: boolean;
	pressable: boolean;
	style?: StyleProp<ViewStyle>;
};

function showPlatform(platform: string) {
	toasts.show({
		id: 'platform-indicators',
		title: 'Platform Indicators',
		content: platformLabel(platform),
	});
}

function PlatformIndicators({ userId, small, pressable, style }: PlatformIndicatorsProps) {
	const statuses = usePlatformStatuses(userId);

	if (!statuses.length) return null;

	return (
		<View
			accessible={!pressable}
			accessibilityLabel={describePlatforms(statuses)}
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
