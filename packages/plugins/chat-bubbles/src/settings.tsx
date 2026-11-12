import { resetSettings, settings, useSetting } from '@unbound-app/settings';
import { Discord } from '@unbound-app/api/metro/components';
import { messages } from '@unbound-app/i18n';
import { dialogs, ui } from '@unbound-app/api';
import { View } from 'react-native';

import {
	BubbleBlur,
	BubbleLayout,
	BubbleLimits,
	BubbleStyle,
	type BubbleLayoutName,
	CornerCurve,
	Grouping,
	MediaCorners,
	MENTION_WIDTH_STEP,
	ReplyStyle,
} from '~/lib/constants';
import { bubbleLayout, choice, parseHexColor, replyStyle } from '~/lib/style';
import { themeBubbleColor } from '~/lib/theme';
import { hexColor } from '~/lib/shade';
import { matchingPreset, PRESETS, type Look, type PresetName } from '~/presets';
import ChatPreview from '~/preview/chat-preview';

type NumberKey =
	| 'radius'
	| 'horizontalPadding'
	| 'verticalPadding'
	| 'spacing'
	| 'groupSpacing'
	| 'opacity'
	| 'tailSize'
	| 'mentionOpacity'
	| 'mentionTint'
	| 'mentionWidth';

type SwitchKey =
	| 'roomyRows'
	| 'avatarLast'
	| 'nameInside'
	| 'roundOuter'
	| 'roundExposed'
	| 'joinCurves'
	| 'smoothSteps'
	| 'tail';

type Limits = { fallback: number; maximum: number; step?: number };

type Unit = 'points' | 'percent';

const LIMITS: Record<NumberKey, Limits> = {
	radius: { fallback: BubbleStyle.radius, maximum: BubbleLimits.radius },
	horizontalPadding: { fallback: BubbleStyle.horizontalPadding, maximum: BubbleLimits.padding },
	verticalPadding: { fallback: BubbleStyle.verticalPadding, maximum: BubbleLimits.padding },
	spacing: { fallback: BubbleStyle.spacing, maximum: BubbleLimits.spacing },
	groupSpacing: { fallback: BubbleStyle.groupSpacing, maximum: BubbleLimits.spacing },
	opacity: { fallback: BubbleStyle.opacity, maximum: BubbleLimits.opacity },
	tailSize: { fallback: BubbleStyle.tailSize, maximum: BubbleLimits.tailSize },
	mentionOpacity: { fallback: BubbleStyle.mentionOpacity, maximum: BubbleLimits.opacity },
	mentionTint: { fallback: BubbleStyle.mentionTint, maximum: BubbleLimits.opacity },
	mentionWidth: {
		fallback: BubbleStyle.mentionWidth,
		maximum: BubbleLimits.mentionWidth,
		step: MENTION_WIDTH_STEP,
	},
};

function storedNumber(value: unknown, { fallback, maximum, step = 1 }: Limits): number {
	const number = Number(value);

	return Number.isFinite(number)
		? Math.max(0, Math.min(maximum, Math.round(number / step) * step))
		: fallback;
}

function storedColor(value: unknown): string | undefined {
	return typeof value === 'string' && parseHexColor(value.trim()) ? value.trim() : undefined;
}

function themeColor(): string {
	return hexColor(themeBubbleColor());
}

function NumberRow({ setting, label, unit }: { setting: NumberKey; label: string; unit: Unit }) {
	const limits = LIMITS[setting];

	return (
		<ui.SliderRow
			label={label}
			value={storedNumber(useSetting(setting), limits)}
			defaultValue={limits.fallback}
			minimum={0}
			maximum={limits.maximum}
			{...(limits.step ? { step: limits.step } : {})}
			unit={unit === 'points' ? messages.UNIT_POINTS : messages.UNIT_PERCENT}
			onChange={(value) => {
				settings[setting] = value;
			}}
		/>
	);
}

const OFF_BY_DEFAULT = new Set<SwitchKey>(['avatarLast', 'tail']);

function SwitchRow({
	setting,
	label,
	subLabel,
	disabled = false,
}: {
	setting: SwitchKey;
	label: string;
	subLabel: string;
	disabled?: boolean;
}) {
	const stored = useSetting(setting);
	const value = OFF_BY_DEFAULT.has(setting) ? stored === true : stored !== false;

	return (
		<ui.SwitchRow
			label={label}
			subLabel={subLabel}
			value={value}
			disabled={disabled}
			onValueChange={(next: boolean) => {
				settings[setting] = next;
			}}
		/>
	);
}

