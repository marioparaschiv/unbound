import { useEffect, useMemo, useState } from 'react';

import { metro, storage, toasts } from '@unbound-app/api';

import {
	applyRules,
	createRule,
	normalizeRules,
	parseRuleset,
	serializeRuleset,
	type TextReplaceRule,
	type TextReplaceRuleset,
} from '@text-replace/rules';

const STORE = storage.getStore('unbound.text-replace');

type RuleKind = 'stringRules' | 'regexRules';
type RuleField = 'find' | 'replace' | 'onlyIfIncludes';

type EditingRule = {
	kind: RuleKind;
	rule: TextReplaceRule;
	isNew: boolean;
};

type SettingsColors = {
	page: string;
	surface: string;
	surfaceAlt: string;
	input: string;
	border: string;
	text: string;
	muted: string;
	accent: string;
	accentText: string;
	danger: string;
	link: string;
};

type ClipboardApi = {
	getString?: () => string | Promise<string>;
	setString?: (value: string) => void | Promise<void>;
};

type ShareApi = {
	share?: (content: { message: string }) => void | Promise<unknown>;
};

function getRules(kind: RuleKind): TextReplaceRule[] {
	return normalizeRules(STORE.get(kind, [])).filter(
		(rule) => rule.find || rule.replace || rule.onlyIfIncludes,
	);
}

function saveRules(kind: RuleKind, rules: TextReplaceRule[]): void {
	STORE.set(kind, rules.length ? rules : [createRule()]);
}

