package main

import (
	"bytes"
	"crypto/ed25519"
	"crypto/rand"
	"crypto/sha512"
	"crypto/x509"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
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
	return writeSignedFile(t, directory, name, contents, private, 0)
}

func writeSignedFile(t *testing.T, directory, name string, contents []byte, private ed25519.PrivateKey, pullRequest uint64) string {
	t.Helper()
	path := filepath.Join(directory, name)
	if err := os.WriteFile(path, contents, 0o644); err != nil {
		t.Fatal(err)
	}
	signature := base64.StdEncoding.EncodeToString(ed25519.Sign(private, signedMessage(contents, pullRequest))) + "\n"
	if err := os.WriteFile(path+bundleSignatureSuffix, []byte(signature), 0o644); err != nil {
		t.Fatal(err)
	}
	return path
}

func writeSignedManifest(t *testing.T, directory string, bundles map[string][]byte, private ed25519.PrivateKey, pullRequest uint64) {
	t.Helper()
	hashes := map[string]string{}
	for name, contents := range bundles {
		writeSignedFile(t, directory, name, contents, private, pullRequest)
		sum := sha512.Sum512(contents)
		hashes[name] = hex.EncodeToString(sum[:])
	}
	manifest, err := json.Marshal(map[string]any{
		"revision":         "abc1234",
		"channel":          "beta",
		"buildTime":        "2026-10-27T12:06:15.507Z",
		"bytecodeVersions": []int{98},
		"sha512":           hashes,
	})
	if err != nil {
		t.Fatal(err)
	}
	writeSignedFile(t, directory, bundleManifestName, manifest, private, pullRequest)
}

func signedBuild(t *testing.T, private ed25519.PrivateKey, pullRequest uint64) string {
	t.Helper()
	dist := t.TempDir()
	writeSignedManifest(t, dist, map[string][]byte{
		"unbound.js":        []byte("console.log(1);"),
		"unbound.98.bundle": {0xc6, 0x1f, 0xbc, 0x03},
	}, private, pullRequest)
	return dist
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
	files, err := verifyBundleSignatures(signedBuild(t, private, 0), public)
	if err != nil {
		t.Fatal(err)
	}
	if len(files) != 3 {
		t.Fatalf("verified %d files, want 2 bundles and the manifest", len(files))
	}
}

func TestBundleKeyVerifyChecksTheSignedManifest(t *testing.T) {
	_, private, public := generatedKey(t)
	dist := signedBuild(t, private, 0)
	writeSignedBundle(t, dist, "unbound.98.bundle", []byte("replaced"), private)
	writeSignedBundle(t, dist, "unbound.96.bundle", []byte("unlisted"), private)
	_, err := verifyBundleSignatures(dist, public)
	if err == nil {
		t.Fatal("verify accepted bundles the manifest does not hash")
	}
	for _, want := range []string{"unbound.98.bundle: SHA-512 does not match", "unbound.96.bundle: SHA-512 does not match"} {
		if !strings.Contains(err.Error(), want) {
			t.Fatalf("error %q does not mention %q", err, want)
		}
	}

	dist = signedBuild(t, private, 0)
	if err := os.Remove(filepath.Join(dist, bundleManifestName+bundleSignatureSuffix)); err != nil {
		t.Fatal(err)
	}
	if _, err := verifyBundleSignatures(dist, public); err == nil || !strings.Contains(err.Error(), "manifest.json: no signature") {
		t.Fatalf("verify accepted an unsigned manifest: %v", err)
	}

	dist = signedBuild(t, private, 0)
	if err := os.Remove(filepath.Join(dist, bundleManifestName)); err != nil {
		t.Fatal(err)
	}
	if _, err := verifyBundleSignatures(dist, public); err == nil || !strings.Contains(err.Error(), "manifest.json: missing") {
		t.Fatalf("verify accepted a build without a manifest: %v", err)
	}

	dist = t.TempDir()
	writeSignedBundle(t, dist, "unbound.js", []byte("js"), private)
	writeSignedFile(t, dist, bundleManifestName, []byte(`{"bytecodeVersions":[]}`), private, 0)
	_, err = verifyBundleSignatures(dist, public)
	for _, want := range []string{"no ISO 8601 UTC buildTime", "no revision or channel", "unbound.js: SHA-512 does not match"} {
		if err == nil || !strings.Contains(err.Error(), want) {
			t.Fatalf("error %v does not mention %q", err, want)
		}
	}
}

