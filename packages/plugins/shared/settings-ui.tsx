import type { ReactNode } from 'react';

import { metro } from '@unbound-app/api';

export type SettingsColors = {
	page: string;
	surface: string;
	input: string;
	border: string;
	text: string;
	muted: string;
	accent: string;
	danger: string;
};

export type SettingsTouchEvent = { target: unknown };

export const SETTINGS_SPACING = {
	outer: 16,
	section: 24,
	card: 16,
	rowGap: 10,
	touchTarget: 48,
} as const;

export function getSettingsColors(): SettingsColors {
	const colors = (((metro.common as any).Theme as any)?.colors ?? {}) as Record<string, unknown>;
	const color = (key: string, fallback: string): string =>
		typeof colors[key] === 'string' ? (colors[key] as string) : fallback;

	return {
		page: color('BACKGROUND_MOBILE_PRIMARY', color('BACKGROUND_PRIMARY', '#111214')),
		surface: color('BACKGROUND_SECONDARY', '#1e1f22'),
		input: color('BACKGROUND_TERTIARY', '#111214'),
		border: color('BACKGROUND_MODIFIER_ACCENT', '#4e5058'),
		text: color('TEXT_NORMAL', '#f2f3f5'),
		muted: color('TEXT_MUTED', '#b5bac1'),
		accent: color('BRAND_500', '#5865f2'),
		danger: color('RED_400', '#ed4245'),
	};
}

export function SettingsScrollView({
	children,
	onTouchStart,
}: {
	children: ReactNode;
	onTouchStart?: (event: SettingsTouchEvent) => void;
}) {
	const ReactNative = metro.common.ReactNative;
	const colors = getSettingsColors();

	return (
		<ReactNative.ScrollView
			contentContainerStyle={{
				backgroundColor: colors.page,
				gap: SETTINGS_SPACING.section,
				padding: SETTINGS_SPACING.outer,
				paddingBottom: 32,
			}}
			keyboardDismissMode={onTouchStart ? 'on-drag' : 'none'}
			keyboardShouldPersistTaps='handled'
			onTouchStart={onTouchStart}
		>
			{children}
		</ReactNative.ScrollView>
	);
}

export function SettingsHeader({ title, description }: { title: string; description: string }) {
	const ReactNative = metro.common.ReactNative;
	const colors = getSettingsColors();

	return (
		<ReactNative.View style={{ gap: 6 }}>
			<ReactNative.Text style={{ color: colors.text, fontSize: 24, fontWeight: '800' }}>
				{title}
			</ReactNative.Text>
			<ReactNative.Text style={{ color: colors.muted, fontSize: 15, lineHeight: 21 }}>
				{description}
			</ReactNative.Text>
		</ReactNative.View>
	);
}

export function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
	const ReactNative = metro.common.ReactNative;
	const colors = getSettingsColors();

	return (
		<ReactNative.View style={{ gap: SETTINGS_SPACING.rowGap }}>
			<ReactNative.Text
				style={{
					color: colors.muted,
					fontSize: 13,
					fontWeight: '800',
					letterSpacing: 0.5,
					paddingHorizontal: 4,
					textTransform: 'uppercase',
				}}
			>
				{title}
			</ReactNative.Text>
			<ReactNative.View style={{ gap: SETTINGS_SPACING.rowGap }}>{children}</ReactNative.View>
		</ReactNative.View>
	);
}

export function SettingsCard({ children }: { children: ReactNode }) {
	const ReactNative = metro.common.ReactNative;
	const colors = getSettingsColors();

	return (
		<ReactNative.View
			style={{
				backgroundColor: colors.surface,
				borderColor: colors.border,
				borderRadius: 14,
				borderWidth: 1,
				padding: SETTINGS_SPACING.card,
			}}
		>
			{children}
		</ReactNative.View>
	);
}

export function SettingsRow({
	label,
	description,
	onPress,
	disabled,
	trailing,
	arrow,
}: {
	label: string;
	description?: string;
	onPress?: () => void;
	disabled?: boolean;
	trailing?: ReactNode;
	arrow?: boolean;
}) {
	const ReactNative = metro.common.ReactNative;
	const colors = getSettingsColors();
	const trailingContent =
		trailing !== undefined && trailing !== null ? (
			typeof trailing === 'string' || typeof trailing === 'number' ? (
				<ReactNative.Text style={{ color: colors.accent, fontSize: 18, fontWeight: '800' }}>
					{trailing}
				</ReactNative.Text>
			) : (
				trailing
			)
		) : arrow ? (
			<ReactNative.Text style={{ color: colors.muted, fontSize: 26, lineHeight: 26 }}>
				›
			</ReactNative.Text>
		) : null;
	const content = (
		<ReactNative.View
			style={{
				alignItems: 'center',
				flexDirection: 'row',
				gap: 12,
				minHeight: SETTINGS_SPACING.touchTarget,
			}}
		>
			<ReactNative.View style={{ flex: 1, gap: 4 }}>
				<ReactNative.Text style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}>
					{label}
				</ReactNative.Text>
				{description ? (
					<ReactNative.Text style={{ color: colors.muted, fontSize: 14, lineHeight: 19 }}>
						{description}
					</ReactNative.Text>
				) : null}
			</ReactNative.View>
			{trailingContent}
		</ReactNative.View>
	);

	if (!onPress) return <SettingsCard>{content}</SettingsCard>;

	return (
		<ReactNative.Pressable
			disabled={disabled}
			onPress={onPress}
			style={({ pressed }: { pressed: boolean }) => ({
				opacity: disabled ? 0.45 : pressed ? 0.7 : 1,
			})}
		>
			<SettingsCard>{content}</SettingsCard>
		</ReactNative.Pressable>
	);
}

export function SettingsSwitchRow({
	label,
	description,
	value,
	onValueChange,
}: {
	label: string;
	description?: string;
	value: boolean;
	onValueChange: (value: boolean) => void;
}) {
	const ReactNative = metro.common.ReactNative;
	const colors = getSettingsColors();

	return (
		<SettingsCard>
			<ReactNative.View
				style={{
					alignItems: 'center',
					flexDirection: 'row',
					gap: 12,
					minHeight: SETTINGS_SPACING.touchTarget,
				}}
			>
				<ReactNative.View style={{ flex: 1, gap: 4 }}>
					<ReactNative.Text
						style={{ color: colors.text, fontSize: 16, fontWeight: '700' }}
					>
						{label}
					</ReactNative.Text>
					{description ? (
						<ReactNative.Text
							style={{ color: colors.muted, fontSize: 14, lineHeight: 19 }}
						>
							{description}
						</ReactNative.Text>
					) : null}
				</ReactNative.View>
				<ReactNative.Switch onValueChange={onValueChange} value={value} />
			</ReactNative.View>
		</SettingsCard>
	);
}

export function SettingsButton({
	label,
	onPress,
	danger,
}: {
	label: string;
	onPress: () => void;
	danger?: boolean;
}) {
	const ReactNative = metro.common.ReactNative;
	const colors = getSettingsColors();

	return (
		<ReactNative.Pressable
			onPress={onPress}
			style={({ pressed }: { pressed: boolean }) => ({
				alignItems: 'center',
				backgroundColor: danger ? colors.danger : colors.accent,
				borderRadius: 12,
				minHeight: SETTINGS_SPACING.touchTarget,
				opacity: pressed ? 0.7 : 1,
				justifyContent: 'center',
				paddingHorizontal: 16,
			})}
		>
			<ReactNative.Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>
				{label}
			</ReactNative.Text>
		</ReactNative.Pressable>
	);
}
