//! The Metro page: every module in the device's Metro registry, filtered by id or label and by
//! status, beside the exports of the one picked as a tree. A module that has not loaded has a Load
//! button, and Load All runs the rest in batches; the tree fetches one value's children a page at a
//! time and runs getters only on click. Keys mode searches the loaded exports' keys instead.

mod files;
mod list;
mod load_all;
mod pane;
mod reveal;
mod search;
mod tree;
mod unfold;

use std::rc::Rc;
use std::time::Duration;

use gpui::{AppContext, Context, Entity, Task, UniformListScrollHandle, Window};
use gpui_component::input::{InputEvent, InputState};
use unbound_devtools_core::{
	Devtools, LoadedModule, MetroError, MetroErrorCode, MetroModule, MetroModuleStatus,
	MetroTarget, ModulesPage,
};

use crate::app::on_runtime;
use crate::smooth_scroll::GlideTo;
use files::Files;
use load_all::LoadAll;
use reveal::{Flash, Reveal};
use search::KeySearch;
use tree::{Fetch, Node, Path, Row as TreeRow};
use unfold::{Fold, Turn};

const CHANGE_COALESCING_FRAME: Duration = Duration::from_millis(16);
const FILTER_DEBOUNCE: Duration = Duration::from_millis(150);

/// The modules matching the filter, as far as the device has answered.
struct Listing {
	modules: Vec<MetroModule>,
	total: u32,
	/// The first page failed.
	error: Option<MetroError>,
	/// The next page, while it loads (`Ok`) or after it failed.
	next: Option<Result<(), MetroError>>,
	loading: bool,
}

/// What the filter searches: module ids and labels, or the keys under the loaded modules' exports.
#[derive(Clone, Copy, PartialEq, Eq)]
enum Mode {
	Modules,
	Keys,
	Files,
}

impl Mode {
	const ALL: [Self; 3] = [Self::Modules, Self::Keys, Self::Files];

	fn label(self) -> &'static str {
		match self {
			Self::Modules => "Modules",
			Self::Keys => "Keys",
			Self::Files => "Files",
		}
	}

	fn placeholder(self) -> &'static str {
		match self {
			Self::Modules => "Filter by id, path or export name",
			Self::Keys => "Search keys, methods and function names",
			Self::Files => "Filter by file path",
		}
	}
}

#[derive(Clone)]
enum Row {
	Module(usize),
	Match(usize),
	File(usize),
	Note(gpui::SharedString, bool),
	More,
	SearchMore,
}

/// The picked module's exports, or why they are not shown.
enum Exports {
	Loading,
	Failed(MetroError),
	Loaded(Node),
}

/// The module on the right and its tree.
struct Picked {
	/// Kept here, so the pane still shows it once a new filter drops its row.
	module: MetroModule,
	/// The path of the search match picked, whose row the tree opens to.
	target: Option<Vec<String>>,
	/// Opening the tree down to `target`, a step per answer.
	reveal: Option<Reveal>,
	/// The row the reveal ended on, which flickers once and stays highlighted.
	flash: Option<Flash>,
	exports: Exports,
	rows: Rc<Vec<TreeRow>>,
	/// The last value opened or closed, and its children's rows while they fold.
	turn: Option<Turn<Path>>,
	fold: Option<Fold>,
}

impl Picked {
	/// Whether a value's chevron or rows are still moving.
	fn moving(&self) -> bool {
		self.turn.as_ref().is_some_and(Turn::moving) || self.fold.is_some()
	}
}

pub struct MetroBrowser {
	devtools: Devtools,
	connected: bool,
	opened: bool,
	search: Entity<InputState>,
	query: String,
	mode: Mode,
	keys: Option<KeySearch>,
	files: Option<Files>,
	load_all: Option<LoadAll>,
	/// How the last Load All ended.
	load_note: Option<String>,
	status: Option<MetroModuleStatus>,
	listing: Option<Listing>,
	/// How many modules have loaded, of how many in all.
	counts: Option<(u32, u32)>,
	rows: Rc<Vec<Row>>,
	scroll: UniformListScrollHandle,
	/// Modules whose Load is running.
	loading: Vec<u32>,
	picked: Option<Picked>,
	tree_scroll: UniformListScrollHandle,
	/// The tree's glide to the revealed row; its token grows with each reveal.
	tree_glide: Option<GlideTo>,
	/// Bumped when the listing starts over or the picked module changes; older answers are dropped.
	epoch: u64,
	tree_epoch: u64,
	search_task: Option<Task<()>>,
	_watch: Task<()>,
}

