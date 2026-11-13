//! The native object explorer: one object or class per page, with back and forward, its class chain
//! as collapsible groups and each group's members by kind, loaded a page at a time and filtered on
//! the device. The values of the members on screen are read once scrolling settles. A host view (the
//! View Tree's details pane, the Classes page) owns an [`Explorer`] and draws it with
//! [`Explorer::render`]; the host's own cards go above the sections.

pub mod classes;
mod history;
mod load;
mod render;
mod rows;
pub mod snippets;
mod values;

use std::collections::{HashMap, HashSet};
use std::rc::Rc;
use std::time::Duration;

use gpui::{
	AnyElement, AppContext, Context, Entity, ListAlignment, ListOffset, ListState, Task, Window, px,
};
use gpui_component::input::{InputEvent, InputState};
use unbound_devtools_core::{
	Devtools, ExplorerError, ExplorerMember, ExplorerMemberKind, ExplorerObject, ExplorerTarget,
	ExplorerValue,
};

pub use history::History;
pub(crate) use render::link_button;
use rows::Item;

/// The filter waits for typing to pause before it asks the device again.
const FILTER_DEBOUNCE: Duration = Duration::from_millis(150);
/// Values are read for the rows on screen once scrolling has rested this long.
const VALUES_DEBOUNCE: Duration = Duration::from_millis(100);

/// A view that shows an explorer page.
pub trait ExplorerHost: Sized + 'static {
	fn explorer(&self) -> &Explorer;
	fn explorer_mut(&mut self) -> &mut Explorer;
	/// Cards drawn above the class chain on the first page of the history, such as a view's layout.
	fn prelude(&self, _window: &mut Window, _cx: &mut Context<Self>) -> Option<AnyElement> {
		None
	}
}

/// A page in the history: what it explores, and the class to show instead if that is gone.
#[derive(Clone, Debug, PartialEq)]
pub struct Entry {
	pub target: ExplorerTarget,
	pub class_name: Option<String>,
	/// How the page was left, so going back to it opens the same groups at the same place.
	pub view: Option<PageView>,
}

/// The groups and sections a page had open and where it was scrolled.
#[derive(Clone, Debug, Default, PartialEq)]
pub struct PageView {
	expanded: HashSet<String>,
	open: HashSet<(String, ExplorerMemberKind)>,
	scroll: ListOffset,
}

impl Entry {
	pub fn new(target: ExplorerTarget, class_name: Option<String>) -> Self {
		Self {
			target,
			class_name,
			view: None,
		}
	}

	pub fn class(name: impl Into<String>) -> Self {
		let name = name.into();
		Self::new(ExplorerTarget::ClassName(name.clone()), Some(name))
	}

	/// The breadcrumb's name for the page: its class without the package.
	pub fn title(&self) -> String {
		let name = self.class_name.as_deref().unwrap_or(match &self.target {
			ExplorerTarget::Node(id)
			| ExplorerTarget::Object(id)
			| ExplorerTarget::ClassName(id) => id,
		});
		name.rsplit('.').next().unwrap_or(name).to_owned()
	}
}

/// A request's progress.
pub enum Load<T> {
	Loading,
	Loaded(T),
	Failed(ExplorerError),
}

/// The members of one kind a class declares that match a filter, as far as they are listed.
pub struct Section {
	pub members: Vec<Rc<ExplorerMember>>,
	pub total: u32,
	/// The next page, while it loads (`Ok`) or after it failed.
	pub next: Option<Result<(), ExplorerError>>,
}

/// One member's value, as far as the device has answered.
pub enum ValueState {
	Loading,
	Loaded(ExplorerValue),
	Failed(String),
}

/// A class's members of one kind, matching one filter.
type SectionKey = (String, ExplorerMemberKind, String);
/// A member of a class: its class, kind and name, which also identify it for a later edit or call.
type MemberKey = (String, ExplorerMemberKind, String);

