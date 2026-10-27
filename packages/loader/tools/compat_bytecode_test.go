package main

import (
	"encoding/binary"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
)

func hermesHeaderOnly(version uint32) []byte {
	data := make([]byte, 64)
	binary.LittleEndian.PutUint64(data, hermesMagic)
	binary.LittleEndian.PutUint32(data[8:], version)
	return data
}

func bundleWithVersion(version uint32) []byte {
	data := buildHermesBundle([]string{"UserStore"}, 0)
	binary.LittleEndian.PutUint32(data[8:], version)
	return data
}

func TestReadHermesBytecodeVersion(t *testing.T) {
	if version, err := readHermesBytecodeVersion(hermesHeaderOnly(99)); err != nil || version != 99 {
		t.Fatalf("got %d, %v, want 99", version, err)
	}
	if _, err := readHermesBytecodeVersion([]byte{0xC6, 0x1F}); err == nil || !strings.Contains(err.Error(), "too short") {
		t.Fatalf("a truncated header must say so, got %v", err)
	}
	if _, err := readHermesBytecodeVersion([]byte("console.log('plain JavaScript');")); err == nil || !strings.Contains(err.Error(), "magic") {
		t.Fatalf("plain JavaScript must fail the magic check, got %v", err)
	}
}

func TestReadHermesBundleKeepsTheVersionWhenTheTableFails(t *testing.T) {
	target := &compatTarget{}
	target.readHermesBundle("assets/index.android.bundle", hermesHeaderOnly(100))
	if target.Bytecode != 100 || target.hermes != nil || target.problem == "" {
		t.Fatalf("an unreadable string table must keep the header's version and record the problem: %+v", target)
	}

	broken := &compatTarget{}
	broken.readHermesBundle("Payload/Discord.app/main.jsbundle", []byte("not hermes"))
	if broken.Bytecode != 0 || broken.bundle != "Payload/Discord.app/main.jsbundle" || broken.problem == "" {
		t.Fatalf("an unreadable header must be recorded, not crash the scan: %+v", broken)
	}

	parsed := &compatTarget{}
	parsed.readHermesBundle("assets/index.android.bundle", bundleWithVersion(96))
	if parsed.Bytecode != 96 || parsed.hermes == nil || !parsed.hermes.has("UserStore") || parsed.problem != "" {
		t.Fatalf("a readable bundle must give its version and strings: %+v", parsed)
	}
}