fn is_connected(devtools: &Devtools) -> bool {
	devtools
		.status()
		.link
		.is_some_and(|link| link.device.is_some())
}

fn tree_rows(exports: &Exports) -> Vec<TreeRow> {
	match exports {
		Exports::Loaded(root) => tree::rows(root),
		_ => Vec::new(),
	}
}

fn cancelled() -> MetroError {
	MetroError::Device {
		code: MetroErrorCode::Failed,
		message: "The request was cancelled.".into(),
	}
}

impl MetroBrowser {
	pub fn new(devtools: Devtools, window: &mut Window, cx: &mut Context<Self>) -> Self {
		let search =
			cx.new(|cx| InputState::new(window, cx).placeholder(Mode::Modules.placeholder()));
		cx.subscribe(&search, |this, _, event: &InputEvent, cx| {
			if let InputEvent::Change = event {
				this.search_typed(cx);
			}
		})
		.detach();
		let watch = cx.spawn({
			let mut changes = devtools.changes();
			async move |this, cx| {
				while changes.changed().await.is_ok() {
					changes.borrow_and_update();
					if this.update(cx, |this, cx| this.status_changed(cx)).is_err() {
						break;
					}
					cx.background_executor()
						.timer(CHANGE_COALESCING_FRAME)
						.await;
				}
			}
		});
		Self {
			connected: is_connected(&devtools),
			devtools,
			opened: false,
			search,
			query: String::new(),
			mode: Mode::Modules,
			keys: None,
			files: None,
			load_all: None,
			load_note: None,
			status: None,
			listing: None,
			counts: None,
			rows: Rc::default(),
			scroll: UniformListScrollHandle::new(),
			loading: Vec::new(),
			picked: None,
			tree_scroll: UniformListScrollHandle::new(),
			tree_glide: None,
			epoch: 0,
			tree_epoch: 0,
			search_task: None,
			_watch: watch,
		}
	}

	/// Lists the modules the first time the page shows.
	pub fn open(&mut self, cx: &mut Context<Self>) {
		self.opened = true;
		if self.connected && self.listing.is_none() {
			self.list(0, cx);
		}
	}

	fn status_changed(&mut self, cx: &mut Context<Self>) {
		let connected = is_connected(&self.devtools);
		if connected == self.connected {
			return;
		}
		self.connected = connected;
		// Refs end with the device's session, so the tree goes with it.
		self.listing = None;
		self.keys = None;
		self.files = None;
		self.load_all = None;
		self.counts = None;
		self.picked = None;
		self.loading.clear();
		self.epoch += 1;
		self.tree_epoch += 1;
		if connected && self.opened {
			self.refresh(cx);
		}
		self.rebuild_rows();
		cx.notify();
	}

	fn search_typed(&mut self, cx: &mut Context<Self>) {
		let text = self.search.read(cx).value().trim().to_owned();
		self.search_task = Some(cx.spawn(async move |this, cx| {
			cx.background_executor().timer(FILTER_DEBOUNCE).await;
			this.update(cx, |this, cx| {
				if this.query != text {
					this.query = text;
					this.refresh(cx);
				}
			})
			.ok();
		}));
	}

	/// Starts the current mode's listing or search over.
	fn refresh(&mut self, cx: &mut Context<Self>) {
		match self.mode {
			Mode::Modules => self.list(0, cx),
			Mode::Keys => self.search_keys(false, cx),
			Mode::Files => self.filter_files(cx),
		}
	}

