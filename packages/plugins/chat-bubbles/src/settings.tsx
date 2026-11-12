import { resetSettings, settings, useSetting } from '@unbound-app/settings';
import { Discord } from '@unbound-app/api/metro/components';
import { messages } from '@unbound-app/i18n';
import { dialogs, ui } from '@unbound-app/api';

import {
	BubbleLayout,
	BubbleLimits,
	BubbleStyle,
	CornerCurve,
	Grouping,
	MediaCorners,
	MENTION_WIDTH_STEP,
	TailPosition,
} from '~/constants';
import { bubbleLayout, choice, parseHexColor } from '~/bubbles/style';
import { themeBubbleColor } from '~/bubbles/theme';
import { hexColor } from '~/bubbles/shade';
import { matchingPreset, PRESETS, type Look, type PresetName } from '~/presets';

type NumberKey = 'radius' | 'horizontalPadding' | 'verticalPadding' | 'spacing' | 'opacity';

type NumberSetting = {
	key: NumberKey;
	title: string;
	fallback: number;
	maximum: number;
	unit: string;
	dynamicOnly?: boolean;
};

// Built when the panel renders, so each title and unit follows the user's language.
function numberSettings(): NumberSetting[] {
	return [
		{
			key: 'radius',
			title: messages.CORNER_RADIUS,
			fallback: BubbleStyle.radius,
			maximum: BubbleLimits.radius,
			unit: messages.UNIT_POINTS,
		},
		{
			key: 'horizontalPadding',
			title: messages.HORIZONTAL_PADDING,
			fallback: BubbleStyle.horizontalPadding,
			maximum: BubbleLimits.padding,
			unit: messages.UNIT_POINTS,
			dynamicOnly: true,
		},
		{
			key: 'verticalPadding',
			title: messages.VERTICAL_PADDING,
			fallback: BubbleStyle.verticalPadding,
			maximum: BubbleLimits.padding,
			unit: messages.UNIT_POINTS,
			dynamicOnly: true,
		},
		{
			key: 'spacing',
			title: messages.SPACING,
			fallback: BubbleStyle.spacing,
			maximum: BubbleLimits.spacing,
			unit: messages.UNIT_POINTS,
		},
		{
			key: 'opacity',
			title: messages.OPACITY,
			fallback: BubbleStyle.opacity,
			maximum: BubbleLimits.opacity,
			unit: messages.UNIT_PERCENT,
		},
	];
}

function storedNumber(
	value: unknown,
	setting: Pick<NumberSetting, 'fallback' | 'maximum'>,
	step = 1,
): number {
	const number = Number(value);

	return Number.isFinite(number)
		? Math.max(0, Math.min(setting.maximum, Math.round(number / step) * step))
		: setting.fallback;
}

function storedColor(value: unknown): string | undefined {
	return typeof value === 'string' && parseHexColor(value.trim()) ? value.trim() : undefined;
}

