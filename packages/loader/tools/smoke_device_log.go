package main

import (
	"encoding/json"
	"strings"
	"time"
)

// One JSON line of the loader's log files: `{"t","src","lvl","scope","msg"}`.
type deviceLogEntry struct {
	Time    *int64   `json:"t"`
	Source  string   `json:"src"`
	Level   string   `json:"lvl"`
	Scope   []string `json:"scope"`
	Message *string  `json:"msg"`
}

var deviceLogLevelLetters = map[string]string{"debug": "D", "info": "I", "warn": "W", "error": "E"}

// deviceLogText renders a JSON line of the loader's log as the plain `<ISO> <L> [category] message`
// text older loaders wrote, so the smoke checks read both. Loader lines keep their category, console
// lines read `console`, Unbound's logger lines read as console lines prefixed by their `[scope]`, and
// native lines use their source. Plain lines and lines that are not log entries pass through.
func deviceLogText(line string) string {
	if !strings.HasPrefix(line, "{") {
		return line
	}
	var entry deviceLogEntry
	if json.Unmarshal([]byte(line), &entry) != nil || entry.Time == nil || entry.Message == nil {
		return line
	}
	letter, ok := deviceLogLevelLetters[entry.Level]
	if !ok {
		letter = "I"
	}
	stamp := time.UnixMilli(*entry.Time).UTC().Format("2006-01-02T15:04:05.000Z") + " " + letter
	message := *entry.Message
	switch {
	case entry.Source == "js":
		return stamp + " [console] " + message
	case entry.Source == "unbound" && len(entry.Scope) > 0 && entry.Scope[0] == "Loader":
		category := strings.Join(entry.Scope[1:], "/")
		if category == "" {
			category = "Loader"
		}
		return stamp + " [" + category + "] " + message
	case entry.Source == "unbound":
		if len(entry.Scope) > 0 {
			message = "[" + strings.Join(entry.Scope, " → ") + "] " + message
		}
		return stamp + " [console] " + message
	}
	return stamp + " [" + strings.Join(append([]string{entry.Source}, entry.Scope...), "/") + "] " + message
}

// deviceLogChunk renders each complete line of a chunk of the loader's log with deviceLogText.
func deviceLogChunk(chunk string) string {
	lines := strings.Split(strings.TrimSuffix(chunk, "\n"), "\n")
	for index, line := range lines {
		lines[index] = deviceLogText(line)
	}
	return strings.Join(lines, "\n") + "\n"
}