	fn set_mode(&mut self, mode: Mode, window: &mut Window, cx: &mut Context<Self>) {
		if self.mode == mode {
			return;
		}
		self.mode = mode;
		self.search.update(cx, |search, cx| {
			search.set_placeholder(mode.placeholder(), window, cx);
		});
		self.refresh(cx);
	}

	fn set_status(&mut self, status: Option<MetroModuleStatus>, cx: &mut Context<Self>) {
		if self.status != status {
			self.status = status;
			self.list(0, cx);
		}
	}

	/// Lists a page of modules from `offset`; `0` starts the listing over.
	fn list(&mut self, offset: u32, cx: &mut Context<Self>) {
		if offset == 0 {
			self.epoch += 1;
			self.listing = Some(Listing {
				modules: Vec::new(),
				total: 0,
				error: None,
				next: None,
				loading: true,
			});
		} else if let Some(listing) = &mut self.listing {
			listing.next = Some(Ok(()));
		}
		let epoch = self.epoch;
		let (query, status) = (self.query.clone(), self.status);
		let request = on_runtime(&self.devtools, {
			let devtools = self.devtools.clone();
			async move { devtools.metro_modules(&query, status, offset).await }
		});
		cx.spawn(async move |this, cx| {
			let result = request.await.unwrap_or_else(|| Err(cancelled()));
			this.update(cx, |this, cx| {
				if this.epoch == epoch {
					this.settle_list(result, cx);
				}
			})
			.ok();
		})
		.detach();
		self.rebuild_rows();
		cx.notify();
	}

	fn settle_list(&mut self, result: Result<ModulesPage, MetroError>, cx: &mut Context<Self>) {
		let Some(listing) = &mut self.listing else {
			return;
		};
		match result {
			Ok(page) => {
				listing.modules.extend(page.modules);
				listing.total = page.total;
				listing.next = None;
				self.counts = Some((page.loaded, page.count));
			}
			Err(error) if listing.loading => {
				tracing::warn!("Failed to list the Metro modules: {error}");
				listing.error = Some(error);
			}
			Err(error) => listing.next = Some(Err(error)),
		}
		listing.loading = false;
		self.rebuild_rows();
		cx.notify();
	}

	fn rebuild_rows(&mut self) {
		match self.mode {
			Mode::Keys => return self.rows = Rc::new(self.key_rows()),
			Mode::Files => return self.rows = Rc::new(self.file_rows()),
			Mode::Modules => {}
		}
		let mut rows = Vec::new();
		match &self.listing {
			Some(listing) if listing.loading => rows.push(Row::Note("Loading…".into(), false)),
			Some(Listing {
				error: Some(error), ..
			}) => rows.push(Row::Note(error.to_string().into(), true)),
			Some(listing) => {
				rows.extend((0..listing.modules.len()).map(Row::Module));
				if (listing.modules.len() as u32) < listing.total || listing.next.is_some() {
					rows.push(Row::More);
				}
				if listing.modules.is_empty() {
					rows.push(Row::Note("Nothing Matches".into(), false));
				}
			}
			None => {}
		}
		self.rows = Rc::new(rows);
	}

	/// Shows `module` on the right: its exports when it has loaded, else its Load button.
	fn pick(&mut self, module: MetroModule, cx: &mut Context<Self>) {
		self.tree_epoch += 1;
		let loaded = module.status == MetroModuleStatus::Loaded;
		self.picked = Some(Picked {
			module,
			target: None,
			reveal: None,
			flash: None,
			exports: Exports::Loading,
			rows: Rc::default(),
			turn: None,
			fold: None,
		});
		self.tree_scroll = UniformListScrollHandle::new();
		if loaded {
			self.fetch_exports(cx);
		}
		cx.notify();
	}

