/** A channel as the channel list hands its rows. */
export type Channel = {
	id: string;
	guild_id?: string;
	type?: number;
	nsfw?: boolean;
	isNSFW?(): boolean;
	threadMetadata?: { locked?: boolean; archived?: boolean };
};

/** A channel row's props. */
export type ChannelRowProps = { channel?: Channel };
