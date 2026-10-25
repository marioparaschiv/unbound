package main

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/x509"
	"encoding/pem"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"testing"
)

func TestAttestationSurvivesCodesign(t *testing.T) {
	if runtime.GOOS != "darwin" {
		t.Skip("codesign integration requires macOS")
	}
	for _, command := range []string{"clang", "codesign"} {
		if _, err := exec.LookPath(command); err != nil {
			t.Skipf("%s is unavailable", command)
		}
	}
	private, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	privateDER, err := x509.MarshalECPrivateKey(private)
	if err != nil {
		t.Fatal(err)
	}
	privatePath := filepath.Join(t.TempDir(), "private.pem")
	if err := os.WriteFile(privatePath, pem.EncodeToMemory(&pem.Block{Type: "EC PRIVATE KEY", Bytes: privateDER}), 0o600); err != nil {
		t.Fatal(err)
	}
	root := t.TempDir()
	source := filepath.Join(root, "fixture.c")
	dylib := filepath.Join(root, "fixture.dylib")
	contents := "__attribute__((section(\"__TEXT,__attestation\"), used))\nconst unsigned char AttestationPlaceholder[256] = {0};\n"
	if err := os.WriteFile(source, []byte(contents), 0o644); err != nil {
		t.Fatal(err)
	}
	if output, err := exec.Command("clang", "-dynamiclib", "-Wl,-headerpad_max_install_names", "-o", dylib, source).CombinedOutput(); err != nil {
		t.Fatalf("clang failed: %s", output)
	}
	if err := signFile(dylib, private, "commit", "version"); err != nil {
		t.Fatal(err)
	}
	if _, err := verifyFile(dylib, &private.PublicKey); err != nil {
		t.Fatal(err)
	}
	if output, err := exec.Command("codesign", "-f", "-s", "-", dylib).CombinedOutput(); err != nil {
		t.Fatalf("codesign failed: %s", output)
	}
	if _, err := verifyFile(dylib, &private.PublicKey); err != nil {
		t.Fatal(err)
	}
}
