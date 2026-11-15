/** One option of Discord's link long-press sheet. */
export type SheetOption = { label: string; onPress: () => void };

/** The props Discord opens its link long-press sheet with. */
export type LinkSheetProps = { header?: { subtitle?: unknown }; options?: SheetOption[] };

/**
 * @description Reads the link a long-press sheet is for.
 * @param props The sheet's props.
 * @returns The link, or `undefined` for a sheet that is not about one.
 */
export function sheetLink(props: LinkSheetProps | undefined): string | undefined {
	const subtitle = props?.header?.subtitle;

	return typeof subtitle === 'string' && /^[a-z][a-z\d+.-]*:/i.test(subtitle)
		? subtitle
		: undefined;
}

/**
 * @description Adds an option to the sheet once.
 * @param props The sheet's props.
 * @param option The option to add.
 * @returns The props with the option last.
 */
export function withOption(props: LinkSheetProps, option: SheetOption): LinkSheetProps {
	const options = props.options ?? [];

	return options.some((existing) => existing.label === option.label)
		? props
		: { ...props, options: [...options, option] };
}
