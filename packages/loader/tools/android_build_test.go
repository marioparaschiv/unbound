package main

import (
	"archive/zip"
	"bytes"
	"compress/gzip"
	"context"
	"crypto/sha256"
	"encoding/hex"
	"io"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"
)

const testBuildCommit = "0123456789abcdef0123456789abcdef01234567"

func zipEntries(t *testing.T, entries map[string][]byte) []byte {
	t.Helper()
	var archive bytes.Buffer
	writer := zip.NewWriter(&archive)
	for name, data := range entries {
		entry, err := writer.CreateHeader(&zip.FileHeader{Name: name, Method: zip.Store})
		if err != nil {
			t.Fatal(err)
		}
		entry.Write(data)
	}
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	return archive.Bytes()
}

// writeTestPatchedBuild writes an .apks holding a patched base, with the stock APK LSPatch keeps inside it, and one config split.
func writeTestPatchedBuild(t *testing.T, directory string) string {
	t.Helper()
	stock := testAPKBytes(t, discordTestManifest(352017, "352.17 - Stable", ""))
	base := zipEntries(t, map[string][]byte{
		"AndroidManifest.xml": discordTestManifest(patchedAPKVersionCode, "352.17 - Stable", ""),
		lspatchOriginEntry:    stock,
	})
	split := testAPKBytes(t, discordTestManifest(patchedAPKVersionCode, "", "config.arm64_v8a"))
	path := filepath.Join(directory, "Unbound.apks")
	if err := os.WriteFile(path, zipEntries(t, map[string][]byte{"base.apk": base, "config.arm64_v8a.apk": split}), 0o644); err != nil {
		t.Fatal(err)
	}
	return path
}

func TestStageAndroidBuildDescribesEverySplit(t *testing.T) {
	directory := t.TempDir()
	apks := writeTestPatchedBuild(t, directory)
	emulator := filepath.Join(directory, "config.x86_64.apk")
	writeTestAPK(t, emulator, discordTestManifest(patchedAPKVersionCode, "", "config.x86_64"))

	record, err := stageAndroidBuild(apks, []string{emulator}, directory, "stable", testBuildCommit)
	if err != nil {
		t.Fatal(err)
	}
	if record.DiscordVersion != "352.17" || record.DiscordVersionCode != 352017 {
		t.Fatalf("record = %+v", record)
	}
	var names []string
	for _, split := range record.Splits {
		names = append(names, split.Name)
		compressed, err := os.ReadFile(split.path)
		if err != nil {
			t.Fatal(err)
		}
		reader, err := gzip.NewReader(bytes.NewReader(compressed))
		if err != nil {
			t.Fatal(err)
		}
		apk, err := io.ReadAll(reader)
		if err != nil {
			t.Fatal(err)
		}
		digest := sha256.Sum256(apk)
		if hex.EncodeToString(digest[:]) != split.SHA256 || int64(len(apk)) != split.Size || int64(len(compressed)) != split.CompressedSize {
			t.Fatalf("split %s does not describe its file", split.Name)
		}
		if split.Key != "android/stable/352017/"+testBuildCommit+"/"+split.Name+".apk.gz" {
			t.Fatalf("split %s key = %s", split.Name, split.Key)
		}
	}
	if strings.Join(names, ",") != "base,config.arm64_v8a,config.x86_64" {
		t.Fatalf("splits = %v", names)
	}
}

func TestStageAndroidBuildRejectsUnpatchedSplits(t *testing.T) {
	directory := t.TempDir()
	apks := writeTestPatchedBuild(t, directory)
	stock := filepath.Join(directory, "config.xxhdpi.apk")
	writeTestAPK(t, stock, discordTestManifest(352017, "", "config.xxhdpi"))

	if _, err := stageAndroidBuild(apks, []string{stock}, directory, "stable", testBuildCommit); err == nil || !strings.Contains(err.Error(), "not a patched Discord split") {
		t.Fatalf("err = %v", err)
	}
}

type fakeBucket struct {
	mutex   sync.Mutex
	objects map[string][]byte
	puts    []string
}

func (bucket *fakeBucket) ServeHTTP(writer http.ResponseWriter, request *http.Request) {
	bucket.mutex.Lock()
	defer bucket.mutex.Unlock()
	if !strings.HasPrefix(request.Header.Get("Authorization"), "AWS4-HMAC-SHA256 Credential=key/") {
		writer.WriteHeader(http.StatusForbidden)
		return
	}
	key := strings.TrimPrefix(request.URL.Path, "/public/")
	switch request.Method {
	case http.MethodHead:
		if _, ok := bucket.objects[key]; !ok {
			writer.WriteHeader(http.StatusNotFound)
		}
	case http.MethodPut:
		body, _ := io.ReadAll(request.Body)
		digest := sha256.Sum256(body)
		if request.Header.Get("X-Amz-Content-Sha256") != hex.EncodeToString(digest[:]) {
			writer.WriteHeader(http.StatusBadRequest)
			return
		}
		bucket.objects[key] = body
		bucket.puts = append(bucket.puts, key)
	}
}

func TestUploadAndroidBuildWritesTheRecordLastAndNeverOverwrites(t *testing.T) {
	directory := t.TempDir()
	record, err := stageAndroidBuild(writeTestPatchedBuild(t, directory), nil, directory, "beta", testBuildCommit)
	if err != nil {
		t.Fatal(err)
	}
	fake := &fakeBucket{objects: map[string][]byte{}}
	server := httptest.NewServer(fake)
	defer server.Close()
	bucket := s3Bucket{endpoint: server.URL, region: "auto", bucket: "public", accessKey: "key", secretKey: "secret", client: server.Client(), now: time.Now}

	for range 2 {
		if err := uploadAndroidBuild(context.Background(), bucket, record, directory, []byte(`{}`)); err != nil {
			t.Fatal(err)
		}
	}
	prefix := "android/beta/352017/" + testBuildCommit + "/"
	want := []string{prefix + "base.apk.gz", prefix + "config.arm64_v8a.apk.gz", prefix + "build.json"}
	if strings.Join(fake.puts, ",") != strings.Join(want, ",") {
		t.Fatalf("puts = %v", fake.puts)
	}
}
