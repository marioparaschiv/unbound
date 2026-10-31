package main

import (
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
	"testing"
)

var optionalSmokeMembers = []string{"freezes", "startDurations"}

func clientExports(t *testing.T, relative string) []string {
	t.Helper()
	data, err := os.ReadFile(filepath.Join("..", "..", "client", "src", filepath.FromSlash(relative)))
	if err != nil {
		t.Fatal(err)
	}
	var names []string
	for _, match := range regexp.MustCompile(`export (?:const|async function|function) ([A-Za-z]+)|as ([A-Za-z]+) \}`).FindAllStringSubmatch(string(data), -1) {
		names = append(names, match[1]+match[2])
	}
	return names
}

func smokeScriptMembers(t *testing.T, receiver string) []string {
	t.Helper()
	var members []string
	pattern := regexp.MustCompile(regexp.QuoteMeta(receiver) + `\.([A-Za-z]+)`)
	for _, file := range []string{"smoke.go", "smoke_cycle.go", "smoke_faults.go"} {
		data, err := os.ReadFile(file)
		if err != nil {
			t.Fatal(err)
		}
		for _, match := range pattern.FindAllStringSubmatch(string(data), -1) {
			if !slices.Contains(members, match[1]) && !slices.Contains(optionalSmokeMembers, match[1]) {
				members = append(members, match[1])
			}
		}
	}
	return members
}

func TestSmokeScriptsOnlyUseTheClientsPublicAPI(t *testing.T) {
	for receiver, file := range map[string]string{"manager": "plugins/api.ts", "unbound.storage": "storage/api.ts"} {
		exports := clientExports(t, file)
		members := smokeScriptMembers(t, receiver)
		if len(members) == 0 {
			t.Fatalf("the smoke scripts use nothing from %s, so this check is reading the wrong files", receiver)
		}
		for _, member := range members {
			if !slices.Contains(exports, member) {
				t.Errorf("the smoke scripts call %s.%s, which client/src/%s does not export (it has %s)", receiver, member, file, strings.Join(exports, ", "))
			}
		}
	}
}
