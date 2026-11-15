package main

import (
	"sort"
	"strings"
)

const compatSuggestionLimit = 3

type compatCandidate struct {
	name  string
	score int
}

func shortName(name string) string {
	if dot := strings.LastIndex(name, "."); dot >= 0 {
		return name[dot+1:]
	}

	return name
}

func editDistanceWithin(left, right string, limit int) (int, bool) {
	if diff := len(left) - len(right); diff > limit || -diff > limit {
		return 0, false
	}

	previous := make([]int, len(right)+1)
	current := make([]int, len(right)+1)

	for column := range previous {
		previous[column] = column
	}

	for row := 1; row <= len(left); row++ {
		current[0] = row
		smallest := current[0]

		for column := 1; column <= len(right); column++ {
			cost := 1
			if left[row-1] == right[column-1] {
				cost = 0
			}

			current[column] = min(previous[column]+1, current[column-1]+1, previous[column-1]+cost)
			smallest = min(smallest, current[column])
		}

		if smallest > limit {
			return 0, false
		}

		previous, current = current, previous
	}

	return previous[len(right)], previous[len(right)] <= limit
}

func scoreSimilarName(name, candidate string) (int, bool) {
	if candidate == name {
		return 0, false
	}

	short, candidateShort := shortName(name), shortName(candidate)
	switch {
	case candidateShort == short:
		return 0, true
	case strings.EqualFold(candidateShort, short):
		return 1, true
	case len(short) >= 4 && strings.HasPrefix(candidateShort, short):
		return 2, true
	case len(short) >= 6 && strings.HasSuffix(candidateShort, short):
		return 2, true
	}

	limit := max(1, len(short)/6)
	if distance, ok := editDistanceWithin(strings.ToLower(short), strings.ToLower(candidateShort), limit); ok {
		return 3 + distance, true
	}

	return 0, false
}

func nearestNames(name string, candidates func(yield func(string) bool)) []string {
	var matches []compatCandidate

	for candidate := range candidates {
		if score, ok := scoreSimilarName(name, candidate); ok {
			matches = append(matches, compatCandidate{candidate, score})
		}
	}

	sort.Slice(matches, func(left, right int) bool {
		if matches[left].score != matches[right].score {
			return matches[left].score < matches[right].score
		}

		if len(matches[left].name) != len(matches[right].name) {
			return len(matches[left].name) < len(matches[right].name)
		}

		return matches[left].name < matches[right].name
	})

	names := make([]string, 0, compatSuggestionLimit)
	for _, match := range matches {
		if len(names) == compatSuggestionLimit {
			break
		}

		names = append(names, match.name)
	}

	return names
}

func describeSimilar(names []string) string {
	if len(names) == 0 {
		return ""
	}

	return " (similar: " + describeTerms(names) + ")"
}

func similarNames(name string, candidates func(yield func(string) bool)) string {
	return describeSimilar(nearestNames(name, candidates))
}

func sliceNames(names []string) func(yield func(string) bool) {
	return func(yield func(string) bool) {
		for _, name := range names {
			if !yield(name) {
				return
			}
		}
	}
}

func setNames[V any](names map[string]V) func(yield func(string) bool) {
	return func(yield func(string) bool) {
		for name := range names {
			if !yield(name) {
				return
			}
		}
	}
}
