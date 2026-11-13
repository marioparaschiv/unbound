package main

import (
	"bytes"
	"context"
	"crypto/sha1"
	"encoding/gob"
	"encoding/hex"
	"fmt"
	"io"
	"io/fs"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"sort"
	"strings"
	"sync"
)

const (
	androidFrameworkVersion = "17-robolectric-16653203"
	androidFrameworkURL     = "https://repo1.maven.org/maven2/org/robolectric/android-all/" + androidFrameworkVersion + "/android-all-" + androidFrameworkVersion + ".jar"
	iosRuntimeIndexVersion  = "2"
)

var iosRuntimeLibraries = []string{
	"System/Library/Frameworks",
	"System/Library/PrivateFrameworks",
	"usr/lib",
}

func cachedAndroidFramework(ctx context.Context, cache string) (string, error) {
	path := filepath.Join(cache, "android-framework", "android-all-"+androidFrameworkVersion+".jar")
	if _, err := os.Stat(path); err == nil {
		return path, nil
	}
	expected, err := httpText(ctx, androidFrameworkURL+".sha1")
	if err != nil {
		return "", fmt.Errorf("Android framework checksum: %w", err)
	}
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return "", err
	}
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, androidFrameworkURL, nil)
	if err != nil {
		return "", err
	}
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		return "", err
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return "", fmt.Errorf("Android framework download returned HTTP %d", response.StatusCode)
	}
	partial := path + ".partial"
	file, err := os.Create(partial)
	if err != nil {
		return "", err
	}
	digest := sha1.New()
	if _, err := io.Copy(io.MultiWriter(file, digest), response.Body); err != nil {
		file.Close()
		return "", err
	}
	if err := file.Close(); err != nil {
		return "", err
	}
	if got := hex.EncodeToString(digest.Sum(nil)); got != strings.Fields(expected)[0] {
		os.Remove(partial)
		return "", fmt.Errorf("Android framework checksum mismatch: got %s", got)
	}
	return path, os.Rename(partial, path)
}

func httpText(ctx context.Context, url string) (string, error) {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return "", err
	}
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		return "", err
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return "", fmt.Errorf("HTTP %d", response.StatusCode)
	}
	body, err := io.ReadAll(response.Body)
	return strings.TrimSpace(string(body)), err
}

func mergeJavaFrameworkIndex(into, from *javaFrameworkIndex) {
	for name, class := range from.Classes {
		if existing := into.Classes[name]; existing != nil {
			for method, signatures := range class.Methods {
				existing.Methods[method] = appendUnique(existing.Methods[method], signatures...)
			}
			for field := range class.Fields {
				existing.Fields[field] = true
			}
			continue
		}
		into.Classes[name] = class
	}
	for name := range from.MethodNames {
		into.MethodNames[name] = true
	}
	for name := range from.FieldNames {
		into.FieldNames[name] = true
	}
}

func appendUnique(list []string, values ...string) []string {
	for _, value := range values {
		found := false
		for _, existing := range list {
			if existing == value {
				found = true
				break
			}
		}
		if !found {
			list = append(list, value)
		}
	}
	return list
}

func discoverIOSRuntime() string {
	patterns := []string{
		"/Library/Developer/CoreSimulator/Volumes/*/Library/Developer/CoreSimulator/Profiles/Runtimes/iOS*.simruntime",
		"/Library/Developer/CoreSimulator/Profiles/Runtimes/iOS*.simruntime",
	}
	var runtimes []string
	for _, pattern := range patterns {
		matches, _ := filepath.Glob(pattern)
		runtimes = append(runtimes, matches...)
	}
	sort.Slice(runtimes, func(i, j int) bool {
		return compareVersions(runtimeVersion(runtimes[i]), runtimeVersion(runtimes[j])) > 0
	})
	for _, candidate := range runtimes {
		root := filepath.Join(candidate, "Contents", "Resources", "RuntimeRoot")
		if hasPlainFrameworks(root) || sharedCachePath(root) != "" {
			return root
		}
	}
	return ""
}

func runtimeVersion(path string) string {
	name := strings.TrimSuffix(filepath.Base(path), ".simruntime")
	return strings.TrimSpace(strings.TrimPrefix(name, "iOS"))
}

func uikitCore(root string) string {
	return filepath.Join(root, "System", "Library", "PrivateFrameworks", "UIKitCore.framework", "UIKitCore")
}

func hasPlainFrameworks(root string) bool {
	_, err := os.Stat(uikitCore(root))
	return err == nil
}

func sharedCachePath(root string) string {
	path := filepath.Join(root, "System", "Library", "Caches", "com.apple.dyld", "dyld_sim_shared_cache_arm64")
	if _, err := os.Stat(path); err != nil {
		return ""
	}
	return path
}

const extractSharedCacheScript = `import Foundation
typealias Extract = @convention(c) (UnsafePointer<CChar>, UnsafePointer<CChar>, @convention(block) (UInt32, UInt32) -> Void) -> Int32
let arguments = CommandLine.arguments
guard let handle = dlopen(arguments[1], RTLD_NOW), let symbol = dlsym(handle, "dyld_shared_cache_extract_dylibs_progress") else { exit(2) }
let extract = unsafeBitCast(symbol, to: Extract.self)
exit(extract(arguments[2], arguments[3], { _, _ in }))
`

func dscExtractor() string {
	output, err := exec.Command("xcrun", "--sdk", "iphoneos", "--show-sdk-platform-path").Output()
	if err == nil {
		path := filepath.Join(strings.TrimSpace(string(output)), "usr", "lib", "dsc_extractor.bundle")
		if _, err := os.Stat(path); err == nil {
			return path
		}
	}
	if _, err := os.Stat("/usr/lib/dsc_extractor.bundle"); err == nil {
		return "/usr/lib/dsc_extractor.bundle"
	}
	return ""
}

