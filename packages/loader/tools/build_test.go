package main

import (
	"archive/zip"
	"errors"
	"io"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
)

func TestBuildOptionsDoNotAllowOmittingExtensions(t *testing.T) {
	if _, err := parseBuildOptions([]string{"--extensions", "exclude"}, false); err == nil {
		t.Fatal("IPA builds must not allow extensions to be omitted")
	}
}

func TestValidateIPAExtensionsRequiresOriginalAndBuiltExtensions(t *testing.T) {
	source := []string{
		"Payload/Discord.app/PlugIns/BroadcastUpload.appex/Info.plist",
		"Payload/Discord.app/PlugIns/Share.appex/Info.plist",
	}
	complete := append(append([]string{}, source...), "Payload/Discord.app/PlugIns/OpenInDiscord.appex/Info.plist")
	if err := validateIPAExtensions(source, complete); err != nil {
		t.Fatalf("complete IPA rejected: %v", err)
	}
	incomplete := []string{"Payload/Other.app/PlugIns/Share.appex/Info.plist"}
	if err := validateIPAExtensions(source, incomplete); err == nil ||
		!strings.Contains(err.Error(), "BroadcastUpload") ||
		!strings.Contains(err.Error(), "OpenInDiscord") ||
		!strings.Contains(err.Error(), "Share") {
		t.Fatalf("missing extension was not detected: %v", err)
	}
}

func TestRejectLinkRelayAppKeepsTheJailbreakRelayOutOfIPAs(t *testing.T) {
	clean := []string{"Payload/Discord.app/Info.plist", "Payload/Discord.app/PlugIns/Share.appex/Info.plist"}
	if err := rejectLinkRelayApp(clean); err != nil {
		t.Fatalf("IPA without the relay rejected: %v", err)
	}
	for _, entry := range []string{
		"Payload/UnboundLink.app/Info.plist",
		"Payload/Discord.app/UnboundLink.app/UnboundLink",
	} {
		if err := rejectLinkRelayApp(append(append([]string{}, clean...), entry)); err == nil {
			t.Fatalf("relay at %s was not rejected", entry)
		}
	}
}

func TestValidateIPAExtensionExecutables(t *testing.T) {
	for _, test := range []struct {
		name       string
		executable string
		include    bool
		wantError  bool
	}{
		{name: "present", executable: "Share", include: true},
		{name: "missing", executable: "Share", wantError: true},
		{name: "empty", executable: "", wantError: true},
		{name: "invalid path", executable: "../Discord", wantError: true},
	} {
		t.Run(test.name, func(t *testing.T) {
			path := filepath.Join(t.TempDir(), "Discord.ipa")
			file, err := os.Create(path)
			if err != nil {
				t.Fatal(err)
			}
			archive := zip.NewWriter(file)
			info, err := archive.Create("Payload/Discord.app/PlugIns/Share.appex/Info.plist")
			if err != nil {
				t.Fatal(err)
			}
			if _, err := io.WriteString(info, "<?xml version=\"1.0\"?><plist version=\"1.0\"><dict><key>CFBundleExecutable</key><string>"+test.executable+"</string></dict></plist>"); err != nil {
				t.Fatal(err)
			}
			if test.include {
				binary, err := archive.Create("Payload/Discord.app/PlugIns/Share.appex/Share")
				if err != nil {
					t.Fatal(err)
				}
				if _, err := io.WriteString(binary, "binary"); err != nil {
					t.Fatal(err)
				}
			}
			if err := archive.Close(); err != nil {
				t.Fatal(err)
			}
			if err := file.Close(); err != nil {
				t.Fatal(err)
			}
			err = validateIPAExtensionExecutables(path)
			if (err != nil) != test.wantError {
				t.Fatalf("unexpected validation result: %v", err)
			}
		})
	}
}

func TestProvisionSimforgeUsesBuiltProduct(t *testing.T) {
	root := t.TempDir()
	product := filepath.Join(root, ".tools-cache", "simforge-"+simforgeCommit, "derived-data", "Build", "Products", "Release", "simforge")
	calls := []string{}
	var buildArgs []string
	runner := func(work, name string, args []string, env []string, stdout, stderr io.Writer) error {
		calls = append(calls, name)
		if name == "git" && len(args) > 0 && args[0] == "clone" {
			return os.MkdirAll(args[2], 0o755)
		}
		if name == "git" && len(args) > 0 && args[0] == "rev-parse" {
			_, err := io.WriteString(stdout, simforgeCommit+"\n")
			return err
		}
		if name == "xcodebuild" {
			buildArgs = append([]string(nil), args...)
			if err := os.MkdirAll(filepath.Dir(product), 0o755); err != nil {
				return err
			}
			if err := os.WriteFile(product, []byte("simforge"), 0o644); err != nil {
				return err
			}
			return os.Chmod(product, 0o755)
		}
		return nil
	}

	got, err := provisionSimforge(root, runner)
	if err != nil {
		t.Fatal(err)
	}
	if got != product {
		t.Fatalf("unexpected simforge path: %s", got)
	}
	if !reflect.DeepEqual(calls, []string{"git", "git", "xcodebuild"}) {
		t.Fatalf("unexpected provisioning commands: %#v", calls)
	}
	if !strings.Contains(strings.Join(buildArgs, " "), "MACOSX_DEPLOYMENT_TARGET=12.0") {
		t.Fatalf("simforge build does not override the obsolete deployment target: %#v", buildArgs)
	}
}

