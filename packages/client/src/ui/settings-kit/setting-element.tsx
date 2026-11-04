import { isSnowflake, type SettingEntry } from '@unbound-app/contracts/settings-schema';
import type { SettingValue } from '@unbound-app/types/settings';
import type { ReactElement } from 'react';

import ChecklistRow from '~/ui/settings-kit/checklist-row';
import MultilineRow from '~/ui/settings-kit/multiline-row';
import SegmentedRow from '~/ui/settings-kit/segmented-row';
import CheckboxRow from '~/ui/settings-kit/checkbox-row';
import DurationRow from '~/ui/settings-kit/duration-row';
import PaletteRow from '~/ui/settings-kit/palette-row';
import StepperRow from '~/ui/settings-kit/stepper-row';
import EntityRow from '~/ui/settings-kit/entity-row';
import NumberRow from '~/ui/settings-kit/number-row';
import PickerRow from '~/ui/settings-kit/picker-row';
import SecretRow from '~/ui/settings-kit/secret-row';
import SliderRow from '~/ui/settings-kit/slider-row';
import SwitchRow from '~/ui/settings-kit/switch-row';
import ColorRow from '~/ui/settings-kit/color-row';
import InputRow from '~/ui/settings-kit/input-row';
import RadioRow from '~/ui/settings-kit/radio-row';
import ListRow from '~/ui/settings-kit/list-row';
import UrlRow from '~/ui/settings-kit/url-row';
import { format, messages } from '~/i18n/api';

/** What {@link settingElement} draws one setting from. */
export type SettingElementOptions = {
	entry: SettingEntry;
	/** The setting's current value. */
	value: SettingValue;
	/** Draws the row disabled. */
	disabled?: boolean;
	/** Saves a new value. */
	onChange: (value: SettingValue) => void;
	/** Reads a message key of the plugin's strings. */
	translate: (key: string) => string;
};

function validateId(text: string): string | undefined {
	return isSnowflake(text) ? undefined : messages.UNBOUND_SETTING_NOT_AN_ID;
}

function asStrings(value: SettingValue): string[] {
	return Array.isArray(value) ? value : [];
}

/**
 * @description Picks the settings-kit row a setting renders as, by its primitive and `displayAs`: the table of the plugin settings docs.
 * @param options The setting, its value, its change handler and the plugin's message lookup.
 * @returns The row.
 */
export function settingElement({
	entry: { path, field },
	value,
	disabled = false,
	onChange,
	translate,
}: SettingElementOptions): ReactElement {
	const label = field.title === undefined ? path : translate(field.title);
	const subLabel = field.subtitle === undefined ? undefined : translate(field.subtitle);
	const shared = { label, subLabel, disabled };

	switch (field.kind) {
		case 'boolean':
			return field.displayAs === 'checkbox' ? (
				<CheckboxRow
					key={path}
					{...shared}
					value={value === true}
					onValueChange={onChange}
				/>
			) : (
				<SwitchRow
					key={path}
					label={label}
					subLabel={subLabel}
					disabled={disabled}
					value={value === true}
					onValueChange={(next: boolean) => onChange(next)}
				/>
			);
		case 'number':
		case 'integer': {
			const number = Number(value);
			const range = { minimum: field.minimum, maximum: field.maximum };

			switch (field.displayAs) {
				case 'slider':
					return (
						<SliderRow
							key={path}
							label={label}
							subLabel={subLabel}
							value={number}
							defaultValue={field.default}
							minimum={field.minimum ?? 0}
							maximum={field.maximum ?? 0}
							step={field.multipleOf ?? 1}
							onChange={onChange}
						/>
					);
				case 'stepper':
					return (
						<StepperRow
							key={path}
							{...shared}
							{...range}
							value={number}
							step={field.multipleOf}
							onChange={onChange}
						/>
					);
				case 'duration':
					return (
						<DurationRow
							key={path}
							{...shared}
							{...range}
							value={number}
							units={field.units}
							onChange={onChange}
						/>
					);
				default:
					return (
						<NumberRow
							key={path}
							{...shared}
							{...range}
							integer={field.kind === 'integer'}
							step={field.multipleOf}
							value={number}
							onChange={onChange}
						/>
					);
			}
		}
		case 'string': {
			const text = String(value);
			const placeholder =
				field.placeholder === undefined ? undefined : translate(field.placeholder);
			const minLength = field.minLength ?? 0;
			const validate = (typed: string) =>
				typed.length < minLength
					? format('UNBOUND_SETTING_TOO_SHORT', { minLength })
					: undefined;

			switch (field.displayAs) {
				case 'multiline':
					return (
						<MultilineRow
							key={path}
							{...shared}
							value={text}
							placeholder={placeholder}
							maxLength={field.maxLength}
							validate={validate}
							onChange={onChange}
						/>
					);
				case 'secret':
					return (
						<SecretRow
							key={path}
							{...shared}
							value={text}
							placeholder={placeholder}
							onChange={onChange}
						/>
					);
				case 'url':
					return (
						<UrlRow
							key={path}
							{...shared}
							value={text}
							placeholder={placeholder}
							onChange={onChange}
						/>
					);
				case 'color':
					return field.palette && field.presets ? (
						<PaletteRow
							key={path}
							{...shared}
							value={text}
							presets={field.presets}
							onChange={onChange}
						/>
					) : (
						<ColorRow
							key={path}
							label={label}
							color={text === field.default ? undefined : text}
							fallbackColor={field.default}
							fallbackLabel={subLabel ?? messages.UNBOUND_DEFAULT}
							onChange={(color) => onChange(color ?? field.default)}
						/>
					);
				case 'user':
				case 'channel':
				case 'guild':
				case 'role':
					return (
						<EntityRow
							key={path}
							entity={field.displayAs}
							label={label}
							value={text}
							disabled={disabled}
							onChange={onChange}
						/>
					);
				default:
					return (
						<InputRow
							key={path}
							{...shared}
							value={text}
							placeholder={placeholder}
							maxLength={field.maxLength}
							validate={validate}
							onChange={onChange}
						/>
					);
			}
		}
		case 'choice': {
			const options = field.options.map((choice) => ({
				value: choice.const,
				label: translate(choice.title),
				subLabel: choice.subtitle === undefined ? undefined : translate(choice.subtitle),
			}));

			if (field.displayAs === 'picker') {
				return (
					<PickerRow
						key={path}
						{...shared}
						value={String(value)}
						options={options}
						onChange={onChange}
					/>
				);
			}

			if (field.displayAs === 'segmented') {
				return (
					<SegmentedRow
						key={path}
						{...shared}
						value={String(value)}
						options={options}
						onChange={onChange}
					/>
				);
			}

			return (
				<RadioRow
					key={path}
					title={label}
					description={subLabel}
					value={String(value)}
					options={options}
					disabled={disabled}
					onChange={onChange}
				/>
			);
		}
		case 'array': {
			const list = asStrings(value);
			const { of } = field;

			if (of.kind === 'choice') {
				const options = of.options.map((choice) => ({
					value: choice.const,
					label: translate(choice.title),
				}));

				return (
					<ChecklistRow
						key={path}
						title={label}
						description={subLabel}
						value={list}
						options={options}
						maxItems={field.maxItems}
						disabled={disabled}
						onChange={onChange}
					/>
				);
			}

			return (
				<ListRow
					key={path}
					title={label}
					description={subLabel}
					value={list}
					maxItems={field.maxItems}
					validate={field.displayAs === 'list' ? undefined : validateId}
					disabled={disabled}
					onChange={onChange}
				/>
			);
		}
	}
}

export default { settingElement };
