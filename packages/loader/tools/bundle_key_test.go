package main

import (
	"bytes"
	"crypto/ed25519"
	"crypto/rand"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func generatedKey(t *testing.T) (string, ed25519.PrivateKey, ed25519.PublicKey) {
	t.Helper()
	directory := t.TempDir()
	privatePath, publicPath, err := generateBundleSigningKey(directory, rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	info, err := os.Stat(privatePath)
	if err != nil {
		t.Fatal(err)
	}
	if info.Mode().Perm() != 0o600 {
		t.Fatalf("private key mode = %v, want 0600", info.Mode().Perm())
	}
	raw, err := os.ReadFile(privatePath)
	if err != nil {
		t.Fatal(err)
	}
	block, _ := pem.Decode(raw)
	if block == nil || block.Type != "PRIVATE KEY" {
		t.Fatal("private key is not a PKCS#8 PEM block")
	}
	parsed, err := x509.ParsePKCS8PrivateKey(block.Bytes)
	if err != nil {
		t.Fatal(err)
	}
	private, ok := parsed.(ed25519.PrivateKey)
	if !ok {
		t.Fatalf("private key is %T, want ed25519", parsed)
	}
	publicText, err := os.ReadFile(publicPath)
	if err != nil {
		t.Fatal(err)
	}
	public, err := parseBundleSigningPublicKey(string(publicText))
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(public, private.Public().(ed25519.PublicKey)) {
		t.Fatal("public key file does not match the private key")
	}
	return directory, private, public
}

func writeSignedBundle(t *testing.T, directory, name string, contents []byte, private ed25519.PrivateKey) string {
	t.Helper()
	path := filepath.Join(directory, name)
	if err := os.WriteFile(path, contents, 0o644); err != nil {
		t.Fatal(err)
	}
	signature := base64.StdEncoding.EncodeToString(ed25519.Sign(private, contents)) + "\n"
	if err := os.WriteFile(path+bundleSignatureSuffix, []byte(signature), 0o644); err != nil {
		t.Fatal(err)
	}
	return path
}

func TestBundleKeyGenerateWritesAMatchingPair(t *testing.T) {
	directory, _, _ := generatedKey(t)
	if _, _, err := generateBundleSigningKey(directory, rand.Reader); err == nil {
		t.Fatal("generate replaced an existing key pair")
	}
}

func TestBundleKeyGenerateNeverPrintsThePrivateKey(t *testing.T) {
	directory := t.TempDir()
	var output bytes.Buffer
	if err := bundleKeyGenerateCommand([]string{"--out", directory}, &output); err != nil {
		t.Fatal(err)
	}
	private, err := os.ReadFile(filepath.Join(directory, bundleSigningPrivateKeyName))
	if err != nil {
		t.Fatal(err)
	}
	block, _ := pem.Decode(private)
	printed := output.String()
	if strings.Contains(printed, "PRIVATE KEY") || strings.Contains(printed, base64.StdEncoding.EncodeToString(block.Bytes)) {
		t.Fatalf("generate printed the private key: %q", printed)
	}
	public, err := os.ReadFile(filepath.Join(directory, bundleSigningPublicKeyName))
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(printed, strings.TrimSpace(string(public))) {
		t.Fatalf("generate did not print the public key: %q", printed)
	}
}

func TestBundleKeyVerifyAcceptsSignedBundles(t *testing.T) {
	_, private, public := generatedKey(t)
	dist := t.TempDir()
	writeSignedBundle(t, dist, "unbound.js", []byte("console.log(1);"), private)
	writeSignedBundle(t, dist, "unbound.98.bundle", []byte{0xc6, 0x1f, 0xbc, 0x03}, private)
	if err := os.WriteFile(filepath.Join(dist, "manifest.json"), []byte("{}"), 0o644); err != nil {
		t.Fatal(err)
	}
	files, err := verifyBundleSignatures(dist, public)
	if err != nil {
		t.Fatal(err)
	}
	if len(files) != 2 {
		t.Fatalf("verified %d bundles, want 2", len(files))
	}
}

func TestBundleKeyVerifyRejectsTamperedMissingAndForeignSignatures(t *testing.T) {
	_, private, public := generatedKey(t)
	_, foreign, _ := generatedKey(t)
	dist := t.TempDir()
	tampered := writeSignedBundle(t, dist, "unbound.98.bundle", []byte("original"), private)
	if err := os.WriteFile(tampered, []byte("tampered"), 0o644); err != nil {
		t.Fatal(err)
	}
	writeSignedBundle(t, dist, "unbound.96.bundle", []byte("other key"), foreign)
	if err := os.WriteFile(filepath.Join(dist, "unbound.js"), []byte("unsigned"), 0o644); err != nil {
		t.Fatal(err)
	}
	_, err := verifyBundleSignatures(dist, public)
	if err == nil {
		t.Fatal("verify accepted bad signatures")
	}
	for _, want := range []string{"unbound.98.bundle: signature does not match", "unbound.96.bundle: signature does not match", "unbound.js: no signature"} {
		if !strings.Contains(err.Error(), want) {
			t.Fatalf("error %q does not mention %q", err, want)
		}
	}
}

func TestBundleKeyVerifyRequiresBundles(t *testing.T) {
	_, _, public := generatedKey(t)
	if _, err := verifyBundleSignatures(t.TempDir(), public); err == nil {
		t.Fatal("verify passed an empty build directory")
	}
}

func TestCommittedBundleSigningKeyIsAnEd25519PublicKey(t *testing.T) {
	raw, err := os.ReadFile(filepath.Join(repositoryRoot(), "core", "keys", bundleSigningPublicKeyName))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := parseBundleSigningPublicKey(string(raw)); err != nil {
		t.Fatal(err)
	}
}
