package main

import (
	"context"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func writeTestLoaderAssets(t *testing.T, version string) (deb, module string) {
	t.Helper()
	directory := t.TempDir()
	deb = filepath.Join(directory, "app.unbound.ios_"+version+"_iphoneos-arm64.deb")
	if err := os.WriteFile(deb, []byte("deb"), 0o644); err != nil {
		t.Fatal(err)
	}
	module = filepath.Join(directory, "app.unbound.android.xposed.apk")
	writeTestAPK(t, module, encodeTestManifest([]testManifestAttribute{
		{name: "versionCode", kind: binaryXMLDecimalValue, data: 1_002_000},
		{name: "versionName", kind: binaryXMLStringValue, value: version},
		{name: "package", kind: binaryXMLStringValue, value: androidModulePackage},
	}, false))
	return deb, module
}

func TestStageLoaderBuildDescribesBothAssetsUnderTheVersion(t *testing.T) {
	deb, module := writeTestLoaderAssets(t, "1.0.1003")

	record, err := stageLoaderBuild("1.0.1003", testBuildCommit, deb, module, "https://cdn.example")
	if err != nil {
		t.Fatal(err)
	}
	if len(record.Assets) != 2 || record.Assets[0].Platform != "ios" || record.Assets[1].Platform != "android" {
		t.Fatalf("assets = %+v", record.Assets)
	}
	if record.Assets[0].URL != "https://cdn.example/loader/1.0.1003/app.unbound.ios_1.0.1003_iphoneos-arm64.deb" {
		t.Fatalf("iOS URL = %s", record.Assets[0].URL)
	}
	if record.Assets[1].Key != "loader/1.0.1003/app.unbound.android.xposed.apk" || record.Assets[0].Size != 3 || len(record.Assets[0].SHA256) != 64 {
		t.Fatalf("android asset = %+v", record.Assets[1])
	}
}

func TestStageLoaderBuildRejectsAssetsOfAnotherVersion(t *testing.T) {
	deb, module := writeTestLoaderAssets(t, "1.0.0")
	if _, err := stageLoaderBuild("1.0.7", testBuildCommit, deb, module, "https://cdn.example"); err == nil || !strings.Contains(err.Error(), "not the loader 1.0.7 deb") {
		t.Fatalf("err = %v", err)
	}

	_, staleModule := writeTestLoaderAssets(t, "1.0.0")
	freshDeb, _ := writeTestLoaderAssets(t, "1.0.7")
	if _, err := stageLoaderBuild("1.0.7", testBuildCommit, freshDeb, staleModule, "https://cdn.example"); err == nil || !strings.Contains(err.Error(), "not the loader 1.0.7 module") {
		t.Fatalf("err = %v", err)
	}
}

func TestUploadLoaderBuildWritesTheRecordLastAndNeverOverwrites(t *testing.T) {
	deb, module := writeTestLoaderAssets(t, "1.0.5")
	record, err := stageLoaderBuild("1.0.5", testBuildCommit, deb, module, "https://cdn.example")
	if err != nil {
		t.Fatal(err)
	}
	fake := &fakeBucket{objects: map[string][]byte{}}
	server := httptest.NewServer(fake)
	defer server.Close()
	bucket := s3Bucket{endpoint: server.URL, region: "auto", bucket: "public", accessKey: "key", secretKey: "secret", client: server.Client(), now: time.Now}

	for range 2 {
		if err := uploadLoaderBuild(context.Background(), bucket, record, []byte(`{}`)); err != nil {
			t.Fatal(err)
		}
	}
	want := []string{
		"loader/1.0.5/app.unbound.ios_1.0.5_iphoneos-arm64.deb",
		"loader/1.0.5/app.unbound.android.xposed.apk",
		"loader/1.0.5/build.json",
	}
	if strings.Join(fake.puts, ",") != strings.Join(want, ",") {
		t.Fatalf("puts = %v", fake.puts)
	}
}
