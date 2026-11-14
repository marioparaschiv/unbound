package main

import (
	"strings"
	"testing"
)

func TestAppSourceProblemsFlagsMissingBuildsAndPermissions(t *testing.T) {
	source := appSource{Apps: []appSourceApp{{
		Name: "Unbound",
		Versions: []appSourceVersion{
			{Version: "355.0", BuildVersion: "1", DownloadURL: "a", Size: 1},
			{Version: "355.0", DownloadURL: "b", Size: 1},
		},
	}}}
	problems := strings.Join(appSourceProblems(source), "\n")
	for _, want := range []string{"no appPermissions", "misses a version, buildVersion"} {
		if !strings.Contains(problems, want) {
			t.Fatalf("problems %q do not mention %q", problems, want)
		}
	}
}

func TestAppSourceProblemsFlagsDuplicateBuilds(t *testing.T) {
	version := appSourceVersion{Version: "355.0", BuildVersion: "1", DownloadURL: "a", Size: 1}
	source := appSource{Apps: []appSourceApp{{Name: "Unbound", AppPermissions: &appSourcePermits{}, Versions: []appSourceVersion{version, version}}}}
	if problems := appSourceProblems(source); len(problems) != 1 || !strings.Contains(problems[0], "twice") {
		t.Fatalf("problems = %v", problems)
	}
}

func TestMissingPermissionsListsUnlistedKeys(t *testing.T) {
	app := appSourceApp{Name: "Unbound", AppPermissions: &appSourcePermits{
		Entitlements: []string{"aps-environment"},
		Privacy:      map[string]string{"NSCameraUsageDescription": "camera"},
	}}
	permissions := ipaPermissions{
		Entitlements: []string{"aps-environment", "get-task-allow"},
		Privacy:      map[string]string{"NSCameraUsageDescription": "camera", "NSMicrophoneUsageDescription": "mic"},
	}
	problems := missingPermissions(app, permissions)
	if len(problems) != 2 || !strings.Contains(problems[0], "get-task-allow") || !strings.Contains(problems[1], "NSMicrophoneUsageDescription") {
		t.Fatalf("problems = %v", problems)
	}
}

func TestIsPrivacyKey(t *testing.T) {
	if !isPrivacyKey("NSCameraUsageDescription") || isPrivacyKey("CFBundleExecutable") {
		t.Fatal("privacy key detection is wrong")
	}
}