pub struct Explorer {
	devtools: Devtools,
	pub history: History<Entry>,
	object: Option<Load<Rc<ExplorerObject>>>,
	/// The target was gone, so the page shows its class instead.
	fell_back: bool,
	/// Every section listed on this page, per filter, so clearing the filter shows them at once.
	sections: HashMap<SectionKey, Load<Section>>,
	values: HashMap<MemberKey, ValueState>,
	/// The classes of the chain whose groups are open.
	expanded: HashSet<String>,
	/// The open sections, by class and kind.
	open: HashSet<(String, ExplorerMemberKind)>,
	/// The filter the sections are listed with, trimmed, once typing has paused.
	filter: String,
	pub filter_input: Entity<InputState>,
	/// Where to scroll once a page shown again has listed its open sections.
	restore_scroll: Option<ListOffset>,
	items: Rc<Vec<Item>>,
	list: ListState,
	/// Bumped on every navigation and reload; an answer for an older page is dropped.
	epoch: u64,
	/// Whether a device is on the debugger connection.
	connected: bool,
	filter_task: Option<Task<()>>,
	values_task: Option<Task<()>>,
}

impl Explorer {
	pub fn new<H: ExplorerHost>(
		devtools: Devtools,
		window: &mut Window,
		cx: &mut Context<H>,
	) -> Self {
		let filter_input = cx.new(|cx| InputState::new(window, cx).placeholder("Filter members"));
		cx.subscribe(&filter_input, |host: &mut H, _, event: &InputEvent, cx| {
			if matches!(event, InputEvent::Change) {
				host.explorer_mut().filter_typed(cx);
			}
		})
		.detach();
		let list = ListState::new(0, ListAlignment::Top, px(200.));
		let host = cx.entity().downgrade();
		// Runs inside the list's scroll handling, so it only schedules the read.
		list.set_scroll_handler(move |_, _, cx| {
			host.update(cx, |host, cx| host.explorer_mut().schedule_values(cx))
				.ok();
		});
		Self {
			devtools,
			history: History::default(),
			object: None,
			fell_back: false,
			sections: HashMap::new(),
			values: HashMap::new(),
			expanded: HashSet::new(),
			open: HashSet::new(),
			filter: String::new(),
			filter_input,
			restore_scroll: None,
			items: Rc::default(),
			list,
			epoch: 0,
			connected: false,
			filter_task: None,
			values_task: None,
		}
	}

	/// Whether there is a page to show.
	pub fn is_open(&self) -> bool {
		self.history.current().is_some()
	}

	/// Starts the history over at `entry`, as selecting a view does.
	pub fn reset<H: ExplorerHost>(&mut self, entry: Entry, cx: &mut Context<H>) {
		let same = self
			.history
			.current()
			.is_some_and(|current| current.target == entry.target);
		if same && self.history.at_start() {
			return;
		}
		self.history.reset(entry);
		self.show_current(cx);
	}

	/// Opens `entry` after the current page.
	pub fn push<H: ExplorerHost>(&mut self, entry: Entry, cx: &mut Context<H>) {
		self.save_view();
		self.history.push(entry);
		self.show_current(cx);
	}

	pub fn back<H: ExplorerHost>(&mut self, cx: &mut Context<H>) {
		if self.history.can_go_back() {
			self.save_view();
			self.history.back();
			self.show_current(cx);
		}
	}

	pub fn forward<H: ExplorerHost>(&mut self, cx: &mut Context<H>) {
		if self.history.can_go_forward() {
			self.save_view();
			self.history.forward();
			self.show_current(cx);
		}
	}

	pub fn go_to<H: ExplorerHost>(&mut self, index: usize, cx: &mut Context<H>) {
		self.save_view();
		self.history.go_to(index);
		self.show_current(cx);
	}