func TestProvisionSimforgeResumesPinnedCache(t *testing.T) {
	root := t.TempDir()
	cache := filepath.Join(root, ".tools-cache", "simforge-"+simforgeCommit)
	product := filepath.Join(cache, "derived-data", "Build", "Products", "Release", "simforge")
	if err := os.MkdirAll(cache, 0o755); err != nil {
		t.Fatal(err)
	}
	calls := []string{}
	runner := func(work, name string, args []string, env []string, stdout, stderr io.Writer) error {
		calls = append(calls, name)
		if name == "git" && len(args) > 0 && args[0] == "clone" {
			return errors.New("existing simforge cache must not be cloned again")
		}
		if name == "git" && len(args) > 0 && args[0] == "rev-parse" {
			_, err := io.WriteString(stdout, simforgeCommit+"\n")
			return err
		}
		if name == "xcodebuild" {
			if err := os.MkdirAll(filepath.Dir(product), 0o755); err != nil {
				return err
			}
			if err := os.WriteFile(product, []byte("simforge"), 0o755); err != nil {
				return err
			}
		}
		return nil
	}

	got, err := provisionSimforge(root, runner)
	if err != nil {
		t.Fatal(err)
	}
	if got != product {
		t.Fatalf("unexpected simforge path: %s", got)
	}
	if !reflect.DeepEqual(calls, []string{"git", "git", "xcodebuild"}) {
		t.Fatalf("unexpected provisioning commands: %#v", calls)
	}
}

func TestProvisionSimforgeRejectsUnpinnedCache(t *testing.T) {
	for _, test := range []struct {
		name     string
		revision string
		status   string
	}{
		{name: "different revision", revision: "different"},
		{name: "tracked changes", revision: simforgeCommit, status: " M simforge.xcodeproj/project.pbxproj\n"},
	} {
		t.Run(test.name, func(t *testing.T) {
			root := t.TempDir()
			cache := filepath.Join(root, ".tools-cache", "simforge-"+simforgeCommit)
			if err := os.MkdirAll(cache, 0o755); err != nil {
				t.Fatal(err)
			}
			runner := func(work, name string, args []string, env []string, stdout, stderr io.Writer) error {
				if name == "git" && len(args) > 0 && args[0] == "rev-parse" {
					_, err := io.WriteString(stdout, test.revision+"\n")
					return err
				}
				if name == "git" && len(args) > 0 && args[0] == "status" {
					_, err := io.WriteString(stdout, test.status)
					return err
				}
				return errors.New("unpinned simforge cache must not run build commands")
			}
			if _, err := provisionSimforge(root, runner); err == nil {
				t.Fatal("expected an unpinned cache error")
			}
		})
	}
}

func TestProvisionSimforgeRejectsModifiedReadyCache(t *testing.T) {
	root := t.TempDir()
	cache := filepath.Join(root, ".tools-cache", "simforge-"+simforgeCommit)
	product := filepath.Join(cache, "derived-data", "Build", "Products", "Release", "simforge")
	if err := os.MkdirAll(filepath.Dir(product), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(product, []byte("simforge"), 0o755); err != nil {
		t.Fatal(err)
	}
	runner := func(work, name string, args []string, env []string, stdout, stderr io.Writer) error {
		if name == "git" && len(args) > 0 && args[0] == "rev-parse" {
			_, err := io.WriteString(stdout, "different\n")
			return err
		}
		return errors.New("modified simforge cache must not run build commands")
	}
	if _, err := provisionSimforge(root, runner); err == nil {
		t.Fatal("expected a modified ready cache error")
	}
}

func TestZipDirectoryRunsFromPayload(t *testing.T) {
	payload := filepath.Join(t.TempDir(), "Payload")
	output := filepath.Join(t.TempDir(), "simulator.zip")
	var gotRoot string
	var gotName string
	var gotArgs []string
	runner := func(root, name string, args []string, env []string, stdout, stderr io.Writer) error {
		gotRoot = root
		gotName = name
		gotArgs = append([]string(nil), args...)
		return nil
	}

	if err := zipDirectory(payload, output, runner, t.TempDir()); err != nil {
		t.Fatal(err)
	}
	if gotRoot != payload {
		t.Fatalf("unexpected zip working directory: %s", gotRoot)
	}
	if gotName != "zip" {
		t.Fatalf("unexpected zip command: %s", gotName)
	}
	expected := []string{"-q", "-r", output, "Discord.app"}
	if !reflect.DeepEqual(gotArgs, expected) {
		t.Fatalf("unexpected zip arguments: %#v", gotArgs)
	}
}

func TestXcbeautifyKeepsCIOutputPlain(t *testing.T) {
	if !reflect.DeepEqual(xcbeautifyArguments(true), []string{"--disable-logging", "--disable-colored-output"}) {
		t.Fatalf("unexpected CI arguments: %#v", xcbeautifyArguments(true))
	}
	if !reflect.DeepEqual(xcbeautifyArguments(false), []string{"--disable-logging"}) {
		t.Fatalf("unexpected local arguments: %#v", xcbeautifyArguments(false))
	}
}
