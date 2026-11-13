//! Files mode: every loaded module under the source path Discord's import tracker reported, as a
//! folder tree. A module reports its path only as it loads, so the tree fills in with Load All.
//! Folders with one subfolder and no files merge into one row, as code editors show them.

use std::collections::{BTreeMap, HashSet};
use std::rc::Rc;

use gpui::{AnyElement, Context, Div, SharedString, Stateful, div, prelude::*, px};
use unbound_devtools_core::{FilesPage, MetroError, MetroFile, MetroModule, MetroModuleStatus};

use super::unfold::{Fold, Turn};
use super::{MetroBrowser, Row, cancelled};
use crate::app::on_runtime;
use crate::theme;
use crate::widgets::{badge, turning_chevron};

/// Each folder level indents by this much.
const LEVEL: f32 = 14.;

/// A folder: its subfolders by name, its files, and how many files it holds at any depth.
#[derive(Default)]
struct Folder {
	folders: BTreeMap<String, Folder>,
	files: Vec<(String, u32)>,
	count: u32,
}

impl Folder {
	/// The tree of `files` whose path contains `needle` (lower-cased; empty keeps all).
	fn build(files: &[MetroFile], needle: &str) -> Self {
		let mut root = Self::default();
		for file in files {
			if !needle.is_empty() && !file.path.to_lowercase().contains(needle) {
				continue;
			}
			let mut parts: Vec<&str> = file
				.path
				.split('/')
				.filter(|part| !part.is_empty() && *part != ".")
				.collect();
			let Some(name) = parts.pop() else {
				continue;
			};
			let mut folder = &mut root;
			folder.count += 1;
			for part in parts {
				folder = folder.folders.entry(part.to_owned()).or_default();
				folder.count += 1;
			}
			folder.files.push((name.to_owned(), file.id));
		}
		root
	}
}

impl FileRow {
	fn path(&self) -> &Rc<str> {
		match self {
			Self::Folder { path, .. } | Self::File { path, .. } => path,
		}
	}
}

/// One line of the file tree.
#[derive(Clone)]
pub(super) enum FileRow {
	Folder {
		path: Rc<str>,
		name: SharedString,
		depth: u32,
		open: bool,
		count: u32,
	},
	File {
		id: u32,
		path: Rc<str>,
		name: SharedString,
		depth: u32,
	},
}

/// The rows of `root`. A folder is open when the filter opens all of them, flipped by `toggled`.
fn rows(root: &Folder, all_open: bool, toggled: &HashSet<Rc<str>>) -> Vec<FileRow> {
	let mut rows = Vec::new();
	walk(root, "", 0, all_open, toggled, &mut rows);
	rows
}

fn walk(
	folder: &Folder,
	prefix: &str,
	depth: u32,
	all_open: bool,
	toggled: &HashSet<Rc<str>>,
	rows: &mut Vec<FileRow>,
) {
	// A lone top folder such as `modules` opens by itself, so the tree never starts as one row.
	let lone = depth == 0 && folder.files.is_empty() && folder.folders.len() == 1;
	for (name, mut child) in &folder.folders {
		let mut name = name.clone();
		while child.files.is_empty() && child.folders.len() == 1 {
			let (inner, grandchild) = child.folders.iter().next().expect("one subfolder");
			name = format!("{name}/{inner}");
			child = grandchild;
		}
		let path: Rc<str> = format!("{prefix}{name}").into();
		let open = (all_open || lone) != toggled.contains(&path);
		rows.push(FileRow::Folder {
			path: path.clone(),
			name: name.into(),
			depth,
			open,
			count: child.count,
		});
		if open {
			walk(
				child,
				&format!("{path}/"),
				depth + 1,
				all_open,
				toggled,
				rows,
			);
		}
	}
	for (name, id) in &folder.files {
		rows.push(FileRow::File {
			id: *id,
			path: format!("{prefix}{name}").into(),
			name: name.clone().into(),
			depth,
		});
	}
}

/// The file list, its tree under the current filter, and the rows on screen.
pub(super) struct Files {
	page: Option<FilesPage>,
	root: Folder,
	/// Folders opened, or closed while a filter opens them all.
	toggled: HashSet<Rc<str>>,
	needle: String,
	pub rows: Vec<FileRow>,
	pub error: Option<MetroError>,
	/// The last folder opened or closed, and its rows while they fold.
	turn: Option<Turn<Rc<str>>>,
	pub fold: Option<Fold>,
}

impl Files {
	fn refilter(&mut self, query: &str) {
		let needle = query.to_lowercase();
		if needle != self.needle {
			self.toggled.clear();
			self.needle = needle;
		}
		let files = self.page.as_ref().map_or(&[][..], |page| &page.files);
		self.root = Folder::build(files, &self.needle);
		self.rebuild();
	}

