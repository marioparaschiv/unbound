import { Project, type SourceFile } from 'ts-morph';

/**
 * The single in-memory project every parse in the generator goes through. Call sites reuse a
 * role-specific file name and overwrite it per parse, so the project never grows beyond one
 * file per role.
 */
const project = new Project({ useInMemoryFileSystem: true });

/**
 * @description Parses source text into the shared in-memory project, replacing any previous file
 * of the same name.
 * @param fileName The role-specific in-memory file name (`bundle.d.ts`, `barrel.ts`, ...).
 * @param text The source text to parse.
 * @returns The parsed source file.
 */
export function parseSource(fileName: string, text: string): SourceFile {
	return project.createSourceFile(fileName, text, { overwrite: true });
}
