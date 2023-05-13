export type Author = {
  name: string;
  id: `${number}`;
};

export interface Manifest {
  id: string;
  name: string;
  description: string;
  authors: Author[];
  updates: string;
  version: string;
  folder: string;
  path: string;
}

export interface Addon {
  started: boolean;
  instance: any;
  id: string;
  failed: boolean;
  data: Manifest;
}

export type Resolveable = string | Addon;