	fn rebuild(&mut self) {
		self.rows = rows(&self.root, !self.needle.is_empty(), &self.toggled);
		self.turn = None;
		self.fold = None;
	}

	/// Whether a folder's chevron or rows are still moving.
	pub fn moving(&self) -> bool {
		self.turn.as_ref().is_some_and(Turn::moving) || self.fold.is_some()
	}

	/// Moves the fold on a frame, or ends it once finished, dropping a closed folder's rows. Returns
	/// whether the rows changed.
	pub fn settle(&mut self) -> bool {
		match &mut self.fold {
			Some(fold) if fold.done() && fold.opening() => {
				self.fold = None;
				false
			}
			Some(fold) if fold.done() => {
				self.rebuild();
				true
			}
			Some(fold) => {
				fold.tick();
				false
			}
			None => false,
		}
	}

	/// How many files match, once the list has arrived.
	pub fn shown(&self) -> Option<u32> {
		self.page.as_ref().map(|_| self.root.count)
	}
}

impl MetroBrowser {
	/// Fetches the file list again, keeping which folders are open.
	pub(super) fn fetch_files(&mut self, cx: &mut Context<Self>) {
		self.epoch += 1;
		let files = self.files.get_or_insert_with(|| Files {
			page: None,
			root: Folder::default(),
			toggled: HashSet::new(),
			needle: String::new(),
			rows: Vec::new(),
			error: None,
			turn: None,
			fold: None,
		});
		files.error = None;
		let epoch = self.epoch;
		let request = on_runtime(&self.devtools, {
			let devtools = self.devtools.clone();
			async move { devtools.metro_files().await }
		});
		cx.spawn(async move |this, cx| {
			let result = request.await.unwrap_or_else(|| Err(cancelled()));
			this.update(cx, |this, cx| {
				if this.epoch == epoch {
					this.settle_files(result, cx);
				}
			})
			.ok();
		})
		.detach();
		self.rebuild_rows();
		cx.notify();
	}

	fn settle_files(&mut self, result: Result<FilesPage, MetroError>, cx: &mut Context<Self>) {
		let Some(files) = &mut self.files else {
			return;
		};
		match result {
			Ok(page) => {
				files.page = Some(page);
				files.refilter(&self.query);
			}
			Err(error) => {
				tracing::warn!("Failed to list the Metro module files: {error}");
				files.error = Some(error);
			}
		}
		self.rebuild_rows();
		cx.notify();
	}

	/// Applies the filter to the list already fetched, or fetches it the first time.
	pub(super) fn filter_files(&mut self, cx: &mut Context<Self>) {
		match &mut self.files {
			Some(files) if files.page.is_some() => {
				files.refilter(&self.query);
				self.rebuild_rows();
				cx.notify();
			}
			_ => self.fetch_files(cx),
		}
	}

	fn toggle_folder(&mut self, path: Rc<str>, cx: &mut Context<Self>) {
		let Some(files) = &mut self.files else {
			return;
		};
		if !files.toggled.remove(&path) {
			files.toggled.insert(path.clone());
		}
		let next = rows(&files.root, !files.needle.is_empty(), &files.toggled);
		if cx.reduce_motion() {
			files.rebuild();
		} else {
			let open = next.iter().any(
				|row| matches!(row, FileRow::Folder { path: row_path, open: true, .. } if *row_path == path),
			);
			let keys = |rows: &[FileRow]| -> Vec<Option<Rc<str>>> {
				rows.iter().map(|row| Some(Rc::clone(row.path()))).collect()
			};
			let (old, new) = (keys(&files.rows), keys(&next));
			// An open grows into the new rows; a close shrinks the old ones, then `settle` drops them.
			if open {
				files.fold = Fold::between(old, new, true);
				files.rows = next;
			} else {
				files.fold = Fold::between(new, old, false);
				if files.fold.is_none() {
					files.rows = next;
				}
			}
			files.turn = Some(Turn::new(path, open));
		}
		self.rebuild_rows();
		cx.notify();
	}

	/// The list rows in Files mode.
	pub(super) fn file_rows(&self) -> Vec<Row> {
		let Some(files) = &self.files else {
			return Vec::new();
		};
		let Some(page) = &files.page else {
			return vec![match &files.error {
				Some(error) => Row::Note(error.to_string().into(), true),
				None => Row::Note("Loading…".into(), false),
			}];
		};
		let mut rows: Vec<Row> = (0..files.rows.len()).map(Row::File).collect();
		if rows.is_empty() {
			rows.push(Row::Note("Nothing Matches".into(), false));
		}
		if page.unloaded > 0 {
			rows.push(Row::Note(
				format!(
					"{} Modules Not Loaded · Load All to Fill the Tree",
					page.unloaded
				)
				.into(),
				false,
			));
		}
		rows
	}

