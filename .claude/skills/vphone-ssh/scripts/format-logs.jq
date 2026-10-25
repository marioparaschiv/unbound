# format-logs.jq — turn `log show --style ndjson` events into clean, readable lines.
#
# Input: one JSON log event per line (NDJSON), as produced by:
#   /usr/bin/log show --archive A --predicate '...' --info --debug --style ndjson
#
# Two Unbound sources are handled:
#   app.unbound            -> native os_log; eventMessage = "[Unbound] [Cat] msg"
#   com.facebook.react.log -> JS console; eventMessage = "'>>', '<ansi>[Scope]<ansi>', '<ansi>msg<ansi>'"
#
# We never parse the syslog text line: every field (time, level, subsystem,
# category, message) comes typed from the JSON. Cleanup (on the message STRING
# only) = ANSI removal, unwrapping the JS console arg-list, collapsing multi-line
# messages, and dropping a leading "[Category]" bracket ONLY when it duplicates
# the category column. A leading bracket that differs from the category (e.g. a
# "[Debugger]" message logged under category "default") is real content and kept.
#
# Output:  HH:MM:SS.mmm  L  [category|JS]  message

# Strip ANSI colour escapes: both the raw ESC-byte form and the literal
# "[..m" text form React Native serialises into the message.
def deansi:
  gsub("\\[[0-9;]*m"; "")
  | gsub("\\\\u001b\\[[0-9;]*m"; "");

# Keep each event on one line (native NSError dumps embed newlines).
def oneline:
  gsub("\\s*\n\\s*"; " ") | gsub("  +"; " ");

# Unwrap the JS console arg-list "'a', 'b', 'c'" -> "a b c" (after deansi).
# RN joins console.* args as single-quoted, comma-separated tokens; the first is
# the leading marker arg, which we drop.
def unwrap_js:
  deansi
  | sub("^'[^']*', "; "")     # drop the leading marker token ('>>')
  | ltrimstr("'") | rtrimstr("'")
  | gsub("', '"; " ")
  | oneline;

# Native messages are "[Unbound] [Category] msg". Drop the "[Unbound] " tag, and
# drop the leading "[Category] " bracket ONLY when it duplicates the os_log
# category column (case-insensitive). A leading bracket that does NOT match the
# category is real content and is preserved.
def native_msg($cat):
  (deansi | ltrimstr("[Unbound] ") | oneline) as $m
  | ($m | capture("^\\[(?<b>[A-Za-z]+)\\] (?<rest>.*)$") // null) as $cap
  | (if $cap != null and ($cap.b | ascii_downcase) == ($cat | ascii_downcase)
        then $cap.rest else $m end);

(.timestamp[11:23] // "??:??:??.???") as $t
| ((.messageType // "Default")[0:1]) as $lvl
| (.eventMessage // "") as $msg
| (.category // "default") as $cat
| if .subsystem == "com.facebook.react.log"
    then "\($t) \($lvl) [JS] \($msg | unwrap_js)"
  else
    "\($t) \($lvl) [\($cat)] \($msg | native_msg($cat))"
  end
