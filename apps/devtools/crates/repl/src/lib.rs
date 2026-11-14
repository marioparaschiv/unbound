//! The DevTools console's engine, with no UI: [`Checker`] runs tsrs's TypeScript language server
//! in-process over the console's buffer, [`transpile`] strips the types Hermes can't run, and
//! [`device`] wraps code so the device answers with a bounded preview and the value's shape as a
//! type, never the whole value.

pub mod checker;
pub mod device;
mod position;
mod project;
mod top_level_await;
pub mod transpile;

pub use checker::Checker;
pub use transpile::transpile;