	fn fetch_exports(&mut self, cx: &mut Context<Self>) {
		let Some(picked) = &mut self.picked else {
			return;
		};
		picked.exports = Exports::Loading;
		let (id, epoch) = (picked.module.id, self.tree_epoch);
		let request = on_runtime(&self.devtools, {
			let devtools = self.devtools.clone();
			async move { devtools.metro_children(&MetroTarget::Module(id), 0).await }
		});
		cx.spawn(async move |this, cx| {
			let result = request.await.unwrap_or_else(|| Err(cancelled()));
			this.update(cx, |this, cx| {
				if this.tree_epoch != epoch {
					return;
				}
				let Some(picked) = this.picked.as_mut() else {
					return;
				};
				picked.exports = match result {
					Ok(page) => {
						let mut root = Node::new(page.value.clone());
						root.expanded = true;
						root.add_page(page, true);
						Exports::Loaded(root)
					}
					Err(error) => Exports::Failed(error),
				};
				this.rebuild_tree();
				this.advance_reveal(cx);
				cx.notify();
			})
			.ok();
		})
		.detach();
	}

	/// Runs module `id`'s factory, then updates its row and, when it is picked, shows its exports.
	fn load(&mut self, id: u32, cx: &mut Context<Self>) {
		if self.loading.contains(&id) {
			return;
		}
		self.loading.push(id);
		if let Some(picked) = self.picked.as_mut().filter(|picked| picked.module.id == id) {
			picked.exports = Exports::Loading;
		}
		let request = on_runtime(&self.devtools, {
			let devtools = self.devtools.clone();
			async move { devtools.metro_load(id).await }
		});
		cx.spawn(async move |this, cx| {
			let result = request.await.unwrap_or_else(|| Err(cancelled()));
			this.update(cx, |this, cx| this.settle_load(id, result, cx))
				.ok();
		})
		.detach();
		cx.notify();
	}

	fn settle_load(
		&mut self,
		id: u32,
		result: Result<LoadedModule, MetroError>,
		cx: &mut Context<Self>,
	) {
		self.loading.retain(|loading| *loading != id);
		let picked = self.picked.as_mut().filter(|picked| picked.module.id == id);
		match result {
			Ok(loaded) => {
				if let Some((count_loaded, _)) = &mut self.counts {
					*count_loaded = loaded.loaded;
				}
				if let Some(module) = self
					.listing
					.as_mut()
					.and_then(|listing| listing.modules.iter_mut().find(|module| module.id == id))
				{
					*module = loaded.module.clone();
				}
				if let Some(picked) = picked {
					picked.module = loaded.module;
					if picked.module.status == MetroModuleStatus::Loaded {
						self.fetch_exports(cx);
					}
				}
			}
			Err(error) => {
				tracing::warn!("Failed to load Metro module {id}: {error}");
				if let Some(picked) = picked {
					picked.exports = Exports::Failed(error);
				}
			}
		}
		cx.notify();
	}

	fn rebuild_tree(&mut self) {
		if let Some(picked) = &mut self.picked {
			picked.rows = Rc::new(tree_rows(&picked.exports));
			picked.turn = None;
			picked.fold = None;
		}
	}

	/// Rebuilds the tree, folding the rows it gained in, or the rows it lost out before dropping them.
	fn unfold_tree(&mut self, cx: &mut Context<Self>) {
		let Some(picked) = self.picked.as_mut().filter(|_| !cx.reduce_motion()) else {
			return self.rebuild_tree();
		};
		let next = tree_rows(&picked.exports);
		let keys = |rows: &[TreeRow]| -> Vec<Option<Path>> {
			rows.iter().map(|row| row.key().cloned()).collect()
		};
		let (old, new) = (keys(&picked.rows), keys(&next));
		let turn = picked.turn.take();
		if let Some(fold) = Fold::between(old.iter().cloned(), new.iter().cloned(), true) {
			picked.rows = Rc::new(next);
			picked.fold = Some(fold);
		} else if let Some(fold) = Fold::between(new, old, false) {
			picked.fold = Some(fold);
		} else {
			picked.rows = Rc::new(next);
			picked.fold = None;
		}
		picked.turn = turn;
	}

