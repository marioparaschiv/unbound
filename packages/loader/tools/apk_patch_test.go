package main

import (
	"archive/zip"
	"bytes"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/binary"
	"encoding/pem"
	"math/big"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"testing"
	"time"
)

// permissionTestManifest encodes <manifest package versionCode><uses-permission android:name/>...</manifest>.
func permissionTestManifest(code uint32, split string, utf8Pool bool, permissions ...string) []byte {
	pool := []string{"versionCode", "name", "manifest", "package", "split", "uses-permission", discordAndroidPackage, split}
	pool = append(pool, permissions...)
	var strings []byte
	offsets := make([]uint32, len(pool))
	for index, value := range pool {
		offsets[index] = uint32(len(strings))
		strings = append(strings, encodeBinaryXMLString(value, utf8Pool)...)
	}
	for len(strings)%4 != 0 {
		strings = append(strings, 0)
	}
	flags := uint32(0)
	if utf8Pool {
		flags = binaryXMLUTF8Flag
	}
	stringsStart := 28 + 4*len(pool)
	chunk := func(kind, headerSize uint16, body ...[]byte) []byte {
		data := binary.LittleEndian.AppendUint16(nil, kind)
		data = binary.LittleEndian.AppendUint16(data, headerSize)
		size := 8
		for _, part := range body {
			size += len(part)
		}
		data = binary.LittleEndian.AppendUint32(data, uint32(size))
		return concatBytes(append([][]byte{data}, body...)...)
	}
	u32 := func(values ...uint32) []byte {
		var data []byte
		for _, value := range values {
			data = binary.LittleEndian.AppendUint32(data, value)
		}
		return data
	}
	attribute := func(name uint32, kind uint8, data uint32) []byte {
		raw := uint32(binaryXMLNoIndex)
		if kind == binaryXMLStringValue {
			raw = data
		}
		entry := u32(binaryXMLNoIndex, name, raw)
		entry = append(entry, 8, 0, 0, kind)
		return binary.LittleEndian.AppendUint32(entry, data)
	}
	element := func(name uint32, attributes ...[]byte) []byte {
		header := u32(1, binaryXMLNoIndex, binaryXMLNoIndex, name)
		header = binary.LittleEndian.AppendUint16(header, 20)
		header = binary.LittleEndian.AppendUint16(header, 20)
		header = binary.LittleEndian.AppendUint16(header, uint16(len(attributes)))
		header = append(header, 0, 0, 0, 0, 0, 0)
		return chunk(binaryXMLStartElement, 16, append([][]byte{header}, attributes...)...)
	}
	end := func(name uint32) []byte {
		return chunk(binaryXMLEndElement, 16, u32(1, binaryXMLNoIndex, binaryXMLNoIndex, name))
	}

	manifestAttributes := [][]byte{attribute(0, binaryXMLDecimalValue, code), attribute(3, binaryXMLStringValue, 6)}
	if split != "" {
		manifestAttributes = append(manifestAttributes, attribute(4, binaryXMLStringValue, 7))
	}
	body := [][]byte{
		chunk(binaryXMLStringPool, 28, u32(uint32(len(pool)), 0, flags, uint32(stringsStart), 0), u32(offsets...), strings),
		chunk(binaryXMLResourceMap, 8, u32(androidVersionCodeAttr, androidNameAttr)),
		element(2, manifestAttributes...),
	}
	for index := range permissions {
		body = append(body, element(5, attribute(1, binaryXMLStringValue, uint32(8+index))), end(5))
	}
	body = append(body, end(2))
	return chunk(binaryXMLDocument, 8, body...)
}

func manifestPermissions(t *testing.T, data []byte) []string {
	t.Helper()
	document, err := splitBinaryXML(data)
	if err != nil {
		t.Fatal(err)
	}
	var names []string
	for _, chunk := range document.chunks {
		if chunk.kind == binaryXMLStartElement && document.elementName(chunk) == usesPermissionElement {
			offset := document.attribute(chunk, androidNameAttr)
			names = append(names, binaryXMLString(document.pool, binary.LittleEndian.Uint32(chunk.data[offset+16:])))
		}
	}
	sort.Strings(names)
	return names
}

func TestPatchBinaryManifestPinsVersionCodeAndAddsThePermissionOnce(t *testing.T) {
	for _, utf8Pool := range []bool{false, true} {
		original := permissionTestManifest(352017, "", utf8Pool, "android.permission.INTERNET")
		patched, err := patchBinaryManifest(original, patchedAPKVersionCode, requestInstallPackages)
		if err != nil {
			t.Fatal(err)
		}
		manifest, err := parseBinaryManifest(patched)
		if err != nil {
			t.Fatal(err)
		}
		if manifest.VersionCode != patchedAPKVersionCode || manifest.Package != discordAndroidPackage {
			t.Fatalf("utf8=%v: manifest = %+v", utf8Pool, manifest)
		}
		if got := manifestPermissions(t, patched); len(got) != 2 || got[0] != "android.permission.INTERNET" || got[1] != requestInstallPackages {
			t.Fatalf("utf8=%v: permissions = %v", utf8Pool, got)
		}
		again, err := patchBinaryManifest(patched, patchedAPKVersionCode, requestInstallPackages)
		if err != nil {
			t.Fatal(err)
		}
		if !bytes.Equal(again, patched) {
			t.Fatalf("utf8=%v: patching twice changed the manifest", utf8Pool)
		}
	}
}

