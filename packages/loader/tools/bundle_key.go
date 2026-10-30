package main

import (
	"crypto/ed25519"
	"crypto/rand"
	"crypto/sha512"
	"crypto/x509"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"encoding/pem"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
)

const (
	bundleSigningKeyName            = "bundle-signing"
	pullRequestBundleSigningKeyName = "pr-bundle-signing"
	bundleSigningPrivateKeyName     = bundleSigningKeyName + ".pem"
	bundleSigningPublicKeyName      = bundleSigningKeyName + ".pub"
	bundleSignatureSuffix           = ".sig"
	bundleManifestName              = "manifest.json"
)

var bundleKeyNames = []string{bundleSigningKeyName, pullRequestBundleSigningKeyName}

func pullRequestSigningContext(number uint64) string {
	return "astral-pr-bundle/v1/" + strconv.FormatUint(number, 10) + "/"
}

func signedMessage(contents []byte, pullRequest uint64) []byte {
	if pullRequest == 0 {
		return contents
	}
	return append([]byte(pullRequestSigningContext(pullRequest)), contents...)
}

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
	out := set.String("out", "", "directory to write <name>.pem and <name>.pub into")
	name := set.String("name", bundleSigningKeyName, "key to generate: bundle-signing or pr-bundle-signing")
	if err := set.Parse(args); err != nil {
		return err
	}
	if *out == "" {
		return errors.New("usage: bundle-key generate --out <dir> [--name bundle-signing|pr-bundle-signing]")
	}
	privatePath, publicPath, err := generateNamedBundleSigningKey(*out, *name, rand.Reader)
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
	return generateNamedBundleSigningKey(directory, bundleSigningKeyName, entropy)
}

func generateNamedBundleSigningKey(directory, name string, entropy io.Reader) (string, string, error) {
	known := false
	for _, candidate := range bundleKeyNames {
		known = known || candidate == name
	}
	if !known {
		return "", "", fmt.Errorf("unknown bundle signing key %q, want one of %s", name, strings.Join(bundleKeyNames, ", "))
	}
	if err := os.MkdirAll(directory, 0o700); err != nil {
		return "", "", err
	}
	privatePath := filepath.Join(directory, name+".pem")
	publicPath := filepath.Join(directory, name+".pub")
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
	return verifySignedBuild(directory, public, 0)
}

type bundleManifest struct {
	Revision  string            `json:"revision"`
	Channel   string            `json:"channel"`
	BuildTime string            `json:"buildTime"`
	SHA512    map[string]string `json:"sha512"`
}

var buildTimePattern = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$`)

func verifySignature(path string, public ed25519.PublicKey, pullRequest uint64) (string, []byte, error) {
	name := filepath.Base(path)
	contents, err := os.ReadFile(path)
	if err != nil {
		return "", nil, err
	}
	signature, err := os.ReadFile(path + bundleSignatureSuffix)
	if err != nil {
		return name + ": no signature", contents, nil
	}
	decoded, err := base64.StdEncoding.DecodeString(strings.TrimSpace(string(signature)))
	if err != nil || len(decoded) != ed25519.SignatureSize {
		return name + ": malformed signature", contents, nil
	}
	if !ed25519.Verify(public, signedMessage(contents, pullRequest), decoded) {
		return name + ": signature does not match", contents, nil
	}
	return "", contents, nil
}

func manifestProblems(directory string, files []string, public ed25519.PublicKey, pullRequest uint64) ([]string, error) {
	problem, contents, err := verifySignature(filepath.Join(directory, bundleManifestName), public, pullRequest)
	if errors.Is(err, os.ErrNotExist) {
		return []string{bundleManifestName + ": missing"}, nil
	}
	if err != nil {
		return nil, err
	}
	if problem != "" {
		return []string{problem}, nil
	}
	var manifest bundleManifest
	if err := json.Unmarshal(contents, &manifest); err != nil {
		return []string{bundleManifestName + ": invalid JSON"}, nil
	}
	var problems []string
	if !buildTimePattern.MatchString(manifest.BuildTime) {
		problems = append(problems, bundleManifestName+": no ISO 8601 UTC buildTime")
	}
	if manifest.Revision == "" || manifest.Channel == "" {
		problems = append(problems, bundleManifestName+": no revision or channel")
	}
	listed := map[string]bool{}
	for _, path := range files {
		name := filepath.Base(path)
		listed[name] = true
		bundle, err := os.ReadFile(path)
		if err != nil {
			return nil, err
		}
		sum := sha512.Sum512(bundle)
		if manifest.SHA512[name] != hex.EncodeToString(sum[:]) {
			problems = append(problems, name+": SHA-512 does not match "+bundleManifestName)
		}
	}
	for name := range manifest.SHA512 {
		if !listed[name] {
			problems = append(problems, bundleManifestName+": lists "+name+", which the build lacks")
		}
	}
	sort.Strings(problems)
	return problems, nil
}

func verifySignedBuild(directory string, public ed25519.PublicKey, pullRequest uint64) ([]string, error) {
	files, err := signedBundleFiles(directory)
	if err != nil {
		return nil, err
	}
	if len(files) == 0 {
		return nil, fmt.Errorf("%s has no client bundles", directory)
	}
	problems, err := manifestProblems(directory, files, public, pullRequest)
	if err != nil {
		return nil, err
	}
	if len(problems) > 0 {
		return nil, fmt.Errorf("bundle signatures failed:\n  %s", strings.Join(problems, "\n  "))
	}
	return append(files, filepath.Join(directory, bundleManifestName)), nil
}

func bundleKeyVerifyCommand(args []string, output io.Writer) error {
	set := flag.NewFlagSet("bundle-key verify", flag.ContinueOnError)
	directory := set.String("dir", "", "client build directory holding the bundles, manifest.json and manifest.json.sig")
	publicKeyPath := set.String("public-key", "", "base64 Ed25519 public key file; defaults to the committed key for the build kind")
	pullRequest := set.Uint64("pr", 0, "pull request number the build was signed for with the PR key")
	if err := set.Parse(args); err != nil {
		return err
	}
	if *directory == "" {
		return errors.New("usage: bundle-key verify --dir <dist> [--pr <n>] [--public-key <file>]")
	}
	if *publicKeyPath == "" {
		name := bundleSigningKeyName
		if *pullRequest > 0 {
			name = pullRequestBundleSigningKeyName
		}
		*publicKeyPath = filepath.Join(repositoryRoot(), "core", "keys", name+".pub")
	}
	raw, err := os.ReadFile(*publicKeyPath)
	if err != nil {
		return fmt.Errorf("read bundle signing public key: %w", err)
	}
	public, err := parseBundleSigningPublicKey(string(raw))
	if err != nil {
		return err
	}
	files, err := verifySignedBuild(*directory, public, *pullRequest)
	if err != nil {
		return err
	}
	for _, path := range files {
		fmt.Fprintf(output, "Verified %s\n", filepath.Base(path))
	}
	return nil
}
