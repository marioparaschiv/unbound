package main

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"testing"
	"time"
)

const groupRemapHarness = `#import <Foundation/Foundation.h>
int main(int argc, char **argv) {
    @autoreleasepool {
        NSString *key = [NSUUID UUID].UUIDString;
        NSUserDefaults *discord = [[NSUserDefaults alloc] initWithSuiteName:@"group.com.hammerandchisel.discord"];
        [discord setObject:@"shared" forKey:key];
        [discord synchronize];
        NSUserDefaults *renamed = [[NSUserDefaults alloc] initWithSuiteName:[NSString stringWithUTF8String:argv[1]]];
        NSString *seen = [renamed stringForKey:key];
        [discord removeObjectForKey:key];
        [discord synchronize];
        printf("%s\n", seen ? seen.UTF8String : "missing");
    }
}
`

func buildGroupRemapHarness(t *testing.T, group string) string {
	t.Helper()
	if runtime.GOOS != "darwin" {
		t.Skip("needs clang and codesign")
	}
	dir := t.TempDir()
	source := filepath.Join(dir, "harness.m")
	entitlements := filepath.Join(dir, "harness.entitlements")
	library := filepath.Join(dir, "UnboundGroups.dylib")
	harness := filepath.Join(dir, "harness")
	if err := os.WriteFile(source, []byte(groupRemapHarness), 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(entitlements, []byte(entitlementsPlist([]string{group})), 0o644); err != nil {
		t.Fatal(err)
	}
	steps := [][]string{
		{"xcrun", "clang", "-dynamiclib", "-fobjc-arc", "-framework", "Foundation", "-o", library, filepath.Join("..", "ios", "groups", "UnboundGroups.m")},
		{"xcrun", "clang", "-fobjc-arc", "-framework", "Foundation", "-Wl,-rpath,@executable_path", "-o", harness, source, library},
		{"codesign", "-f", "-s", "-", "--entitlements", entitlements, harness},
	}
	for _, step := range steps {
		if output, err := exec.Command(step[0], step[1:]...).CombinedOutput(); err != nil {
			t.Skipf("%s unavailable: %v %s", step[0], err, output)
		}
	}
	return harness
}

func TestGroupRemapSharesDiscordDefaultsWithTheSignedGroup(t *testing.T) {
	group := fmt.Sprintf("group.dev.unbound.remaptest%d", time.Now().UnixNano())
	harness := buildGroupRemapHarness(t, group)
	home, err := os.UserHomeDir()
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() {
		_ = os.RemoveAll(filepath.Join(home, "Library", "Group Containers", group))
		_ = os.Remove(filepath.Join(home, "Library", "Preferences", group+".plist"))
	})

	output, err := exec.Command(harness, group).CombinedOutput()
	if err != nil {
		t.Fatalf("harness failed: %v %s", err, output)
	}

	if strings.TrimSpace(string(output)) != "shared" {
		t.Fatalf("Discord's suite did not reach the signed group %s: %s", group, output)
	}
}