	/// Moves the folds on a frame, or ends those that finished, dropping the rows a close folded away.
	fn settle_folds(&mut self) {
		if let Some(files) = &mut self.files
			&& files.settle()
		{
			self.rebuild_rows();
		}
		let Some(picked) = &mut self.picked else {
			return;
		};
		match &mut picked.fold {
			Some(fold) if fold.done() && fold.opening() => picked.fold = None,
			Some(fold) if fold.done() => self.rebuild_tree(),
			Some(fold) => fold.tick(),
			None => {}
		}
	}

	fn node(&mut self, path: &[tree::Step]) -> Option<&mut Node> {
		match &mut self.picked.as_mut()?.exports {
			Exports::Loaded(root) => root.at(path),
			_ => None,
		}
	}

	/// Opens or closes the value at `path`, fetching its first page the first time it opens.
	fn toggle(&mut self, path: Path, cx: &mut Context<Self>) {
		let Some(node) = self.node(&path) else {
			return;
		};
		if !node.value.expandable() {
			return;
		}
		node.expanded = !node.expanded;
		let (open, fetch) = (node.expanded, node.expanded && node.children.is_none());
		let turn = Rc::clone(&path);
		if fetch {
			self.fetch_children(path, 0, cx);
		} else {
			self.unfold_tree(cx);
			cx.notify();
		}
		if let Some(picked) = self.picked.as_mut().filter(|_| !cx.reduce_motion()) {
			picked.turn = Some(Turn::new(turn, open));
		}
	}

	/// Fetches a page of the children of the value at `path`, from `offset`.
	fn fetch_children(&mut self, path: Path, offset: u32, cx: &mut Context<Self>) {
		let Some(node) = self.node(&path) else {
			return;
		};
		let Some(value_ref) = node.value.value_ref.clone() else {
			return;
		};
		match &mut node.children {
			Some(children) => children.fetch = Fetch::Loading,
			None => {
				node.children = Some(tree::Children {
					properties: Vec::new(),
					slots: Vec::new(),
					total: 0,
					fetch: Fetch::Loading,
				})
			}
		}
		let epoch = self.tree_epoch;
		let request = on_runtime(&self.devtools, {
			let devtools = self.devtools.clone();
			async move {
				devtools
					.metro_children(&MetroTarget::Ref(value_ref), offset)
					.await
			}
		});
		cx.spawn(async move |this, cx| {
			let result = request.await.unwrap_or_else(|| Err(cancelled()));
			this.update(cx, |this, cx| {
				if this.tree_epoch != epoch {
					return;
				}
				let Some(node) = this.node(&path) else {
					return;
				};
				match result {
					Ok(page) => node.add_page(page, offset == 0),
					Err(error) => {
						if let Some(children) = &mut node.children {
							children.fetch = Fetch::Failed(error);
						}
					}
				}
				this.unfold_tree(cx);
				this.advance_reveal(cx);
				cx.notify();
			})
			.ok();
		})
		.detach();
		self.rebuild_tree();
		cx.notify();
	}

	/// Runs the getter at `path`; its row then shows what it returned, or threw.
	fn read(&mut self, path: Path, cx: &mut Context<Self>) {
		let Some(node) = self.node(&path) else {
			return;
		};
		let Some(getter_ref) = node.value.value_ref.clone() else {
			return;
		};
		node.read = Fetch::Loading;
		let epoch = self.tree_epoch;
		let request = on_runtime(&self.devtools, {
			let devtools = self.devtools.clone();
			async move { devtools.metro_read(&getter_ref).await }
		});
		cx.spawn(async move |this, cx| {
			let result = request.await.unwrap_or_else(|| Err(cancelled()));
			this.update(cx, |this, cx| {
				if this.tree_epoch != epoch {
					return;
				}
				let Some(node) = this.node(&path) else {
					return;
				};
				match result {
					Ok(value) => {
						// The getter's key stays; the value it returned replaces the getter.
						let key = std::mem::take(&mut node.value.key);
						*node = Node::new(value);
						node.value.key = key;
					}
					Err(error) => node.read = Fetch::Failed(error),
				}
				this.rebuild_tree();
				cx.notify();
			})
			.ok();
		})
		.detach();
		cx.notify();
	}
}
