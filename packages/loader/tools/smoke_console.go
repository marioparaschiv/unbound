package main

import (
	"regexp"
	"sort"
	"strings"
)

const (
	smokeConsoleMessageLimit = 240
	smokeConsoleEntryLimit   = 200
)

var (
	smokeAndroidLogLine  = regexp.MustCompile(`^\d\d-\d\d \d\d:\d\d:\d\d\.\d+\s+\d+\s+\d+ ([VDIWEF]) ([^:]+?)\s*: (.*)$`)
	smokeDeviceLogLine   = regexp.MustCompile(`^\d{4}-\d\d-\d\dT[\d:.]+Z ([DIWE]) (.*)$`)
	smokeIOSLogLine      = regexp.MustCompile(`^\d{4}-\d\d-\d\d \d\d:\d\d:\d\d\.\d+ (\w+)\s+\S+ (\[[^\]]*\] )?(.*)$`)
	smokeConsoleVolatile = []struct {
		pattern     *regexp.Regexp
		replacement string
	}{
		{regexp.MustCompile(`[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}`), "<uuid>"},
		{regexp.MustCompile(`0x[0-9a-fA-F]+`), "<hex>"},
		{regexp.MustCompile(`/(?:Users|data|private|var)/\S+`), "<path>"},
		{regexp.MustCompile(`\b[0-9a-f]{12,}\b`), "<hex>"},
		{regexp.MustCompile(`\d+(?:\.\d+)?`), "#"},
		{regexp.MustCompile(`\s+`), " "},
	}
)

type smokeConsoleEntry struct {
	Level   string `json:"level"`
	Message string `json:"message"`
}

func normaliseConsoleMessage(message string) string {
	for _, volatile := range smokeConsoleVolatile {
		message = volatile.pattern.ReplaceAllString(message, volatile.replacement)
	}
	message = strings.TrimSpace(message)
	if len(message) > smokeConsoleMessageLimit {
		message = message[:smokeConsoleMessageLimit]
	}
	return message
}

func androidConsoleEntry(line string) (smokeConsoleEntry, bool) {
	match := smokeAndroidLogLine.FindStringSubmatch(line)
	if match == nil {
		return smokeConsoleEntry{}, false
	}
	tag := strings.TrimSpace(match[2])
	if tag != "ReactNativeJS" && tag != "astral" {
		return smokeConsoleEntry{}, false
	}
	switch match[1] {
	case "E", "F":
		return smokeConsoleEntry{Level: "error", Message: normaliseConsoleMessage(match[3])}, true
	case "W":
		return smokeConsoleEntry{Level: "warning", Message: normaliseConsoleMessage(match[3])}, true
	}
	return smokeConsoleEntry{}, false
}

func deviceConsoleEntry(line string) (smokeConsoleEntry, bool) {
	match := smokeDeviceLogLine.FindStringSubmatch(line)
	if match == nil {
		return smokeConsoleEntry{}, false
	}
	switch match[1] {
	case "E":
		return smokeConsoleEntry{Level: "error", Message: normaliseConsoleMessage(match[2])}, true
	case "W":
		return smokeConsoleEntry{Level: "warning", Message: normaliseConsoleMessage(match[2])}, true
	}
	return smokeConsoleEntry{}, false
}

func iosConsoleEntry(line string) (smokeConsoleEntry, bool) {
	match := smokeIOSLogLine.FindStringSubmatch(line)
	if match == nil {
		return smokeConsoleEntry{}, false
	}
	switch match[1] {
	case "E", "F", "Error", "Fault":
		return smokeConsoleEntry{Level: "error", Message: normaliseConsoleMessage(match[3])}, true
	}
	return smokeConsoleEntry{}, false
}

type smokeConsoleSet map[smokeConsoleEntry]bool

func (set smokeConsoleSet) add(entry smokeConsoleEntry) {
	if entry.Message != "" && len(set) < smokeConsoleEntryLimit {
		set[entry] = true
	}
}

func (set smokeConsoleSet) sorted() []smokeConsoleEntry {
	entries := make([]smokeConsoleEntry, 0, len(set))
	for entry := range set {
		entries = append(entries, entry)
	}
	sort.Slice(entries, func(left, right int) bool {
		if entries[left].Level != entries[right].Level {
			return entries[left].Level < entries[right].Level
		}
		return entries[left].Message < entries[right].Message
	})
	return entries
}

func newConsoleEntries(current []smokeConsoleEntry, baseline []smokeStartupRecord) []smokeConsoleEntry {
	seen := smokeConsoleSet{}
	for _, record := range baseline {
		for _, entry := range record.Console {
			seen[entry] = true
		}
	}
	fresh := []smokeConsoleEntry{}
	for _, entry := range current {
		if !seen[entry] {
			fresh = append(fresh, entry)
		}
	}
	return fresh
}
