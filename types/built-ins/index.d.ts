export interface BuiltInData {
	name: string;
	waitForModules?: string[];
	shouldInitialize?: boolean | (() => boolean);
	settings?: {
		monitor: string[];
	};

	[key: PropertyKey]: any;
}

export interface BuiltIn {
	start?: () => void;
	stop?: () => void;
	data: BuiltInData;
}