func TestPatchBinaryManifestLeavesSplitPermissionsAlone(t *testing.T) {
	patched, err := patchBinaryManifest(permissionTestManifest(352017, "config.en", false), patchedAPKVersionCode, "")
	if err != nil {
		t.Fatal(err)
	}
	manifest, err := parseBinaryManifest(patched)
	if err != nil {
		t.Fatal(err)
	}
	if manifest.VersionCode != patchedAPKVersionCode || manifest.Split != "config.en" || len(manifestPermissions(t, patched)) != 0 {
		t.Fatalf("manifest = %+v", manifest)
	}
}

func writeTestSigner(t *testing.T, path string) apkSigner {
	t.Helper()
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	template := &x509.Certificate{SerialNumber: big.NewInt(1), Subject: pkix.Name{CommonName: "test"}, NotBefore: time.Now(), NotAfter: time.Now().Add(time.Hour)}
	certificate, err := x509.CreateCertificate(rand.Reader, template, template, key.Public(), key)
	if err != nil {
		t.Fatal(err)
	}
	der, err := x509.MarshalPKCS8PrivateKey(key)
	if err != nil {
		t.Fatal(err)
	}
	data := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: certificate})
	data = append(data, pem.EncodeToMemory(&pem.Block{Type: "PRIVATE KEY", Bytes: der})...)
	if err := os.WriteFile(path, data, 0o600); err != nil {
		t.Fatal(err)
	}
	signer, err := readAPKSigner(path)
	if err != nil {
		t.Fatal(err)
	}
	return signer
}

func TestPatchAPKKeepsOtherEntriesInPlaceAndSigns(t *testing.T) {
	directory := t.TempDir()
	signer := writeTestSigner(t, filepath.Join(directory, "signer.pem"))
	var archive bytes.Buffer
	writer := zip.NewWriter(&archive)
	payload, err := writer.CreateHeader(&zip.FileHeader{Name: "assets/lspatch/origin.apk", Method: zip.Store})
	if err != nil {
		t.Fatal(err)
	}
	payload.Write(bytes.Repeat([]byte("origin"), 1<<18))
	manifest, err := writer.Create("AndroidManifest.xml")
	if err != nil {
		t.Fatal(err)
	}
	manifest.Write(permissionTestManifest(351011, "", false, "android.permission.INTERNET"))
	if err := writer.Close(); err != nil {
		t.Fatal(err)
	}
	path := filepath.Join(directory, "base.apk")
	if err := os.WriteFile(path, archive.Bytes(), 0o644); err != nil {
		t.Fatal(err)
	}
	original, err := readZipLayout(archive.Bytes())
	if err != nil {
		t.Fatal(err)
	}

	for range 2 {
		if err := patchAPK(path, patchedAPKVersionCode, signer); err != nil {
			t.Fatal(err)
		}
	}
	data, err := os.ReadFile(path)
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Equal(data[:original.entriesEnd], archive.Bytes()[:original.entriesEnd]) {
		t.Fatal("patching moved or changed the original entries")
	}
	if apkSigningBlockStart(data, int(binary.LittleEndian.Uint32(data[len(data)-zipEndSize+16:]))) < 0 {
		t.Fatal("the patched APK has no signing block")
	}
	identity, err := readAPKManifest(path)
	if err != nil {
		t.Fatal(err)
	}
	if identity.VersionCode != patchedAPKVersionCode {
		t.Fatalf("versionCode = %d", identity.VersionCode)
	}
	verifyWithAPKSigner(t, path)
}

// verifyWithAPKSigner runs the Android SDK's apksigner on path when the SDK is installed.
func verifyWithAPKSigner(t *testing.T, path string) {
	t.Helper()
	home := os.Getenv("ANDROID_HOME")
	if home == "" {
		home = filepath.Join(os.Getenv("HOME"), "Android", "Sdk")
	}
	candidates, _ := filepath.Glob(filepath.Join(home, "build-tools", "*", "apksigner"))
	if len(candidates) == 0 {
		t.Log("apksigner not installed; skipping the SDK verification")
		return
	}
	sort.Strings(candidates)
	output, err := exec.Command(candidates[len(candidates)-1], "verify", "--min-sdk-version", "28", path).CombinedOutput()
	if err != nil {
		t.Fatalf("apksigner rejected the APK: %v\n%s", err, output)
	}
}
