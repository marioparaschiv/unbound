package main

import (
	"crypto/ed25519"
	"crypto/rand"
	"crypto/x509"
	"encoding/base64"
	"encoding/pem"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

const (
	bundleSigningPrivateKeyName = "bundle-signing.pem"
	bundleSigningPublicKeyName  = "bundle-signing.pub"
	bundleSignatureSuffix       = ".sig"
)

func runBundleKey(args []string) error {
	if len(args) == 0 {
		return errors.New("usage: bundle-key <generate|verify> [flags]")
	}
	switch args[0] {
	case "generate":
		return bundleKeyGenerateCommand(args[1:], os.Stdout)
	case "verify":
		return bundleKeyVerifyCommand(args[1:], os.Stdout)
	default:
		return fmt.Errorf("unknown bundle-key command %q", args[0])
	}
}

func bundleKeyGenerateCommand(args []string, output io.Writer) error {
	set := flag.NewFlagSet("bundle-key generate", flag.ContinueOnError)
	out := set.String("out", "", "directory to write bundle-signing.pem and bundle-signing.pub into")
	if err := set.Parse(args); err != nil {
		return err
	}
	if *out == "" {
		return errors.New("usage: bundle-key generate --out <dir>")
	}
	privatePath, publicPath, err := generateBundleSigningKey(*out, rand.Reader)
	if err != nil {
		return err
	}
	public, err := os.ReadFile(publicPath)
	if err != nil {
		return err
	}
	fmt.Fprintf(output, "Private key: %s\n", privatePath)
	fmt.Fprintf(output, "Public key: %s (%s)\n", publicPath, strings.TrimSpace(string(public)))
	return nil
}

func generateBundleSigningKey(directory string, entropy io.Reader) (string, string, error) {
	if err := os.MkdirAll(directory, 0o700); err != nil {
		return "", "", err
	}
	privatePath := filepath.Join(directory, bundleSigningPrivateKeyName)
	publicPath := filepath.Join(directory, bundleSigningPublicKeyName)
	for _, path := range []string{privatePath, publicPath} {
		if _, err := os.Stat(path); err == nil {
			return "", "", fmt.Errorf("%s already exists; refusing to replace a signing key", path)
		}
	}

	public, private, err := ed25519.GenerateKey(entropy)
	if err != nil {
		return "", "", err
	}
	encoded, err := x509.MarshalPKCS8PrivateKey(private)
	if err != nil {
		return "", "", err
	}
	privatePEM := pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: encoded})
	clearBytes(encoded)
	defer clearBytes(privatePEM)

	file, err := os.OpenFile(privatePath, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o600)
	if err != nil {
		return "", "", err
	}
	if _, err := file.Write(privatePEM); err != nil {
		file.Close()
		return "", "", err
	}
	if err := file.Close(); err != nil {
		return "", "", err
	}
	publicText := base64.StdEncoding.EncodeToString(public) + "\n"
	if err := os.WriteFile(publicPath, []byte(publicText), 0o644); err != nil {
		return "", "", err
	}
	return privatePath, publicPath, nil
}

func parseBundleSigningPublicKey(text string) (ed25519.PublicKey, error) {
	decoded, err := base64.StdEncoding.DecodeString(strings.TrimSpace(text))
	if err != nil {
		return nil, fmt.Errorf("invalid bundle signing public key: %w", err)
	}
	if len(decoded) != ed25519.PublicKeySize {
		return nil, fmt.Errorf("bundle signing public key is %d bytes, want %d", len(decoded), ed25519.PublicKeySize)
	}
	return ed25519.PublicKey(decoded), nil
}

func signedBundleFiles(directory string) ([]string, error) {
	entries, err := os.ReadDir(directory)
	if err != nil {
		return nil, err
	}
	var files []string
	for _, entry := range entries {
		name := entry.Name()
		if entry.IsDir() || !strings.HasPrefix(name, "unbound.") {
			continue
		}
		if name == "unbound.js" || strings.HasSuffix(name, ".bundle") {
			files = append(files, filepath.Join(directory, name))
		}
	}
	sort.Strings(files)
	return files, nil
}

func verifyBundleSignatures(directory string, public ed25519.PublicKey) ([]string, error) {
	files, err := signedBundleFiles(directory)
	if err != nil {
		return nil, err
	}
	if len(files) == 0 {
		return nil, fmt.Errorf("%s has no client bundles", directory)
	}
	var problems []string
	for _, path := range files {
		name := filepath.Base(path)
		signature, err := os.ReadFile(path + bundleSignatureSuffix)
		if err != nil {
			problems = append(problems, name+": no signature")
			continue
		}
		decoded, err := base64.StdEncoding.DecodeString(strings.TrimSpace(string(signature)))
		if err != nil || len(decoded) != ed25519.SignatureSize {
			problems = append(problems, name+": malformed signature")
			continue
		}
		bundle, err := os.ReadFile(path)
		if err != nil {
			return nil, err
		}
		if !ed25519.Verify(public, bundle, decoded) {
			problems = append(problems, name+": signature does not match")
		}
	}
	if len(problems) > 0 {
		return nil, fmt.Errorf("bundle signatures failed:\n  %s", strings.Join(problems, "\n  "))
	}
	return files, nil
}

func bundleKeyVerifyCommand(args []string, output io.Writer) error {
	set := flag.NewFlagSet("bundle-key verify", flag.ContinueOnError)
	directory := set.String("dir", "", "client build directory holding the bundles and their .sig files")
	publicKeyPath := set.String("public-key", filepath.Join(repositoryRoot(), "core", "keys", bundleSigningPublicKeyName), "base64 Ed25519 public key file")
	if err := set.Parse(args); err != nil {
		return err
	}
	if *directory == "" {
		return errors.New("usage: bundle-key verify --dir <dist> [--public-key <file>]")
	}
	raw, err := os.ReadFile(*publicKeyPath)
	if err != nil {
		return fmt.Errorf("read bundle signing public key: %w", err)
	}
	public, err := parseBundleSigningPublicKey(string(raw))
	if err != nil {
		return err
	}
	files, err := verifyBundleSignatures(*directory, public)
	if err != nil {
		return err
	}
	for _, path := range files {
		fmt.Fprintf(output, "Verified %s\n", filepath.Base(path))
	}
	return nil
}
