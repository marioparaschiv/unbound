use std::collections::HashSet;

use gpui::{Context, Task};
use unbound_devtools_core::{ElementId, Hook, InspectedElement, Path, PathSegment, Value};

use crate::app::{Workspace, on_runtime};
use crate::value_editor::Editor;

pub struct Inspection {
	pub id: ElementId,
	pub element: Option<InspectedElement>,
	pub error: Option<String>,
	pub expanded: HashSet<Path>,
	pub loading: HashSet<Path>,
	/// The one inline editor open in the inspector, if any.
	pub editor: Option<Editor>,
	task: Option<Task<()>>,
}

impl Inspection {
	pub fn new(id: ElementId) -> Self {
		Self {
			id,
			element: None,
			error: None,
			expanded: HashSet::new(),
			loading: HashSet::new(),
			editor: None,
			task: None,
		}
	}
}

pub fn key(name: &str) -> PathSegment {
	PathSegment::Key(name.to_string())
}

pub fn child(path: &Path, segment: PathSegment) -> Path {
	let mut path = path.clone();
	path.push(segment);
	path
}

pub fn hook_at<'a, 'p>(
	hooks: &'a [Hook],
	path: &'p [PathSegment],
) -> Option<(&'a Hook, &'p [PathSegment])> {
	let [PathSegment::Index(ix), rest @ ..] = path else {
		return None;
	};
	let hook = hooks.get(*ix)?;
	match rest {
		[PathSegment::Key(sub), tail @ ..] if sub == "subHooks" => hook_at(&hook.sub_hooks, tail),
		_ => Some((hook, rest)),
	}
}

fn hook_at_mut<'a, 'p>(
	hooks: &'a mut [Hook],
	path: &'p [PathSegment],
) -> Option<(&'a mut Hook, &'p [PathSegment])> {
	let [PathSegment::Index(ix), rest @ ..] = path else {
		return None;
	};
	let hook = hooks.get_mut(*ix)?;
	match rest {
		[PathSegment::Key(sub), tail @ ..] if sub == "subHooks" => {
			hook_at_mut(&mut hook.sub_hooks, tail)
		}
		_ => Some((hook, rest)),
	}
}

pub fn split_value(rest: &[PathSegment]) -> Option<&[PathSegment]> {
	match rest {
		[PathSegment::Key(value), tail @ ..] if value == "value" => Some(tail),
		_ => None,
	}
}

pub fn value_at<'a>(element: &'a InspectedElement, path: &[PathSegment]) -> Option<&'a Value> {
	let [PathSegment::Key(section), rest @ ..] = path else {
		return None;
	};
	match section.as_str() {
		"props" => element.props.as_ref()?.get(rest),
		"state" => element.state.as_ref()?.get(rest),
		"context" => element.context.as_ref()?.get(rest),
		"hooks" => {
			let (hook, rest) = hook_at(&element.hooks, rest)?;
			hook.value.get(split_value(rest)?)
		}
		_ => None,
	}
}

pub fn splice(element: &mut InspectedElement, path: &[PathSegment], value: Value) {
	let [PathSegment::Key(section), rest @ ..] = path else {
		return;
	};
	let root = match section.as_str() {
		"props" => element.props.as_mut(),
		"state" => element.state.as_mut(),
		"context" => element.context.as_mut(),
		"hooks" => {
			let Some((hook, rest)) = hook_at_mut(&mut element.hooks, rest) else {
				return;
			};
			if let Some(tail) = split_value(rest) {
				hook.value.set(tail, value);
			}
			return;
		}
		_ => None,
	};
	if let Some(root) = root {
		root.set(rest, value);
	}
}

fn needs_hydration(value: Option<&Value>) -> bool {
	matches!(value, Some(Value::Dehydrated(meta)) if meta.inspectable)
}

impl Workspace {
	pub fn inspect(&mut self, id: ElementId, cx: &mut Context<Self>) {
		let Some(inspection) = self
			.inspection
			.as_mut()
			.filter(|inspection| inspection.id == id)
		else {
			return;
		};
		let devtools = self.devtools.clone();
		let request = on_runtime(&self.devtools, async move { devtools.inspect(id).await });
		inspection.task = Some(cx.spawn(async move |this, cx| {
			let result = request.await;
			this.update(cx, |this, cx| {
				let result = match result {
					Some(result) => result.map_err(|error| error.to_string()),
					None => Err("The inspect request was cancelled.".to_string()),
				};
				this.inspected(id, result, cx);
			})
			.ok();
		}));
	}

