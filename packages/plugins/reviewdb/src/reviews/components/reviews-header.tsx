import type { ReactNode } from 'react';

import { format, messages } from '@unbound-app/i18n';
import { Text, View } from 'react-native';

import type { ReviewColors } from '~/reviews/colors';

type PillProps = {
	color: string;
	background: string;
	border: string;
	children: ReactNode;
};

type ReviewsHeaderProps = {
	name: string;
	reviewCount: number;
	authorized: boolean;
	colors: ReviewColors;
};

function Pill({ color, background, border, children }: PillProps) {
	return (
		<View
			style={{
				backgroundColor: background,
				borderColor: border,
				borderRadius: 8,
				borderWidth: 1,
				paddingHorizontal: 9,
				paddingVertical: 5,
			}}
		>
			<Text style={{ color, fontSize: 12, fontWeight: '700' }}>{children}</Text>
		</View>
	);
}

function ReviewsHeader({ name, reviewCount, authorized, colors }: ReviewsHeaderProps) {
	return (
		<View style={{ gap: 8, paddingBottom: 4 }}>
			<Text style={{ color: colors.text, fontSize: 24, fontWeight: '800' }}>
				{format('REVIEWS_FOR', { name })}
			</Text>
			<Text style={{ color: colors.muted, fontSize: 14, lineHeight: 20 }}>
				{messages.COMMUNITY_FEEDBACK}
			</Text>
			<View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
				<Pill color={colors.text} background={colors.surfaceAlt} border={colors.border}>
					{format('REVIEW_COUNT', { count: reviewCount })}
				</Pill>
				{authorized ? (
					<Pill
						color={colors.positive}
						background={`${colors.positive}22`}
						border={`${colors.positive}66`}
					>
						{messages.CONNECTED}
					</Pill>
				) : null}
			</View>
		</View>
	);
}

export default ReviewsHeader;
