/** The Unbound account signed in on this device. */
export type Account = {
	/** The account's id on Unbound's servers. */
	id: string;
	/** The account's display name, refreshed from Unbound's servers at each launch. */
	name: string;
	/** The account's avatar image URL, or `null` when it has none. */
	image: string | null;
};