func TestBundleKeyVerifyBindsPullRequestSignaturesToTheirNumber(t *testing.T) {
	_, private, public := generatedKey(t)
	dist := signedBuild(t, private, 5)
	if _, err := verifySignedBuild(dist, public, 5); err != nil {
		t.Fatal(err)
	}
	for _, pullRequest := range []uint64{0, 6} {
		if _, err := verifySignedBuild(dist, public, pullRequest); err == nil {
			t.Fatalf("a build signed for pull request 5 verified as %d", pullRequest)
		}
	}
	if _, err := verifySignedBuild(signedBuild(t, private, 0), public, 5); err == nil {
		t.Fatal("a build signed without the pull request context verified as pull request 5")
	}
}

func TestBundleKeyVerifyCommandDefaultsToTheKeyForTheBuildKind(t *testing.T) {
	_, private, _ := generatedKey(t)
	dist := signedBuild(t, private, 7)
	err := bundleKeyVerifyCommand([]string{"--dir", dist, "--pr", "7"}, &bytes.Buffer{})
	if err == nil || !strings.Contains(err.Error(), "signature does not match") {
		t.Fatalf("a throwaway key verified against the committed PR key: %v", err)
	}
}

func TestBundleKeyVerifyNeedsOnlyTheSignedManifest(t *testing.T) {
	_, private, public := generatedKey(t)
	_, foreign, _ := generatedKey(t)
	bundles := map[string][]byte{"unbound.98.bundle": []byte("bytecode"), "unbound.js": []byte("source")}

	dist := t.TempDir()
	for name, contents := range bundles {
		if err := os.WriteFile(filepath.Join(dist, name), contents, 0o644); err != nil {
			t.Fatal(err)
		}
	}
	writeSignedManifest(t, dist, bundles, private, 0)
	if _, err := verifyBundleSignatures(dist, public); err != nil {
		t.Fatalf("bundles without their own signature failed beside a signed manifest: %v", err)
	}

	writeSignedManifest(t, dist, bundles, foreign, 0)
	if _, err := verifyBundleSignatures(dist, public); err == nil || !strings.Contains(err.Error(), "manifest.json: signature does not match") {
		t.Fatalf("verify accepted a manifest signed with another key: %v", err)
	}
}

func TestBundleKeyVerifyRequiresBundles(t *testing.T) {
	_, _, public := generatedKey(t)
	if _, err := verifyBundleSignatures(t.TempDir(), public); err == nil {
		t.Fatal("verify passed an empty build directory")
	}
}

func TestBundleKeyGenerateNamesThePullRequestKey(t *testing.T) {
	directory := t.TempDir()
	var output bytes.Buffer
	if err := bundleKeyGenerateCommand([]string{"--out", directory, "--name", pullRequestBundleSigningKeyName}, &output); err != nil {
		t.Fatal(err)
	}
	for _, name := range []string{"pr-bundle-signing.pem", "pr-bundle-signing.pub"} {
		if _, err := os.Stat(filepath.Join(directory, name)); err != nil {
			t.Fatal(err)
		}
	}
	if err := bundleKeyGenerateCommand([]string{"--out", directory, "--name", "other"}, &output); err == nil {
		t.Fatal("generate accepted an unknown key name")
	}
}

func TestCommittedPullRequestSigningKeyIsAnEd25519PublicKey(t *testing.T) {
	raw, err := os.ReadFile(filepath.Join(repositoryRoot(), "core", "keys", pullRequestBundleSigningKeyName+".pub"))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := parseBundleSigningPublicKey(string(raw)); err != nil {
		t.Fatal(err)
	}
	if strings.TrimSpace(string(raw)) != "mSJd/geAbJK4OV7hFgC5x46ZYosHzAusHyNUv5lihSc=" {
		t.Fatalf("committed PR key is %q", raw)
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