func extractSharedCache(cachePath, destination string) error {
	extractor := dscExtractor()
	if extractor == "" {
		return fmt.Errorf("no dsc_extractor.bundle to unpack %s", cachePath)
	}
	script := filepath.Join(destination, "extract.swift")
	if err := os.MkdirAll(destination, 0o755); err != nil {
		return err
	}
	if err := os.WriteFile(script, []byte(extractSharedCacheScript), 0o644); err != nil {
		return err
	}
	command := exec.Command("xcrun", "swift", script, extractor, cachePath, destination)
	command.Stderr = os.Stderr
	if err := command.Run(); err != nil {
		return fmt.Errorf("extracting %s: %w", cachePath, err)
	}
	return nil
}

func loadIOSRuntimeIndex(root, cache string) (*objcIndex, error) {
	stamp, err := iosRuntimeStamp(root)
	if err != nil {
		return nil, err
	}
	cachePath := filepath.Join(cache, "ios-runtime", stamp+".gob")
	if index, err := readObjCIndexCache(cachePath); err == nil {
		return index, nil
	}
	libraries := root
	if !hasPlainFrameworks(root) {
		libraries = filepath.Join(cache, "ios-runtime", stamp+"-extracted")
		defer os.RemoveAll(libraries)
		if err := extractSharedCache(sharedCachePath(root), libraries); err != nil {
			return nil, err
		}
	}
	index, err := indexIOSRuntime(libraries)
	if err != nil {
		return nil, err
	}
	if err := writeObjCIndexCache(cachePath, index); err != nil {
		fmt.Fprintln(os.Stderr, "compat-scan: could not cache the iOS runtime index:", err)
	}
	return index, nil
}

func iosRuntimeStamp(root string) (string, error) {
	marker := uikitCore(root)
	if !hasPlainFrameworks(root) {
		marker = sharedCachePath(root)
	}
	info, err := os.Stat(marker)
	if err != nil {
		return "", fmt.Errorf("iOS runtime at %s has neither UIKitCore nor a shared cache: %w", root, err)
	}
	digest := sha1.Sum([]byte(fmt.Sprintf("%s|%s|%d|%d", iosRuntimeIndexVersion, root, info.Size(), info.ModTime().Unix())))
	return hex.EncodeToString(digest[:8]), nil
}

func indexIOSRuntime(root string) (*objcIndex, error) {
	var paths []string
	for _, library := range iosRuntimeLibraries {
		filepath.WalkDir(filepath.Join(root, library), func(path string, entry fs.DirEntry, err error) error {
			if err != nil || entry.IsDir() {
				return nil
			}
			info, err := entry.Info()
			if err == nil && info.Mode().IsRegular() && info.Size() > 4096 && filepath.Ext(path) != ".swift" {
				paths = append(paths, path)
			}
			return nil
		})
	}
	partials := make(chan *objcIndex, len(paths))
	work := make(chan string)
	var group sync.WaitGroup
	for worker := 0; worker < runtime.NumCPU(); worker++ {
		group.Add(1)
		go func() {
			defer group.Done()
			for path := range work {
				data, err := os.ReadFile(path)
				if err != nil || !isMachO(data) {
					continue
				}
				index := newObjCIndex()
				if addMachOToIndex(index, data) == nil {
					partials <- index
				}
			}
		}()
	}
	for _, path := range paths {
		work <- path
	}
	close(work)
	group.Wait()
	close(partials)
	merged := newObjCIndex()
	for partial := range partials {
		mergeObjCIndex(merged, partial)
	}
	for _, class := range merged.Classes {
		for method := range class.Methods {
			merged.Selectors[method] = true
		}
		for ivar := range class.Ivars {
			merged.Ivars[ivar] = true
		}
	}
	if len(merged.Classes) == 0 {
		return nil, fmt.Errorf("no Objective-C classes in the iOS runtime at %s", root)
	}
	return merged, nil
}

func mergeObjCIndex(into, from *objcIndex) {
	for name, class := range from.Classes {
		if existing := into.Classes[name]; existing != nil {
			for method := range class.Methods {
				existing.Methods[method] = true
			}
			for ivar := range class.Ivars {
				existing.Ivars[ivar] = true
			}
			continue
		}
		into.Classes[name] = class
	}
	for selector := range from.Selectors {
		into.Selectors[selector] = true
	}
	for ivar := range from.Ivars {
		into.Ivars[ivar] = true
	}
}

func readObjCIndexCache(path string) (*objcIndex, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}
	index := newObjCIndex()
	return index, gob.NewDecoder(bytes.NewReader(data)).Decode(index)
}

func writeObjCIndexCache(path string, index *objcIndex) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		return err
	}
	var buffer bytes.Buffer
	if err := gob.NewEncoder(&buffer).Encode(index); err != nil {
		return err
	}
	return os.WriteFile(path, buffer.Bytes(), 0o644)
}

func (target *compatTarget) systemChainDeclares(className, selector string) bool {
	if target.system == nil {
		return false
	}
	if target.system.Classes[className] != nil && target.system.Selectors[selector] {
		return true
	}
	visited := map[string]bool{}
	for current := target.system.Classes[className]; current != nil && !visited[current.Name]; current = target.system.Classes[current.Super] {
		visited[current.Name] = true
		if current.Methods[selector] {
			return true
		}
		if category := target.system.Classes["category:"+current.Name]; category != nil && category.Methods[selector] {
			return true
		}
	}
	return false
}