function applyPreset(name: PresetName) {
	Object.assign(settings, PRESETS[name]);
}

// A custom style matches no preset, so replacing it asks first.
async function pickPreset(name: string, custom: boolean) {
	if (!(name in PRESETS)) return;

	if (
		custom &&
		!(await dialogs.confirm('PRESET_REPLACE', {
			body: 'PRESET_REPLACE_BODY',
			confirm: 'PRESET_REPLACE_CONFIRM',
			destructive: true,
		}))
	)
		return;

	applyPreset(name as PresetName);
}

function PresetPicker() {
	// Every key of a preset is read here, so the picked preset follows each change.
	const look = Object.fromEntries(
		Object.keys(PRESETS.messages).map((key) => [key, useSetting(key as keyof Look)]),
	);
	const picked = matchingPreset((key) => look[key]);

	return (
		<ui.RadioRow
			title={messages.PRESETS}
			description={messages.PRESETS_DESCRIPTION}
			value={picked ?? ''}
			options={[
				{
					value: 'messages',
					label: messages.PRESET_MESSAGES,
					subLabel: messages.PRESET_MESSAGES_SUBTITLE,
				},
				{
					value: 'rounded',
					label: messages.PRESET_ROUNDED,
					subLabel: messages.PRESET_ROUNDED_SUBTITLE,
				},
				{
					value: 'joined',
					label: messages.PRESET_JOINED,
					subLabel: messages.PRESET_JOINED_SUBTITLE,
				},
			]}
			onChange={(value) => void pickPreset(value, picked === undefined)}
		/>
	);
}

function LayoutPicker({ layout }: { layout: BubbleLayoutName }) {
	return (
		<Discord.TableRadioGroup
			title={messages.LAYOUT}
			value={layout}
			onChange={(value: string) => {
				settings.layout = bubbleLayout(value);
			}}
		>
			<Discord.TableRadioRow
				label={messages.LAYOUT_FIT}
				subLabel={messages.LAYOUT_FIT_SUBTITLE}
				value={BubbleLayout.dynamic}
			/>
			<Discord.TableRadioRow
				label={messages.LAYOUT_CARD}
				subLabel={messages.LAYOUT_CARD_SUBTITLE}
				value={BubbleLayout.card}
			/>
		</Discord.TableRadioGroup>
	);
}

function ColorsSection() {
	const color = storedColor(useSetting('color'));
	const ownColor = storedColor(useSetting('ownColor'));
	const blur = choice(useSetting('blur'), BubbleBlur);
	const opaque = storedNumber(useSetting('opacity'), LIMITS.opacity) >= BubbleLimits.opacity;

	return (
		<ui.Section title={messages.COLORS}>
			<ui.ColorRow
				label={messages.BUBBLE_COLOR}
				color={color}
				fallbackColor={themeColor()}
				fallbackLabel={messages.BUBBLE_COLOR_FALLBACK}
				onChange={(value) => {
					settings.color = value ?? '';
				}}
			/>
			<ui.ColorRow
				label={messages.OWN_COLOR}
				color={ownColor}
				fallbackColor={color ?? themeColor()}
				fallbackLabel={messages.OWN_COLOR_FALLBACK}
				onChange={(value) => {
					settings.ownColor = value ?? '';
				}}
			/>
			<NumberRow setting='opacity' label={messages.OPACITY} unit='percent' />
			<ui.SegmentedRow
				label={messages.BLUR}
				subLabel={opaque ? messages.BLUR_NEEDS_OPACITY : messages.BLUR_SUBTITLE}
				value={blur}
				options={[
					{ value: BubbleBlur.off, label: messages.BLUR_OFF },
					{ value: BubbleBlur.light, label: messages.BLUR_LIGHT },
					{ value: BubbleBlur.medium, label: messages.BLUR_MEDIUM },
					{ value: BubbleBlur.strong, label: messages.BLUR_STRONG },
				]}
				onChange={(value) => {
					settings.blur = choice(value, BubbleBlur);
				}}
			/>
		</ui.Section>
	);
}