	fn inspected(
		&mut self,
		id: ElementId,
		result: Result<InspectedElement, String>,
		cx: &mut Context<Self>,
	) {
		let Some(inspection) = self
			.inspection
			.as_mut()
			.filter(|inspection| inspection.id == id)
		else {
			return;
		};
		inspection.task = None;
		match result {
			Ok(element) => {
				if let Some(renderer) = &element.renderer {
					self.renderer = Some(renderer.replacen('@', " ", 1));
				}
				inspection.element = Some(element);
				inspection.error = None;
			}
			Err(error) => {
				inspection.error = Some(error);
			}
		}
		self.rehydrate_expanded(id, cx);
		cx.notify();
	}

	fn rehydrate_expanded(&mut self, id: ElementId, cx: &mut Context<Self>) {
		let Some(inspection) = self
			.inspection
			.as_ref()
			.filter(|inspection| inspection.id == id)
		else {
			return;
		};
		let Some(element) = &inspection.element else {
			return;
		};
		let mut stale: Vec<Path> = inspection
			.expanded
			.iter()
			.filter(|path| needs_hydration(value_at(element, path)))
			.cloned()
			.collect();
		stale.sort_by_key(Vec::len);
		for path in stale {
			self.hydrate(id, path, cx);
		}
	}

	fn hydrate(&mut self, id: ElementId, path: Path, cx: &mut Context<Self>) {
		let Some(inspection) = self
			.inspection
			.as_mut()
			.filter(|inspection| inspection.id == id)
		else {
			return;
		};
		if !inspection.loading.insert(path.clone()) {
			return;
		}
		let devtools = self.devtools.clone();
		let request_path = path.clone();
		let request = on_runtime(&self.devtools, async move {
			devtools.inspect_path(id, request_path).await
		});
		cx.spawn(async move |this, cx| {
			let result = request.await;
			this.update(cx, |this, cx| {
				let Some(inspection) = this
					.inspection
					.as_mut()
					.filter(|inspection| inspection.id == id)
				else {
					return;
				};
				inspection.loading.remove(&path);
				if let (Some(Ok(value)), Some(element)) = (result, inspection.element.as_mut()) {
					splice(element, &path, value);
				}
				cx.notify();
			})
			.ok();
		})
		.detach();
	}

	pub fn toggle_value(&mut self, path: Path, cx: &mut Context<Self>) {
		let Some(inspection) = self.inspection.as_mut() else {
			return;
		};
		if inspection.expanded.remove(&path) {
			cx.notify();
			return;
		}
		inspection.expanded.insert(path.clone());
		let id = inspection.id;
		let hydrate = inspection
			.element
			.as_ref()
			.is_some_and(|element| needs_hydration(value_at(element, &path)));
		if hydrate {
			self.hydrate(id, path, cx);
		}
		cx.notify();
	}

	pub fn toggle_highlight(&mut self, id: ElementId, cx: &mut Context<Self>) {
		self.highlighted = if self.highlighted == Some(id) {
			None
		} else {
			Some(id)
		};
		self.devtools.highlight(self.highlighted);
		cx.notify();
	}

	/// The device can only store the element it inspected last, so inspect, store, then log.
	pub fn log_to_console(&mut self, id: ElementId, cx: &mut Context<Self>) {
		let devtools = self.devtools.clone();
		let request = on_runtime(&self.devtools, async move {
			devtools.inspect(id).await?;
			let name = devtools.store_as_global(id, Vec::new())?;
			devtools.eval(&format!("console.log({name})")).await?;
			anyhow::Ok(())
		});
		cx.spawn(async move |this, cx| {
			if let Some(Err(error)) = request.await {
				this.update(cx, |this, cx| {
					this.show_error(format!("Log to console: {error:#}"), cx)
				})
				.ok();
			}
		})
		.detach();
	}
}
