export interface FindInTreeOptions {
	ignore?: string[];
	walkable: string[];
	maxProperties?: number;
}

export type FindInTreePredicate = (element: any) => boolean;