function parseRgb(value: string): [number, number, number] | null {
	const hex = value.match(/^#([\da-f]{3}|[\da-f]{6})$/i);
	if (hex) {
		const normalized =
			hex[1].length === 3 ? hex[1].replace(/./g, (part) => `${part}${part}`) : hex[1];
		return [0, 2, 4].map((index) =>
			Number.parseInt(normalized.slice(index, index + 2), 16),
		) as [number, number, number];
	}

	const rgb = value.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
	if (!rgb) return null;

	return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
}

function getLuminance(value: string): number | null {
	const rgb = parseRgb(value);
	if (!rgb) return null;

	const channels = rgb.map((channel) => {
		const normalized = channel / 255;
		return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
	});

	return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

function getReadableText(background: string, light = '#f2f3f5', dark = '#1f2329'): string {
	const luminance = getLuminance(background);
	return luminance !== null && luminance > 0.52 ? dark : light;
}

function getThemeColor(colors: Record<string, unknown>, key: string, fallback: string): string {
	const value = colors[key];
	return typeof value === 'string' && value.trim() ? value : fallback;
}

function getColors(): SettingsColors {
	const colors = (metro.common.Theme as any)?.colors ?? {};
	const page = getThemeColor(
		colors,
		'BACKGROUND_MOBILE_PRIMARY',
		getThemeColor(colors, 'BACKGROUND_PRIMARY', '#111214'),
	);
	const surface = getThemeColor(colors, 'BACKGROUND_SECONDARY', '#1e1f22');
	const surfaceAlt = getThemeColor(colors, 'BACKGROUND_SECONDARY_ALT', '#232428');
	const input = getThemeColor(
		colors,
		'BACKGROUND_TERTIARY',
		getThemeColor(colors, 'BACKGROUND_PRIMARY', '#111214'),
	);
	const accent = getThemeColor(
		colors,
		'BUTTON_FILLED_BRAND_BACKGROUND',
		getThemeColor(colors, 'BRAND_500', '#5865f2'),
	);

	return {
		page,
		surface,
		surfaceAlt,
		input,
		border: getThemeColor(colors, 'BACKGROUND_MODIFIER_ACCENT', '#4e5058'),
		text: getReadableText(page),
		muted: getReadableText(surface, '#c8cad0', '#4f5660'),
		accent,
		accentText: getReadableText(accent),
		danger: getThemeColor(colors, 'BUTTON_DANGER_BACKGROUND', '#ed4245'),
		link: getThemeColor(colors, 'TEXT_LINK', '#00a8fc'),
	};
}

function getClipboard(): ClipboardApi | null {
	return (metro.common.Clipboard as ClipboardApi | undefined) ?? null;
}

function getShare(): ShareApi | null {
	const ReactNative = metro.common.ReactNative as { Share?: ShareApi } | undefined;
	return ReactNative?.Share ?? (metro.common as { Share?: ShareApi }).Share ?? null;
}

async function exportRuleset(
	stringRules: TextReplaceRule[],
	regexRules: TextReplaceRule[],
): Promise<void> {
	const value = serializeRuleset(stringRules, regexRules);
	const clipboard = getClipboard();
	let copied = false;

	if (typeof clipboard?.setString === 'function') {
		try {
			await clipboard.setString(value);
			copied = true;
		} catch {}
	}

	const share = getShare();
	if (typeof share?.share === 'function') {
		try {
			await share.share({ message: value });
			toasts.showToast({
				title: 'Text Replace',
				content: copied ? 'Ruleset copied and ready to share.' : 'Ruleset shared.',
			});
			return;
		} catch {}
	}

	toasts.showToast({
		title: 'Text Replace',
		content: copied
			? 'Ruleset copied to your clipboard.'
			: 'Sharing is unavailable on this client build.',
	});
}

async function readClipboard(): Promise<string | null> {
	const clipboard = getClipboard();
	if (typeof clipboard?.getString !== 'function') return null;

	try {
		const value = await clipboard.getString();
		return typeof value === 'string' ? value : null;
	} catch {
		return null;
	}
}

function RuleInput({
	label,
	value,
	placeholder,
	multiline,
	compact,
	onChange,
}: {
	label: string;
	value: string;
	placeholder: string;
	multiline?: boolean;
	compact?: boolean;
	onChange: (value: string) => void;
}) {
	const { ReactNative } = metro.common;
	const colors = getColors();

	return (
		<ReactNative.View style={{ gap: 8 }}>
			<ReactNative.Text style={{ color: colors.text, fontSize: 15, fontWeight: '700' }}>
				{label}
			</ReactNative.Text>
			<ReactNative.TextInput
				autoCapitalize='none'
				autoCorrect={false}
				multiline={multiline}
				placeholder={placeholder}
				placeholderTextColor={colors.muted}
				style={{
					backgroundColor: colors.input,
					borderColor: colors.border,
					borderRadius: 12,
					borderWidth: 1,
					color: getReadableText(colors.input),
					fontSize: compact ? 14 : 16,
					minHeight: compact ? (multiline ? 64 : 40) : multiline ? 96 : 48,
					paddingHorizontal: 14,
					paddingVertical: compact ? 8 : 12,
					textAlignVertical: multiline ? 'top' : 'center',
				}}
				value={value}
				onChangeText={onChange}
			/>
		</ReactNative.View>
	);
}

function Button({
	label,
	onPress,
	disabled,
	danger,
	secondary,
	compact,
}: {
	label: string;
	onPress: () => void;
	disabled?: boolean;
	danger?: boolean;
	secondary?: boolean;
	compact?: boolean;
}) {
	const { ReactNative } = metro.common;
	const colors = getColors();
	const backgroundColor = danger ? colors.danger : secondary ? colors.surface : colors.accent;

	return (
		<ReactNative.Pressable
			disabled={disabled}
			onPress={onPress}
			style={({ pressed }: { pressed: boolean }) => ({
				alignItems: 'center',
				backgroundColor,
				borderColor: secondary ? colors.border : backgroundColor,
				borderRadius: 12,
				borderWidth: 1,
				opacity: disabled || pressed ? 0.5 : 1,
				flex: compact ? 1 : undefined,
				paddingHorizontal: compact ? 10 : 16,
				paddingVertical: compact ? 10 : 14,
			})}
		>
			<ReactNative.Text
				style={{
					color: secondary ? colors.text : colors.accentText,
					fontSize: compact ? 14 : 16,
					fontWeight: '800',
				}}
			>
				{label}
			</ReactNative.Text>
		</ReactNative.Pressable>
	);
}

function RuleEditor({
	editing,
	onClose,
	onSave,
	onDelete,
}: {
	editing: EditingRule;
	onClose: () => void;
	onSave: (rule: TextReplaceRule) => void;
	onDelete: () => void;
}) {
	const { ReactNative } = metro.common;
	const colors = getColors();
	const [draft, setDraft] = useState(editing.rule);
	const isRegex = editing.kind === 'regexRules';

	useEffect(() => setDraft(editing.rule), [editing.rule]);

	function update(field: RuleField, value: string): void {
		setDraft((rule) => ({ ...rule, [field]: value }));
	}

	return (
		<ReactNative.ScrollView
			contentContainerStyle={{
				backgroundColor: colors.page,
				gap: 20,
				padding: 16,
				paddingBottom: 32,
			}}
		>
			<ReactNative.View style={{ gap: 8 }}>
				<ReactNative.Pressable
					onPress={onClose}
					hitSlop={8}
					style={{ alignSelf: 'flex-start', paddingVertical: 4 }}
				>
					<ReactNative.Text
						style={{ color: colors.link, fontSize: 16, fontWeight: '700' }}
					>
						‹ Back to rules
					</ReactNative.Text>
				</ReactNative.Pressable>
				<ReactNative.Text style={{ color: colors.text, fontSize: 24, fontWeight: '800' }}>
					{editing.isNew ? `New ${isRegex ? 'regex' : 'text'} rule` : 'Edit rule'}
				</ReactNative.Text>
				<ReactNative.Text style={{ color: colors.muted, fontSize: 15, lineHeight: 21 }}>
					{isRegex
						? 'Use a JavaScript pattern such as /hello/gi. Invalid patterns are skipped when sending.'
						: 'This replaces every matching piece of text before the message is sent.'}
				</ReactNative.Text>
			</ReactNative.View>
			<RuleInput
				label={isRegex ? 'Pattern' : 'Find text'}
				placeholder={isRegex ? '/pattern/gi' : 'What should change?'}
				value={draft.find}
				onChange={(value) => update('find', value)}
			/>
			<RuleInput
				label='Replace with'
				multiline
				placeholder='What should it become? Use \\n for a new line.'
				value={draft.replace}
				onChange={(value) => update('replace', value)}
			/>
			<ReactNative.View style={{ gap: 6 }}>
				<RuleInput
					label='Only when the message contains'
					placeholder='Optional condition'
					value={draft.onlyIfIncludes}
					onChange={(value) => update('onlyIfIncludes', value)}
				/>
				<ReactNative.Text style={{ color: colors.muted, fontSize: 13, lineHeight: 18 }}>
					Leave this blank to apply the rule everywhere.
				</ReactNative.Text>
			</ReactNative.View>
			<Button disabled={!draft.find.trim()} label='Save rule' onPress={() => onSave(draft)} />
			{!editing.isNew ? <Button danger label='Delete rule' onPress={onDelete} /> : null}
		</ReactNative.ScrollView>
	);
}

function RuleRow({
	rule,
	isRegex,
	onPress,
}: {
	rule: TextReplaceRule;
	isRegex: boolean;
	onPress: () => void;
}) {
	const { ReactNative } = metro.common;
	const colors = getColors();
	const condition = rule.onlyIfIncludes
		? `Only when it includes “${rule.onlyIfIncludes}”`
		: 'Applies to every message';

	return (
		<ReactNative.Pressable
			onPress={onPress}
			style={({ pressed }: { pressed: boolean }) => ({
				backgroundColor: colors.surfaceAlt,
				borderColor: colors.border,
				borderRadius: 14,
				borderWidth: 1,
				opacity: pressed ? 0.72 : 1,
				padding: 14,
			})}
		>
			<ReactNative.View style={{ alignItems: 'center', flexDirection: 'row', gap: 12 }}>
				<ReactNative.View style={{ flex: 1, gap: 4 }}>
					<ReactNative.Text
						numberOfLines={1}
						style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}
					>
						{rule.find}
					</ReactNative.Text>
					<ReactNative.Text
						numberOfLines={1}
						style={{ color: colors.text, fontSize: 14 }}
					>
						→ {rule.replace || 'Remove it'}
					</ReactNative.Text>
					<ReactNative.Text
						numberOfLines={1}
						style={{ color: colors.muted, fontSize: 13 }}
					>
						{isRegex ? 'Regex · ' : ''}
						{condition}
					</ReactNative.Text>
				</ReactNative.View>
				<ReactNative.Text style={{ color: colors.muted, fontSize: 24 }}>›</ReactNative.Text>
			</ReactNative.View>
		</ReactNative.Pressable>
	);
}

function RuleTester({
	stringRules,
	regexRules,
}: {
	stringRules: TextReplaceRule[];
	regexRules: TextReplaceRule[];
}) {
	const { ReactNative } = metro.common;
	const colors = getColors();
	const [example, setExample] = useState('');
	const output = applyRules(example, stringRules, regexRules);

	return (
		<ReactNative.View style={{ gap: 12 }}>
			<ReactNative.Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>
				Try your rules
			</ReactNative.Text>
			<RuleInput
				label='Example message'
				multiline
				placeholder='Type a message to test'
				value={example}
				onChange={setExample}
			/>
			<ReactNative.View
				style={{
					backgroundColor: colors.surfaceAlt,
					borderColor: colors.border,
					borderRadius: 14,
					borderWidth: 1,
					gap: 6,
					padding: 14,
				}}
			>
				<ReactNative.Text style={{ color: colors.muted, fontSize: 13, fontWeight: '700' }}>
					RESULT
				</ReactNative.Text>
				<ReactNative.Text style={{ color: colors.text, fontSize: 16, lineHeight: 22 }}>
					{output || 'Your transformed message will appear here.'}
				</ReactNative.Text>
			</ReactNative.View>
		</ReactNative.View>
	);
}

function RulesetTransfer({
	stringRules,
	regexRules,
	onImported,
}: {
	stringRules: TextReplaceRule[];
	regexRules: TextReplaceRule[];
	onImported: (ruleset: TextReplaceRuleset) => void;
}) {
	const { ReactNative } = metro.common;
	const colors = getColors();
	const [importText, setImportText] = useState('');

	function importValue(value: string): void {
		try {
			onImported(parseRuleset(value));
			setImportText('');
		} catch (error) {
			toasts.showToast({
				title: 'Text Replace',
				content: error instanceof Error ? error.message : 'Could not import ruleset.',
			});
		}
	}

	async function importClipboard(): Promise<void> {
		const value = await readClipboard();
		if (!value?.trim()) {
			toasts.showToast({
				title: 'Text Replace',
				content: 'Your clipboard does not contain a ruleset.',
			});
			return;
		}

		importValue(value);
	}

	return (
		<ReactNative.View
			style={{
				backgroundColor: colors.surface,
				borderColor: colors.border,
				borderRadius: 12,
				borderWidth: 1,
				gap: 8,
				padding: 10,
			}}
		>
			<ReactNative.View style={{ gap: 5 }}>
				<ReactNative.Text style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}>
					Share rules
				</ReactNative.Text>
				<ReactNative.Text style={{ color: colors.muted, fontSize: 13, lineHeight: 18 }}>
					Export or import both rule lists as portable JSON.
				</ReactNative.Text>
			</ReactNative.View>
			<ReactNative.View style={{ flexDirection: 'row', gap: 8 }}>
				<Button
					compact
					label='Export & share'
					onPress={() => void exportRuleset(stringRules, regexRules)}
				/>
				<Button
					compact
					label='Import clipboard'
					onPress={() => void importClipboard()}
					secondary
				/>
			</ReactNative.View>
			<RuleInput
				compact
				label='Paste JSON'
				multiline
				placeholder='Paste exported Text Replace JSON here'
				value={importText}
				onChange={setImportText}
			/>
			<Button
				compact
				disabled={!importText.trim()}
				label='Import pasted'
				onPress={() => importValue(importText)}
				secondary
			/>
		</ReactNative.View>
	);
}

