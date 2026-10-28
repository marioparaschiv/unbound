#!/usr/bin/env python3
"""Drive the emulator UI through uiautomator.

Usage: ui.py dump | tap <text> | wait <text> [seconds] | shot <name> | notifications

adb picks the device from ANDROID_SERIAL. <text> matches a node's text or content description,
exactly first, then by prefix. shot writes $SHOTS/<name>.png (default ./shots).
"""
import html
import os
import re
import shutil
import subprocess
import sys
import time

ADB = shutil.which("adb") or os.path.join(os.environ.get("ANDROID_HOME", os.path.expanduser("~/android-sdk")), "platform-tools", "adb")
NODE = re.compile(r'<node [^>]*?text="([^"]*)"[^>]*?content-desc="([^"]*)"[^>]*?bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"')


def adb(*args, text=True):
    return subprocess.run([ADB, *args], capture_output=True, text=text).stdout


def nodes():
    adb("shell", "uiautomator", "dump", "/sdcard/ui.xml")
    found = []
    for match in NODE.finditer(adb("exec-out", "cat", "/sdcard/ui.xml")):
        label = html.unescape(match[1] or match[2])
        if label:
            x1, y1, x2, y2 = map(int, match.groups()[2:])
            found.append((label, (x1 + x2) // 2, (y1 + y2) // 2))
    return found


def find(text):
    found = nodes()
    exact = [(x, y) for label, x, y in found if label == text]
    prefix = [(x, y) for label, x, y in found if label.startswith(text)]
    return (exact or prefix or [None])[0]


def main(command, *args):
    if command == "dump":
        for label, x, y in nodes():
            print(f"{label!r} @ {x},{y}")
    elif command == "tap":
        position = find(args[0])
        if not position:
            sys.exit(f"not found: {args[0]}")
        adb("shell", "input", "tap", str(position[0]), str(position[1]))
        print(f"tapped {args[0]} at {position}")
    elif command == "wait":
        deadline = time.time() + float(args[1] if len(args) > 1 else 60)
        while time.time() < deadline:
            if find(args[0]):
                print(f"seen {args[0]}")
                return
            time.sleep(1)
        sys.exit(f"timeout waiting for {args[0]}")
    elif command == "shot":
        directory = os.environ.get("SHOTS", "shots")
        os.makedirs(directory, exist_ok=True)
        path = os.path.join(directory, f"{args[0]}.png")
        with open(path, "wb") as file:
            file.write(adb("exec-out", "screencap", "-p", text=False))
        print(path)
    elif command == "notifications":
        dump = adb("shell", "dumpsys", "notification", "--noredact")
        for record in dump.split("NotificationRecord(")[1:]:
            if "pkg=app.unbound.manager" not in record:
                continue
            title = re.search(r"android\.title=\S+ \((.*)\)", record)
            body = re.search(r"android\.text=\S+ \((.*)\)", record)
            print(f"{title[1] if title else ''} | {body[1] if body else ''}")
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    main(*sys.argv[1:])
