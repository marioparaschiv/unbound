# Probing Discord on device

Run `ubd <command>`: `skills/ubd-vphone/scripts/ubd` inside the Unbound repo (after `ubd-vphone`'s `claim.sh`), `bunx @unbound-app/cli` elsewhere. Commands work on iOS and Android unless noted.

The probes borrow the native bridge of a running plugin that holds the capability they need, so keep one native plugin (such as Shiki Codeblocks) enabled. Device evaluations time out after ten seconds unless given a longer `--timeout`.

## Logs and installs

- `ubd logs [--serial <adb serial> | --ios [--udid <udid>]] [--level l] [--grep re] [--since 5m] [--symbolicate]`: tails Discord's log filtered to Unbound, the JS console and crashes (`adb logcat` on Android, following restarts; `idevicesyslog` on a jailbroken iPhone). On iOS, `--since` reads a log archive holding notices, errors and faults only. `--symbolicate` maps Hermes frames with `packages/client/dist`'s maps. `--pull [--out <folder>]` instead copies the loader's rotating log files (`Unbound/Logs/unbound*.log`) off the device.
- `ubd install <id-or-dir> [--serial <adb serial> | --ios [--udid <udid>]] [--restart]`: builds a plugin and copies it into Discord's plugin folder (adb and `su` on Android, `jb-p1lot` on a jailbroken iPhone) for cold-start tests. `--restart` relaunches Discord.

## Native

- `ubd views [class] [--depth n] [--max n]`: prints the native view tree with sizes, visibility, text and handles. A class filter keeps matches and their ancestors (iOS: each match's subtree).
- `ubd inspect views [--class <name>] [--depth n]` / `ubd inspect find <class>`: dumps the current activity's view tree with class, resource id, size, visibility and text, or lists attached views of a class. Gets a 60 s `--timeout`.
- `ubd inspect class <name> [--filter text]`: describes a Java class (superclasses, constructors, methods, fields). iOS shows the superclass chain only.
- `ubd hook <class> <method> [--parameters type ...] [--duration ms]`: records calls to a Java method or Objective-C selector. Hook a specific class, never a method every view calls.
- `ubd spans <text>`: Android only. Prints the text and spans of text views containing the text, invisible characters escaped.

## JS

- `ubd modules <regex>`: lists Metro modules by tracked path or export name and whether they have loaded. Compare platforms with it.
- `ubd trace <prop> [prop ...]`: records calls to a JS function of a module found by props, such as `generateMessageRowData`.
- `ubd timing`: measures timer and main-thread round-trip latency. Large numbers mean the JS thread is busy.