	/// Draws file-tree row `ix` into `row`, the list's row shell.
	pub(super) fn render_file_row(
		&self,
		ix: usize,
		row: Stateful<Div>,
		cx: &mut Context<Self>,
	) -> Option<AnyElement> {
		let files = self.files.as_ref()?;
		let file = files.rows.get(ix)?.clone();
		let turn = files.turn.as_ref().and_then(|turn| turn.of(file.path()));
		let row = row
			.cursor_pointer()
			.hover(|row| row.bg(theme::color(theme::HOVER)));
		let indent = |depth: u32| px(theme::INSET + depth as f32 * LEVEL);
		Some(match file {
			FileRow::Folder {
				path,
				name,
				depth,
				open,
				count,
			} => row
				.pl(indent(depth))
				.child(
					div()
						.flex_none()
						.w(px(theme::CHEVRON_SLOT))
						.flex()
						.justify_center()
						.child(turning_chevron(turn.unwrap_or(if open { 1. } else { 0. }))),
				)
				.child(
					div()
						.flex_1()
						.min_w_0()
						.truncate()
						.text_color(theme::color(theme::TEXT_SECONDARY))
						.child(name),
				)
				.child(badge(count.to_string(), theme::TEXT_MUTED))
				.on_click(cx.listener(move |this, _, _, cx| this.toggle_folder(path.clone(), cx)))
				.into_any_element(),
			FileRow::File {
				id,
				path,
				name,
				depth,
			} => {
				let selected = self
					.picked
					.as_ref()
					.is_some_and(|picked| picked.module.id == id);
				row.pl(indent(depth) + px(theme::CHEVRON_SLOT))
					.when(selected, |row| row.bg(theme::accent_soft()))
					.child(
						div()
							.flex_1()
							.min_w_0()
							.truncate()
							.text_color(theme::color(theme::SYN_COMPONENT))
							.child(name),
					)
					.child(
						div()
							.flex_none()
							.text_color(theme::color(theme::TEXT_FAINT))
							.child(id.to_string()),
					)
					.on_click(cx.listener(move |this, _, _, cx| {
						let module = MetroModule {
							id,
							status: MetroModuleStatus::Loaded,
							label: Some(path.to_string()),
						};
						this.pick(module, cx);
					}))
					.into_any_element()
			}
		})
	}
}

#[cfg(test)]
mod tests {
	use super::*;

	fn file(id: u32, path: &str) -> MetroFile {
		MetroFile {
			id,
			path: path.into(),
		}
	}

	fn names(rows: &[FileRow]) -> Vec<String> {
		rows.iter()
			.map(|row| match row {
				FileRow::Folder {
					name, depth, open, ..
				} => format!("{depth}{}{name}/", if *open { "-" } else { "+" }),
				FileRow::File { name, depth, .. } => format!("{depth} {name}"),
			})
			.collect()
	}

	#[test]
	fn single_child_folders_merge_and_open_on_toggle() {
		let files = [
			file(1, "modules/user/native/Profile.tsx"),
			file(2, "modules/user/native/Store.tsx"),
			file(3, "modules/voice/Panel.tsx"),
			file(4, "index.tsx"),
		];
		let root = Folder::build(&files, "");
		assert_eq!(
			names(&rows(&root, false, &HashSet::new())),
			["0+modules/", "0 index.tsx"]
		);

		let toggled = HashSet::from([Rc::from("modules"), Rc::from("modules/user/native")]);
		assert_eq!(
			names(&rows(&root, false, &toggled)),
			[
				"0-modules/",
				"1-user/native/",
				"2 Profile.tsx",
				"2 Store.tsx",
				"1+voice/",
				"0 index.tsx"
			]
		);
	}

	#[test]
	fn a_lone_top_folder_and_a_filter_s_folders_start_open() {
		let root = Folder::build(&[file(1, "modules/a/B.tsx")], "");
		assert_eq!(
			names(&rows(&root, false, &HashSet::new())),
			["0-modules/a/", "1 B.tsx"]
		);

		let files = [file(1, "a/Store.tsx"), file(2, "b/View.tsx")];
		let root = Folder::build(&files, "store");
		assert_eq!(root.count, 1);
		assert_eq!(
			names(&rows(&root, true, &HashSet::new())),
			["0-a/", "1 Store.tsx"]
		);
	}
}
