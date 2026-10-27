package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"time"
)

const compatPolicyPath = "packages/loader/compat-policy.json"

type compatPolicy struct {
	Minimum      map[string]string `json:"minimumDiscordVersion"`
	ReminderDays int               `json:"raiseReminderDays"`
}

type compatSupport struct {
	Minimum    string `json:"minimum"`
	NewerSince string `json:"newerSince,omitempty"`
}

var discordVersionPattern = regexp.MustCompile(`^\s*(\d+)\.(\d+)`)

func parseDiscordVersion(version string) ([2]int, error) {
	match := discordVersionPattern.FindStringSubmatch(version)
	if match == nil {
		return [2]int{}, fmt.Errorf("invalid Discord version %q", version)
	}
	major, _ := strconv.Atoi(match[1])
	minor, _ := strconv.Atoi(match[2])
	return [2]int{major, minor}, nil
}

func compareDiscordVersions(left, right string) (int, error) {
	a, err := parseDiscordVersion(left)
	if err != nil {
		return 0, err
	}
	b, err := parseDiscordVersion(right)
	if err != nil {
		return 0, err
	}
	for index := range a {
		if a[index] != b[index] {
			if a[index] < b[index] {
				return -1, nil
			}
			return 1, nil
		}
	}
	return 0, nil
}

func loadCompatPolicy(root string) (*compatPolicy, error) {
	data, err := os.ReadFile(filepath.Join(root, compatPolicyPath))
	if err != nil {
		return nil, err
	}
	var policy compatPolicy
	if err := json.Unmarshal(data, &policy); err != nil {
		return nil, fmt.Errorf("%s: %w", compatPolicyPath, err)
	}
	for _, platform := range []string{"android", "ios"} {
		if _, err := parseDiscordVersion(policy.Minimum[platform]); err != nil {
			return nil, fmt.Errorf("%s: %s minimum: %w", compatPolicyPath, platform, err)
		}
	}
	if policy.ReminderDays <= 0 {
		return nil, fmt.Errorf("%s: raiseReminderDays must be positive", compatPolicyPath)
	}
	return &policy, nil
}

func evaluateCompatSupport(targets []*compatTarget, policy *compatPolicy, baseline *compatResults, now time.Time) map[string]*compatSupport {
	support := map[string]*compatSupport{}
	for _, target := range targets {
		minimum := policy.Minimum[target.Platform]
		state := &compatSupport{Minimum: minimum}
		support[target.Platform] = state
		if order, err := compareDiscordVersions(target.Version, minimum); err != nil || order <= 0 {
			continue
		}
		state.NewerSince = now.Format(time.RFC3339)
		if baseline == nil || baseline.Support[target.Platform] == nil {
			continue
		}
		if previous := baseline.Support[target.Platform]; previous.Minimum == minimum && previous.NewerSince != "" {
			state.NewerSince = previous.NewerSince
		}
	}
	return support
}

func compatOlderThanSupported(target *compatTarget, support map[string]*compatSupport) bool {
	state := support[target.Platform]
	if state == nil {
		return false
	}
	order, err := compareDiscordVersions(target.Version, state.Minimum)
	return err == nil && order < 0
}