	/// Keeps the current page's open groups and scroll on its entry before another page shows.
	fn save_view(&mut self) {
		let view = PageView {
			expanded: std::mem::take(&mut self.expanded),
			open: std::mem::take(&mut self.open),
			scroll: self.list.logical_scroll_top(),
		};
		if let Some(entry) = self.history.current_mut() {
			entry.view = Some(view);
		}
	}

	/// The host's connection changed. Coming back re-reads only the current page; the history stays.
	pub fn set_connected<H: ExplorerHost>(&mut self, connected: bool, cx: &mut Context<H>) {
		let returned = connected && !self.connected;
		self.connected = connected;
		if returned && self.is_open() {
			self.reload(cx);
		}
	}

	/// The host's cards above the sections changed size.
	pub fn prelude_changed(&self) {
		if matches!(self.items.first(), Some(Item::Prelude)) {
			self.list.remeasure_items(0..1);
		}
	}

	/// Shows the current entry as it was left, or from the top with its own class open.
	fn show_current<H: ExplorerHost>(&mut self, cx: &mut Context<H>) {
		self.forget_page();
		let view = self
			.history
			.current_mut()
			.and_then(|entry| entry.view.take());
		self.restore_scroll = view.as_ref().map(|view| view.scroll);
		let view = view.unwrap_or_default();
		self.expanded = view.expanded;
		self.open = view.open;
		self.object = None;
		self.fell_back = false;
		self.list.reset(0);
		self.items = Rc::default();
		self.request_object(cx);
	}

	/// Reads the current page again in place, keeping which groups and sections are open.
	pub fn reload<H: ExplorerHost>(&mut self, cx: &mut Context<H>) {
		self.forget_page();
		self.request_object(cx);
	}

	fn forget_page(&mut self) {
		self.epoch += 1;
		self.sections.clear();
		self.values.clear();
		self.values_task = None;
	}

	fn filter_typed<H: ExplorerHost>(&mut self, cx: &mut Context<H>) {
		let text = self.filter_input.read(cx).value().trim().to_owned();
		self.filter_task = Some(cx.spawn(async move |this, cx| {
			cx.background_executor().timer(FILTER_DEBOUNCE).await;
			this.update(cx, |host, cx| host.explorer_mut().apply_filter(text, cx))
				.ok();
		}));
	}

	fn apply_filter<H: ExplorerHost>(&mut self, filter: String, cx: &mut Context<H>) {
		if filter == self.filter {
			return;
		}
		self.filter = filter;
		let open: Vec<_> = self.open.iter().cloned().collect();
		for (class, kind) in open {
			self.ensure_section(&class, kind, cx);
		}
		self.rebuild();
		cx.notify();
	}

	fn toggle_class<H: ExplorerHost>(&mut self, name: &str, cx: &mut Context<H>) {
		if !self.expanded.remove(name) {
			self.expanded.insert(name.to_owned());
		}
		self.rebuild();
		self.schedule_values(cx);
		cx.notify();
	}

	fn toggle_section<H: ExplorerHost>(
		&mut self,
		class: &str,
		kind: ExplorerMemberKind,
		cx: &mut Context<H>,
	) {
		let key = (class.to_owned(), kind);
		if !self.open.remove(&key) {
			self.open.insert(key);
			self.ensure_section(class, kind, cx);
		}
		self.rebuild();
		self.schedule_values(cx);
		cx.notify();
	}

	/// The object the page shows, once loaded.
	fn object(&self) -> Option<&Rc<ExplorerObject>> {
		match &self.object {
			Some(Load::Loaded(object)) => Some(object),
			_ => None,
		}
	}

	/// The ref values are read on; `None` on a class page or after falling back to the class.
	fn object_ref(&self) -> Option<&str> {
		self.object()
			.filter(|_| !self.fell_back)
			.and_then(|object| object.object_ref.as_deref())
	}

	fn section(&self, class: &str, kind: ExplorerMemberKind) -> Option<&Load<Section>> {
		self.sections
			.get(&(class.to_owned(), kind, self.filter.clone()))
	}
}
