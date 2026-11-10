# Native views

- `ubd debug views [class] [--depth n] [--max n]`: the native view tree with sizes, visibility, text and handles. A class filter keeps matches and their ancestors (iOS: each match's subtree).
- `ubd debug inspect views [--class <name>] [--depth n]`: the current activity's view tree with class, resource id, size, visibility and text. Gets a 60 s `--timeout`.
- `ubd debug inspect find <class>`: attached views of a class.
- `ubd debug spans <text>`: Android only. Text and spans of text views containing the text, invisible characters escaped.