func TestLoadClientBytecodeReference(t *testing.T) {
	root := t.TempDir()
	path := filepath.Join(root, clientBytecodePath)
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, []byte("{\n\t\"bytecodeVersions\": [98, 96]\n}\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	reference, err := loadClientBytecodeReference(root)
	if err != nil {
		t.Fatal(err)
	}
	if !reflect.DeepEqual(reference.Terms, []string{"98", "96"}) || reference.Component != "client" || reference.Locations[0] != (compatLocation{File: clientBytecodePath, Line: 2}) {
		t.Fatalf("unexpected reference %+v", reference)
	}

	if err := os.WriteFile(path, []byte(`{"bytecodeVersions": []}`), 0o644); err != nil {
		t.Fatal(err)
	}
	if _, err := loadClientBytecodeReference(root); err == nil {
		t.Fatal("an empty version list must be rejected")
	}

	if _, err := loadClientBytecodeReference(t.TempDir()); err == nil {
		t.Fatal("a missing client build config must fail the scan")
	}

	repository, err := loadClientBytecodeReference("../../..")
	if err != nil || len(repository.Terms) == 0 {
		t.Fatalf("the client's own build config must load: %v", err)
	}
}

func bytecodeTarget(platform string, data []byte) *compatTarget {
	target := &compatTarget{Platform: platform, Version: "350.8"}
	name := "assets/index.android.bundle"
	if platform == "ios" {
		name = "Payload/Discord.app/main.jsbundle"
	}
	target.readHermesBundle(name, data)
	return target
}

func TestEvaluateBytecode(t *testing.T) {
	bytecode := &compatReference{Kind: referenceHermesBytecode, Component: "client", Name: "bytecodeVersions", Terms: []string{"98", "96", "94"}, Locations: []compatLocation{{File: clientBytecodePath, Line: 2}}}
	store := &compatReference{Kind: referenceStore, Name: "UserStore", Component: "client", Locations: []compatLocation{{File: "a.ts", Line: 1}}}
	references := []*compatReference{bytecode, store}

	supported := evaluateCompat(references, []*compatTarget{bytecodeTarget("android", bundleWithVersion(96))}, nil)
	if finding := statusOf(supported, "android", referenceHermesBytecode, "bytecodeVersions"); finding.Status != compatOK {
		t.Fatalf("a version the client builds must pass: %+v", finding)
	}
	if err := compatBreakageError(supported); err != nil {
		t.Fatal(err)
	}
	if report := renderCompatReport(supported); !strings.Contains(report, "Hermes bytecode: Android 96, which the client builds (98, 96, 94).") {
		t.Fatalf("the report must name the supported version:\n%s", report)
	}

	unsupported := evaluateCompat(references, []*compatTarget{bytecodeTarget("ios", bundleWithVersion(99)), bytecodeTarget("android", bundleWithVersion(99))}, nil)
	finding := statusOf(unsupported, "android", referenceHermesBytecode, "bytecodeVersions")
	if finding.Status != compatWarning || !strings.HasPrefix(finding.Reason, "Discord uses Hermes bytecode 99; the loader falls back to `unbound.js` until the client builds 99") {
		t.Fatalf("a version the client does not build must be a warning: %+v", finding)
	}
	if statusOf(unsupported, "android", referenceStore, "UserStore").Status != compatOK {
		t.Fatal("lookups must still be checked when only the version is unsupported")
	}
	if err := compatBreakageError(unsupported); err != nil {
		t.Fatalf("an unsupported version must not fail --fail-on-breakage: %v", err)
	}
	if compatHasProblems(unsupported) {
		t.Fatal("an unsupported version alone must not count as a channel breakage")
	}
	report := renderCompatReport(unsupported)
	section := strings.Index(report, "### Warnings")
	if section < 0 || section > strings.Index(report, "| Platform |") {
		t.Fatalf("the warning must lead the report:\n%s", report)
	}
	if strings.Count(report, "- Hermes bytecode (iOS, Android): Discord uses Hermes bytecode 99;") != 1 || strings.Contains(report, "### Definitely broken") || strings.Contains(report, "### Hermes bytecode") || !strings.Contains(report, "Everything the scan can check still resolves") {
		t.Fatalf("the warning must be listed once and not as a breakage:\n%s", report)
	}
	if !strings.Contains(report, "| Android | 0 | 0 | 1 | 0 |") {
		t.Fatalf("a warning must not count as broken:\n%s", report)
	}

	unreadable := evaluateCompat(references, []*compatTarget{bytecodeTarget("android", []byte("garbage"))}, nil)
	if finding := statusOf(unreadable, "android", referenceHermesBytecode, "bytecodeVersions"); finding.Status != compatBroken || !strings.Contains(finding.Reason, "cannot be read") {
		t.Fatalf("an unreadable header must be broken with its reason: %+v", finding)
	}
	if report := renderCompatReport(unreadable); !strings.Contains(report, "### Hermes bytecode") || strings.Index(report, "### Hermes bytecode") > strings.Index(report, "| Platform |") {
		t.Fatalf("an unreadable bundle must lead the report:\n%s", report)
	}
	if err := compatBreakageError(unreadable); err == nil || !strings.Contains(err.Error(), "cannot be read") {
		t.Fatalf("an unreadable bundle must fail --fail-on-breakage with its reason, got %v", err)
	}
	if finding := statusOf(unreadable, "android", referenceStore, "UserStore"); finding.Status != "" {
		t.Fatalf("lookups in an unreadable bundle must be skipped, not crash: %+v", finding)
	}

	tableless := evaluateCompat(references, []*compatTarget{bytecodeTarget("android", hermesHeaderOnly(98))}, nil)
	if finding := statusOf(tableless, "android", referenceHermesBytecode, "bytecodeVersions"); finding.Status != compatBroken || !strings.Contains(finding.Reason, "string table") {
		t.Fatalf("a supported version with an unreadable string table must say so: %+v", finding)
	}
}
