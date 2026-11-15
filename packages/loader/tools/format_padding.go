package main

import (
	"regexp"
	"strings"
)

var rawStringOpening = regexp.MustCompile(`R"([^\s()\\]{0,16})\(`)

// Lines that continue the block above them: a chained else/catch, a do-while tail, the next case, or a closing token.
var blockContinuation = regexp.MustCompile(`^(}|\)|\]|else\b|catch\b|while\b|case\b|default\s*:|#)`)

// padBlocks puts a blank line between a closing brace and the statement after it at the same indent.
// Raw strings, block comments and clang-format off regions pass through untouched.
func padBlocks(source []byte) []byte {
	lines := strings.Split(string(source), "\n")
	padded := make([]string, 0, len(lines))
	closing := ""
	previous := ""
	disabled := false

	for _, line := range lines {
		if strings.Contains(line, "clang-format off") {
			disabled = true
		}

		if disabled {
			disabled = !strings.Contains(line, "clang-format on")
			padded = append(padded, line)
			previous = ""

			continue
		}

		if closing != "" {
			if index := strings.Index(line, closing); index >= 0 {
				closing = openedLiteral(line[index+len(closing):])
			}

			padded = append(padded, line)
			previous = ""

			continue
		}

		if needsPadding(previous, line) {
			padded = append(padded, "")
		}

		padded = append(padded, line)
		previous = line
		closing = openedLiteral(line)
	}

	return []byte(strings.Join(padded, "\n"))
}

func needsPadding(previous, line string) bool {
	body := strings.TrimLeft(previous, " \t")

	next := strings.TrimLeft(line, " \t")
	if body != "}" || next == "" {
		return false
	}

	if previous[:len(previous)-len(body)] != line[:len(line)-len(next)] {
		return false
	}

	return !blockContinuation.MatchString(next)
}

// openedLiteral returns the terminator of a raw string or block comment the line leaves open, or "".
func openedLiteral(line string) string {
	for line != "" {
		comment := strings.Index(line, "/*")

		raw := rawStringOpening.FindStringSubmatchIndex(line)
		if comment < 0 && raw == nil {
			return ""
		}

		start, opener, closing := comment, 2, "*/"
		if raw != nil && (comment < 0 || raw[0] < comment) {
			start, opener, closing = raw[0], raw[1]-raw[0], ")"+line[raw[2]:raw[3]]+`"`
		}

		rest := line[start+opener:]

		index := strings.Index(rest, closing)
		if index < 0 {
			return closing
		}

		line = rest[index+len(closing):]
	}

	return ""
}
