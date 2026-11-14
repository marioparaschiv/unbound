//! ↑ and ↓ through earlier entries, as in a shell: ↑ from the first line steps back, ↓ from the
//! last line steps forward, and stepping past the newest brings back what was being typed.

#[derive(Default)]
pub struct Recall {
	/// Entries as typed, oldest first.
	entries: Vec<String>,
	/// The entry showing, if one is.
	at: Option<usize>,
	/// What was in the editor before the first step back.
	draft: String,
}

impl Recall {
	/// Records a run entry and starts the next step from the newest.
	pub fn push(&mut self, code: &str) {
		if self.entries.last().is_none_or(|last| last != code) {
			self.entries.push(code.to_owned());
		}
		self.at = None;
		self.draft.clear();
	}

	/// The older entry to show, or `None` at the oldest or with nothing run yet.
	pub fn back(&mut self, current: &str) -> Option<String> {
		let at = match self.at {
			None => {
				self.draft = current.to_owned();
				self.entries.len().checked_sub(1)?
			}
			Some(at) => at.checked_sub(1)?,
		};
		self.at = Some(at);

		self.entries.get(at).cloned()
	}

	/// The newer entry to show, the draft past the newest, or `None` when not stepping.
	pub fn forward(&mut self) -> Option<String> {
		let at = self.at?;
		if at + 1 < self.entries.len() {
			self.at = Some(at + 1);
			return self.entries.get(at + 1).cloned();
		}
		self.at = None;

		Some(std::mem::take(&mut self.draft))
	}
}

#[cfg(test)]
mod tests {
	use super::Recall;

	#[test]
	fn steps_back_and_forward_to_the_draft() {
		let mut recall = Recall::default();
		recall.push("a");
		recall.push("b");
		recall.push("b");
		assert_eq!(recall.forward(), None);
		assert_eq!(recall.back("typing").as_deref(), Some("b"));
		assert_eq!(recall.back("b").as_deref(), Some("a"));
		assert_eq!(recall.back("a"), None);
		assert_eq!(recall.forward().as_deref(), Some("b"));
		assert_eq!(recall.forward().as_deref(), Some("typing"));
		assert_eq!(recall.forward(), None);
	}

	#[test]
	fn has_nothing_before_the_first_run() {
		assert_eq!(Recall::default().back("x"), None);
	}
}
