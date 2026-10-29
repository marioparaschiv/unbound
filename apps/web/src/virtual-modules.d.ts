declare module 'virtual:addon-icon-atlas' {
	/** The URL of the content-hashed atlas holding every addon icon on one grid. */
	const url: string;

	/** Every icon a maintainer can pick, in name order, which is also atlas order. */
	export const names: string[];

	/** Icons per atlas row. */
	export const columns: number;

	/** Each icon's cell in the atlas, in icon units, gutter included. */
	export const pitch: number;

	export default url;
}
