//! The explorer's navigation: the pages behind the current one and the pages ahead of it, as a
//! browser keeps them. It holds targets, not data, so a page reloads when it is shown again.

/// A back stack, the current entry and a forward stack.
pub struct History<T> {
	back: Vec<T>,
	current: Option<T>,
	forward: Vec<T>,
}

impl<T> Default for History<T> {
	fn default() -> Self {
		Self {
			back: Vec::new(),
			current: None,
			forward: Vec::new(),
		}
	}
}

impl<T> History<T> {
	/// Starts over at `entry`, as selecting another view does.
	pub fn reset(&mut self, entry: T) {
		self.back.clear();
		self.forward.clear();
		self.current = Some(entry);
	}

	/// Opens `entry` after the current one, dropping the pages ahead.
	pub fn push(&mut self, entry: T) {
		self.forward.clear();
		self.back.extend(self.current.replace(entry));
	}

	/// Steps back one page; `false` at the first.
	pub fn back(&mut self) -> bool {
		let Some(previous) = self.back.pop() else {
			return false;
		};
		self.forward.extend(self.current.replace(previous));
		true
	}

	/// Steps forward one page; `false` at the last.
	pub fn forward(&mut self) -> bool {
		let Some(next) = self.forward.pop() else {
			return false;
		};
		self.back.extend(self.current.replace(next));
		true
	}

	/// Steps back to the page at `index` of [`Self::trail`]; the current page is the last index.
	pub fn go_to(&mut self, index: usize) {
		while self.back.len() > index && self.back() {}
	}

	pub fn current(&self) -> Option<&T> {
		self.current.as_ref()
	}

	pub fn current_mut(&mut self) -> Option<&mut T> {
		self.current.as_mut()
	}

	pub fn can_go_back(&self) -> bool {
		!self.back.is_empty()
	}

	pub fn can_go_forward(&self) -> bool {
		!self.forward.is_empty()
	}

	/// Whether the current page is the one the history started at.
	pub fn at_start(&self) -> bool {
		self.back.is_empty()
	}

	/// The pages from the first to the current one, for a breadcrumb.
	pub fn trail(&self) -> impl Iterator<Item = &T> {
		self.back.iter().chain(self.current.as_ref())
	}
}

#[cfg(test)]
mod tests {
	use super::History;

	fn trail(history: &History<&'static str>) -> Vec<&'static str> {
		history.trail().copied().collect()
	}

	#[test]
	fn back_and_forward_walk_the_pages_opened() {
		let mut history = History::default();
		history.reset("view");
		history.push("layer");
		history.push("delegate");

		assert!(history.back());
		assert_eq!(history.current(), Some(&"layer"));
		assert!(history.can_go_forward());
		assert!(history.forward());
		assert_eq!(history.current(), Some(&"delegate"));
		assert!(!history.forward());
		assert_eq!(trail(&history), ["view", "layer", "delegate"]);
	}

	#[test]
	fn opening_a_page_drops_the_pages_ahead() {
		let mut history = History::default();
		history.reset("view");
		history.push("layer");
		history.back();
		history.push("window");

		assert!(!history.can_go_forward());
		assert_eq!(trail(&history), ["view", "window"]);
	}

	#[test]
	fn a_reset_starts_over_and_go_to_steps_back_to_a_crumb() {
		let mut history = History::default();
		history.reset("view");
		history.push("layer");
		history.push("delegate");
		history.go_to(0);
		assert_eq!(history.current(), Some(&"view"));
		assert!(history.at_start());
		assert!(history.forward());
		assert_eq!(history.current(), Some(&"layer"));

		history.reset("label");
		assert!(!history.can_go_back() && !history.can_go_forward());
		assert_eq!(trail(&history), ["label"]);
	}
}
