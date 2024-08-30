export interface FindInTreeOptions {
	ignore?: (string | symbol)[];
	walkable: (string | symbol)[];
	maxProperties?: number;
}

export type FindInTreePredicate = (element: any) => boolean;