function ShapeSection() {
	const cornerCurve = choice(useSetting('cornerCurve'), CornerCurve);
	const tail = useSetting('tail') === true;

	return (
		<ui.Section title={messages.SHAPE}>
			<NumberRow setting='radius' label={messages.CORNER_RADIUS} unit='points' />
			<ui.SegmentedRow
				label={messages.CORNER_CURVE}
				value={cornerCurve}
				options={[
					{ value: CornerCurve.continuous, label: messages.CURVE_CONTINUOUS },
					{ value: CornerCurve.circular, label: messages.CURVE_CIRCULAR },
				]}
				onChange={(value) => {
					settings.cornerCurve = choice(value, CornerCurve);
				}}
			/>
			<SwitchRow setting='tail' label={messages.TAIL} subLabel={messages.TAIL_SUBTITLE} />
			{!tail ? null : (
				<NumberRow setting='tailSize' label={messages.TAIL_SIZE} unit='points' />
			)}
		</ui.Section>
	);
}

// Only the corner options the picked grouping uses are shown.
function GroupsSection() {
	const grouping = choice(useSetting('grouping'), Grouping);
	const roundOuter = useSetting('roundOuter') !== false;
	const roundExposed = useSetting('roundExposed') !== false;
	const grouped = grouping === Grouping.grouped;
	const joined = grouping === Grouping.joined;

	return (
		<ui.Section title={messages.GROUPS}>
			<ui.SegmentedRow
				label={messages.GROUPING}
				subLabel={messages.GROUPING_SUBTITLE}
				value={grouping}
				options={[
					{ value: Grouping.separate, label: messages.GROUPING_SEPARATE },
					{ value: Grouping.grouped, label: messages.GROUPING_GROUPED },
					{ value: Grouping.joined, label: messages.GROUPING_JOINED },
				]}
				onChange={(value) => {
					settings.grouping = choice(value, Grouping);
				}}
			/>
			{grouped ? (
				<SwitchRow
					setting='roundOuter'
					label={messages.ROUND_OUTER}
					subLabel={messages.ROUND_OUTER_SUBTITLE}
				/>
			) : null}
			{joined || (grouped && !roundOuter) ? (
				<SwitchRow
					setting='roundExposed'
					label={messages.ROUND_EXPOSED}
					subLabel={messages.ROUND_EXPOSED_SUBTITLE}
				/>
			) : null}
			{joined && roundExposed ? (
				<SwitchRow
					setting='joinCurves'
					label={messages.JOIN_CURVES}
					subLabel={messages.JOIN_CURVES_SUBTITLE}
				/>
			) : null}
			{joined ? (
				<SwitchRow
					setting='smoothSteps'
					label={messages.SMOOTH_STEPS}
					subLabel={messages.SMOOTH_STEPS_SUBTITLE}
				/>
			) : null}
		</ui.Section>
	);
}

// Quoting a reply needs room in the row, and in fitted bubbles the name inside too; otherwise it sits above.
function replyNote(fitted: boolean, roomyRows: boolean, nameInside: boolean): string {
	if (!roomyRows) return messages.REPLY_NEEDS_ROOM;

	return fitted && !nameInside ? messages.REPLY_NEEDS_NAME : messages.REPLY_SUBTITLE;
}

function ReplyRow({ fitted }: { fitted: boolean }) {
	const roomyRows = useSetting('roomyRows') !== false;
	const nameInside = useSetting('nameInside') !== false;
	const reply = replyStyle(useSetting('reply'), useSetting('avatarLast') === true);
	const usable = roomyRows && (!fitted || nameInside);

	return (
		<ui.SegmentedRow
			label={messages.REPLY}
			subLabel={replyNote(fitted, roomyRows, nameInside)}
			value={usable ? reply : ReplyStyle.icon}
			disabled={!usable}
			options={[
				{ value: ReplyStyle.quote, label: messages.REPLY_QUOTE },
				{ value: ReplyStyle.icon, label: messages.REPLY_ICON },
			]}
			onChange={(value) => {
				settings.reply = choice(value, ReplyStyle);
			}}
		/>
	);
}