export function TextReplaceSettingsScreen() {
	const { ReactNative } = metro.common;
	const colors = getColors();
	const [, setRevision] = useState(0);
	const [kind, setKind] = useState<RuleKind>('stringRules');
	const [editing, setEditing] = useState<EditingRule | null>(null);
	const [showTester, setShowTester] = useState(true);
	const stringRules = getRules('stringRules');
	const regexRules = getRules('regexRules');
	const rules = kind === 'stringRules' ? stringRules : regexRules;
	const isRegex = kind === 'regexRules';
	const subtitle = useMemo(
		() =>
			isRegex
				? 'Powerful pattern replacements for advanced rules.'
				: 'Simple text replacements that work as you type.',
		[isRegex],
	);

	function refresh(): void {
		setRevision((value) => value + 1);
	}

	function saveEditedRule(rule: TextReplaceRule): void {
		const currentRules = getRules(editing!.kind);
		const nextRules = editing!.isNew
			? [...currentRules, rule]
			: currentRules.map((current) => (current.id === rule.id ? rule : current));
		saveRules(editing!.kind, nextRules);
		setEditing(null);
		refresh();
	}

	function deleteEditedRule(): void {
		if (!editing) return;
		saveRules(
			editing.kind,
			getRules(editing.kind).filter((rule) => rule.id !== editing.rule.id),
		);
		setEditing(null);
		refresh();
	}

	function importRuleset(ruleset: TextReplaceRuleset): void {
		saveRules('stringRules', ruleset.stringRules);
		saveRules('regexRules', ruleset.regexRules);
		refresh();
		toasts.showToast({ title: 'Text Replace', content: 'Ruleset imported.' });
	}

	if (editing) {
		return (
			<RuleEditor
				editing={editing}
				onClose={() => setEditing(null)}
				onDelete={deleteEditedRule}
				onSave={saveEditedRule}
			/>
		);
	}

	return (
		<ReactNative.ScrollView
			contentContainerStyle={{
				backgroundColor: colors.page,
				gap: 20,
				padding: 16,
				paddingBottom: 32,
			}}
		>
			<ReactNative.View style={{ gap: 8 }}>
				<ReactNative.Text style={{ color: colors.text, fontSize: 24, fontWeight: '800' }}>
					Text Replace
				</ReactNative.Text>
				<ReactNative.Text style={{ color: colors.muted, fontSize: 15, lineHeight: 21 }}>
					Automatically rewrite messages before you send them.
				</ReactNative.Text>
			</ReactNative.View>
			<ReactNative.View style={{ gap: 10 }}>
				<ReactNative.Pressable
					onPress={() => setShowTester((value) => !value)}
					style={({ pressed }: { pressed: boolean }) => ({
						alignItems: 'center',
						flexDirection: 'row',
						justifyContent: 'space-between',
						opacity: pressed ? 0.7 : 1,
						paddingVertical: 4,
					})}
				>
					<ReactNative.Text
						style={{ color: colors.link, fontSize: 16, fontWeight: '800' }}
					>
						Test your rules
					</ReactNative.Text>
					<ReactNative.Text style={{ color: colors.link, fontSize: 20 }}>
						{showTester ? '⌃' : '⌄'}
					</ReactNative.Text>
				</ReactNative.Pressable>
				{showTester ? (
					<RuleTester regexRules={regexRules} stringRules={stringRules} />
				) : null}
			</ReactNative.View>
			<RulesetTransfer
				regexRules={regexRules}
				stringRules={stringRules}
				onImported={importRuleset}
			/>
			<ReactNative.View
				style={{
					backgroundColor: colors.surface,
					borderColor: colors.border,
					borderRadius: 14,
					borderWidth: 1,
					flexDirection: 'row',
					gap: 6,
					padding: 5,
				}}
			>
				{(
					[
						['stringRules', 'Text'],
						['regexRules', 'Regex'],
					] as [RuleKind, string][]
				).map(([candidate, label]) => (
					<ReactNative.Pressable
						key={candidate}
						onPress={() => setKind(candidate)}
						style={({ pressed }: { pressed: boolean }) => ({
							alignItems: 'center',
							backgroundColor: kind === candidate ? colors.surfaceAlt : 'transparent',
							borderRadius: 10,
							flex: 1,
							opacity: pressed ? 0.7 : 1,
							paddingVertical: 10,
						})}
					>
						<ReactNative.Text
							style={{ color: colors.text, fontSize: 15, fontWeight: '800' }}
						>
							{label}
						</ReactNative.Text>
					</ReactNative.Pressable>
				))}
			</ReactNative.View>
			<ReactNative.View style={{ gap: 8 }}>
				<ReactNative.Text style={{ color: colors.text, fontSize: 18, fontWeight: '800' }}>
					{isRegex ? 'Regex rules' : 'Text rules'} · {rules.length}
				</ReactNative.Text>
				<ReactNative.Text style={{ color: colors.muted, fontSize: 14, lineHeight: 20 }}>
					{subtitle}
				</ReactNative.Text>
			</ReactNative.View>
			{rules.length ? (
				<ReactNative.View style={{ gap: 10 }}>
					{rules.map((rule) => (
						<RuleRow
							key={rule.id}
							isRegex={isRegex}
							rule={rule}
							onPress={() => setEditing({ kind, rule, isNew: false })}
						/>
					))}
				</ReactNative.View>
			) : (
				<ReactNative.View
					style={{
						alignItems: 'center',
						backgroundColor: colors.surfaceAlt,
						borderColor: colors.border,
						borderRadius: 14,
						borderWidth: 1,
						gap: 6,
						padding: 20,
					}}
				>
					<ReactNative.Text
						style={{ color: colors.text, fontSize: 16, fontWeight: '800' }}
					>
						No rules yet
					</ReactNative.Text>
					<ReactNative.Text
						style={{ color: colors.muted, fontSize: 14, textAlign: 'center' }}
					>
						Add one when you are ready.
					</ReactNative.Text>
				</ReactNative.View>
			)}
			<Button
				label={`Add ${isRegex ? 'regex' : 'text'} rule`}
				onPress={() => setEditing({ kind, rule: createRule(), isNew: true })}
			/>
		</ReactNative.ScrollView>
	);
}