function themeColor(): string {
	return hexColor(themeBubbleColor());
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

function SettingsPanel() {
	const storedLayout = useSetting('layout');
	const color = storedColor(useSetting('color'));
	const ownColor = storedColor(useSetting('ownColor'));
	const mentionColor = storedColor(useSetting('mentionColor'));
	const mentionOpacity = storedNumber(useSetting('mentionOpacity'), {
		fallback: BubbleStyle.mentionOpacity,
		maximum: BubbleLimits.opacity,
	});
	const mentionTint = storedNumber(useSetting('mentionTint'), {
		fallback: BubbleStyle.mentionTint,
		maximum: BubbleLimits.opacity,
	});
	const mentionWidth = storedNumber(
		useSetting('mentionWidth'),
		{ fallback: BubbleStyle.mentionWidth, maximum: BubbleLimits.mentionWidth },
		MENTION_WIDTH_STEP,
	);
	const values = {
		radius: useSetting('radius'),
		horizontalPadding: useSetting('horizontalPadding'),
		verticalPadding: useSetting('verticalPadding'),
		spacing: useSetting('spacing'),
		opacity: useSetting('opacity'),
	};
	const groupSpacing = storedNumber(useSetting('groupSpacing'), {
		fallback: BubbleStyle.groupSpacing,
		maximum: BubbleLimits.spacing,
	});
	const mediaCorners = choice(useSetting('mediaCorners'), MediaCorners);
	const cornerCurve = choice(useSetting('cornerCurve'), CornerCurve);
	const grouping = choice(useSetting('grouping'), Grouping);
	const roundExposed = useSetting('roundExposed') !== false;
	const roundOuter = useSetting('roundOuter') !== false;
	const joinCurves = useSetting('joinCurves') !== false;
	const smoothSteps = useSetting('smoothSteps') !== false;
	const joined = grouping === Grouping.joined;
	const roomyRows = useSetting('roomyRows') !== false;
	const avatarLast = useSetting('avatarLast') === true;
	const nameInside = useSetting('nameInside') !== false;
	const tail = choice(useSetting('tail'), TailPosition);
	const tailSize = storedNumber(useSetting('tailSize'), {
		fallback: BubbleStyle.tailSize,
		maximum: BubbleLimits.tailSize,
	});
	const layout = bubbleLayout(storedLayout);
	const shapeSettings = numberSettings().filter(
		(setting) => layout === BubbleLayout.dynamic || !setting.dynamicOnly,
	);

	return (
		<ui.Page>
			<PresetPicker />
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
			<ui.Section title={messages.SHAPE}>
				{shapeSettings.map((setting) => (
					<ui.SliderRow
						key={setting.key}
						label={setting.title}
						value={storedNumber(values[setting.key], setting)}
						defaultValue={setting.fallback}
						minimum={0}
						maximum={setting.maximum}
						unit={setting.unit}
						onChange={(value) => {
							settings[setting.key] = value;
						}}
					/>
				))}
				<ui.SwitchRow
					label={messages.ROOMY_ROWS}
					subLabel={messages.ROOMY_ROWS_SUBTITLE}
					value={roomyRows}
					onValueChange={(value: boolean) => {
						settings.roomyRows = value;
					}}
				/>
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
			</ui.Section>
			<ui.Section title={messages.GROUPING}>
				<ui.SegmentedRow
					label={messages.GROUPING}
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
				{joined ? null : (
					<ui.SliderRow
						label={messages.GROUP_SPACING}
						value={groupSpacing}
						defaultValue={BubbleStyle.groupSpacing}
						minimum={0}
						maximum={BubbleLimits.spacing}
						unit={messages.UNIT_POINTS}
						onChange={(value) => {
							settings.groupSpacing = value;
						}}
					/>
				)}
				<ui.SwitchRow
					label={messages.ROUND_OUTER}
					subLabel={messages.ROUND_OUTER_SUBTITLE}
					value={roundOuter}
					disabled={grouping !== Grouping.grouped}
					onValueChange={(value: boolean) => {
						settings.roundOuter = value;
					}}
				/>
				<ui.SwitchRow
					label={messages.ROUND_EXPOSED}
					subLabel={messages.ROUND_EXPOSED_SUBTITLE}
					value={roundExposed}
					disabled={
						grouping === Grouping.separate ||
						(grouping === Grouping.grouped && roundOuter)
					}
					onValueChange={(value: boolean) => {
						settings.roundExposed = value;
					}}
				/>
				<ui.SwitchRow
					label={messages.JOIN_CURVES}
					subLabel={messages.JOIN_CURVES_SUBTITLE}
					value={joinCurves}
					disabled={!joined || !roundExposed}
					onValueChange={(value: boolean) => {
						settings.joinCurves = value;
					}}
				/>
				<ui.SwitchRow
					label={messages.SMOOTH_STEPS}
					subLabel={messages.SMOOTH_STEPS_SUBTITLE}
					value={smoothSteps}
					disabled={!joined}
					onValueChange={(value: boolean) => {
						settings.smoothSteps = value;
					}}
				/>
				<ui.SwitchRow
					label={messages.AVATAR_LAST}
					subLabel={messages.AVATAR_LAST_SUBTITLE}
					value={avatarLast}
					onValueChange={(value: boolean) => {
						settings.avatarLast = value;
					}}
				/>
				<ui.SwitchRow
					label={messages.NAME_INSIDE}
					subLabel={messages.NAME_INSIDE_SUBTITLE}
					value={nameInside}
					disabled={!roomyRows || layout !== BubbleLayout.dynamic}
					onValueChange={(value: boolean) => {
						settings.nameInside = value;
					}}
				/>
			</ui.Section>
			<ui.Section title={messages.TAIL}>
				<ui.SegmentedRow
					label={messages.TAIL}
					value={tail}
					options={[
						{ value: TailPosition.off, label: messages.TAIL_OFF },
						{ value: TailPosition.first, label: messages.TAIL_FIRST },
						{ value: TailPosition.last, label: messages.TAIL_LAST },
					]}
					onChange={(value) => {
						settings.tail = choice(value, TailPosition);
					}}
				/>
				{tail === TailPosition.off ? null : (
					<ui.SliderRow
						label={messages.TAIL_SIZE}
						value={tailSize}
						defaultValue={BubbleStyle.tailSize}
						minimum={0}
						maximum={BubbleLimits.tailSize}
						unit={messages.UNIT_POINTS}
						onChange={(value) => {
							settings.tailSize = value;
						}}
					/>
				)}
			</ui.Section>
			{layout === BubbleLayout.dynamic ? (
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
			) : null}
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
			</ui.Section>
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
				<ui.SliderRow
					label={messages.MENTION_WIDTH}
					value={mentionWidth}
					defaultValue={BubbleStyle.mentionWidth}
					minimum={0}
					maximum={BubbleLimits.mentionWidth}
					step={MENTION_WIDTH_STEP}
					unit={messages.UNIT_POINTS}
					onChange={(value) => {
						settings.mentionWidth = value;
					}}
				/>
				<ui.SliderRow
					label={messages.MENTION_OPACITY}
					value={mentionOpacity}
					defaultValue={BubbleStyle.mentionOpacity}
					minimum={0}
					maximum={BubbleLimits.opacity}
					unit={messages.UNIT_PERCENT}
					onChange={(value) => {
						settings.mentionOpacity = value;
					}}
				/>
				<ui.SliderRow
					label={messages.MENTION_TINT}
					value={mentionTint}
					defaultValue={BubbleStyle.mentionTint}
					minimum={0}
					maximum={BubbleLimits.opacity}
					unit={messages.UNIT_PERCENT}
					onChange={(value) => {
						settings.mentionTint = value;
					}}
				/>
			</ui.Section>
			<ui.ResetRow onReset={resetSettings} />
		</ui.Page>
	);
}

export default SettingsPanel;