function NameSection({ fitted }: { fitted: boolean }) {
	const roomyRows = useSetting('roomyRows') !== false;

	return (
		<ui.Section title={messages.NAME_AVATAR}>
			{fitted ? (
				<SwitchRow
					setting='nameInside'
					label={messages.NAME_INSIDE}
					subLabel={
						roomyRows ? messages.NAME_INSIDE_SUBTITLE : messages.NAME_INSIDE_NEEDS_ROOM
					}
					disabled={!roomyRows}
				/>
			) : null}
			<SwitchRow
				setting='avatarLast'
				label={messages.AVATAR_LAST}
				subLabel={messages.AVATAR_LAST_SUBTITLE}
			/>
			<ReplyRow fitted={fitted} />
		</ui.Section>
	);
}

function SpacingSection({ fitted }: { fitted: boolean }) {
	const joined = choice(useSetting('grouping'), Grouping) === Grouping.joined;

	return (
		<ui.Section title={messages.SPACING_SECTION}>
			<NumberRow setting='spacing' label={messages.SPACING} unit='points' />
			{joined ? null : (
				<NumberRow setting='groupSpacing' label={messages.GROUP_SPACING} unit='points' />
			)}
			{fitted ? (
				<NumberRow
					setting='horizontalPadding'
					label={messages.HORIZONTAL_PADDING}
					unit='points'
				/>
			) : null}
			{fitted ? (
				<NumberRow
					setting='verticalPadding'
					label={messages.VERTICAL_PADDING}
					unit='points'
				/>
			) : null}
			<SwitchRow
				setting='roomyRows'
				label={messages.ROOMY_ROWS}
				subLabel={messages.ROOMY_ROWS_SUBTITLE}
			/>
		</ui.Section>
	);
}

function MediaPicker() {
	const mediaCorners = choice(useSetting('mediaCorners'), MediaCorners);

	return (
		<ui.RadioRow
			title={messages.MEDIA_CORNERS}
			value={mediaCorners}
			options={[
				{
					value: MediaCorners.none,
					label: messages.MEDIA_NONE,
					subLabel: messages.MEDIA_NONE_SUBTITLE,
				},
				{
					value: MediaCorners.concentric,
					label: messages.MEDIA_CONCENTRIC,
					subLabel: messages.MEDIA_CONCENTRIC_SUBTITLE,
				},
				{
					value: MediaCorners.flush,
					label: messages.MEDIA_FLUSH,
					subLabel: messages.MEDIA_FLUSH_SUBTITLE,
				},
				{
					value: MediaCorners.reround,
					label: messages.MEDIA_REROUND,
					subLabel: messages.MEDIA_REROUND_SUBTITLE,
				},
			]}
			onChange={(value) => {
				settings.mediaCorners = choice(value, MediaCorners);
			}}
		/>
	);
}

function MentionsSection() {
	const mentionColor = storedColor(useSetting('mentionColor'));

	return (
		<ui.Section title={messages.MENTIONS}>
			<ui.ColorRow
				label={messages.MENTION_COLOR}
				color={mentionColor}
				fallbackColor={BubbleStyle.mentionColor}
				fallbackLabel={messages.MENTION_COLOR_FALLBACK}
				onChange={(value) => {
					settings.mentionColor = value ?? '';
				}}
			/>
			<NumberRow setting='mentionWidth' label={messages.MENTION_WIDTH} unit='points' />
			<NumberRow setting='mentionOpacity' label={messages.MENTION_OPACITY} unit='percent' />
			<NumberRow setting='mentionTint' label={messages.MENTION_TINT} unit='percent' />
		</ui.Section>
	);
}

// The preview stays above the scrolling settings, so every change shows while it is made.
// The most changed settings come first: the style and colors, then shape and groups, then fine spacing.
function SettingsPanel() {
	const layout = bubbleLayout(useSetting('layout'));
	const fitted = layout === BubbleLayout.dynamic;

	return (
		<View style={{ flex: 1 }}>
			<ChatPreview />
			<ui.Page>
				<PresetPicker />
				<LayoutPicker layout={layout} />
				<ColorsSection />
				<ShapeSection />
				<GroupsSection />
				<NameSection fitted={fitted} />
				<SpacingSection fitted={fitted} />
				{fitted ? <MediaPicker /> : null}
				<MentionsSection />
				<ui.ResetRow onReset={resetSettings} />
			</ui.Page>
		</View>
	);
}

export default SettingsPanel;
