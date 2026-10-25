package main

import (
	"archive/zip"
	"encoding/binary"
	"errors"
	"fmt"
	"strconv"
	"unicode/utf16"
)

const (
	binaryXMLDocument      = 0x0003
	binaryXMLStringPool    = 0x0001
	binaryXMLResourceMap   = 0x0180
	binaryXMLStartElement  = 0x0102
	binaryXMLUTF8Flag      = 0x100
	binaryXMLNoIndex       = 0xffffffff
	binaryXMLStringValue   = 0x03
	binaryXMLDecimalValue  = 0x10
	binaryXMLHexValue      = 0x11
	androidVersionCodeAttr = 0x0101021b
	androidVersionNameAttr = 0x0101021c
)

type apkManifest struct {
	Package     string
	VersionCode int
	VersionName string
	Split       string
}

type binaryXMLAttribute struct {
	name     string
	resource uint32
	raw      uint32
	kind     uint8
	data     uint32
}

func readAPKManifest(path string) (apkManifest, error) {
	archive, err := zip.OpenReader(path)
	if err != nil {
		return apkManifest{}, err
	}
	defer archive.Close()
	for _, file := range archive.File {
		if file.Name != "AndroidManifest.xml" {
			continue
		}
		data, err := readZipEntry(file)
		if err != nil {
			return apkManifest{}, err
		}
		return parseBinaryManifest(data)
	}
	return apkManifest{}, errors.New("the APK has no AndroidManifest.xml")
}

func parseBinaryManifest(data []byte) (apkManifest, error) {
	if len(data) < 8 || binary.LittleEndian.Uint16(data) != binaryXMLDocument {
		return apkManifest{}, errors.New("AndroidManifest.xml is not binary XML")
	}
	var pool []string
	var resources []uint32
	offset := int(binary.LittleEndian.Uint16(data[2:]))
	for offset+8 <= len(data) {
		kind := binary.LittleEndian.Uint16(data[offset:])
		headerSize := int(binary.LittleEndian.Uint16(data[offset+2:]))
		size := int(binary.LittleEndian.Uint32(data[offset+4:]))
		if size < 8 || headerSize < 8 || offset+size > len(data) {
			return apkManifest{}, fmt.Errorf("malformed binary XML chunk at %d", offset)
		}
		chunk := data[offset : offset+size]
		switch kind {
		case binaryXMLStringPool:
			parsed, err := parseBinaryXMLStrings(chunk, headerSize)
			if err != nil {
				return apkManifest{}, err
			}
			pool = parsed
		case binaryXMLResourceMap:
			for position := headerSize; position+4 <= len(chunk); position += 4 {
				resources = append(resources, binary.LittleEndian.Uint32(chunk[position:]))
			}
		case binaryXMLStartElement:
			name, attributes, err := parseBinaryXMLElement(chunk, headerSize, pool, resources)
			if err != nil {
				return apkManifest{}, err
			}
			if name != "manifest" {
				return apkManifest{}, fmt.Errorf("the root element is %q, not manifest", name)
			}
			return manifestFromAttributes(attributes, pool)
		}
		offset += size
	}
	return apkManifest{}, errors.New("AndroidManifest.xml has no manifest element")
}

func parseBinaryXMLStrings(chunk []byte, headerSize int) ([]string, error) {
	if headerSize < 28 || len(chunk) < headerSize {
		return nil, errors.New("malformed binary XML string pool")
	}
	count := int(binary.LittleEndian.Uint32(chunk[8:]))
	flags := binary.LittleEndian.Uint32(chunk[16:])
	start := int(binary.LittleEndian.Uint32(chunk[20:]))
	if headerSize+count*4 > len(chunk) || start > len(chunk) {
		return nil, errors.New("binary XML string pool overflows its chunk")
	}
	values := make([]string, count)
	for index := range values {
		position := start + int(binary.LittleEndian.Uint32(chunk[headerSize+index*4:]))
		var value string
		var err error
		if flags&binaryXMLUTF8Flag != 0 {
			value, err = decodeBinaryXMLUTF8(chunk, position)
		} else {
			value, err = decodeBinaryXMLUTF16(chunk, position)
		}
		if err != nil {
			return nil, fmt.Errorf("binary XML string %d: %w", index, err)
		}
		values[index] = value
	}
	return values, nil
}

func decodeBinaryXMLUTF8(chunk []byte, position int) (string, error) {
	readLength := func() (int, error) {
		if position >= len(chunk) {
			return 0, errors.New("truncated length")
		}
		length := int(chunk[position])
		position++
		if length&0x80 != 0 {
			if position >= len(chunk) {
				return 0, errors.New("truncated length")
			}
			length = (length&0x7f)<<8 | int(chunk[position])
			position++
		}
		return length, nil
	}
	if _, err := readLength(); err != nil {
		return "", err
	}
	length, err := readLength()
	if err != nil {
		return "", err
	}
	if position+length > len(chunk) {
		return "", errors.New("truncated string")
	}
	return string(chunk[position : position+length]), nil
}

func decodeBinaryXMLUTF16(chunk []byte, position int) (string, error) {
	if position+2 > len(chunk) {
		return "", errors.New("truncated length")
	}
	length := int(binary.LittleEndian.Uint16(chunk[position:]))
	position += 2
	if length&0x8000 != 0 {
		if position+2 > len(chunk) {
			return "", errors.New("truncated length")
		}
		length = (length&0x7fff)<<16 | int(binary.LittleEndian.Uint16(chunk[position:]))
		position += 2
	}
	if position+length*2 > len(chunk) {
		return "", errors.New("truncated string")
	}
	units := make([]uint16, length)
	for index := range units {
		units[index] = binary.LittleEndian.Uint16(chunk[position+index*2:])
	}
	return string(utf16.Decode(units)), nil
}

func parseBinaryXMLElement(chunk []byte, headerSize int, pool []string, resources []uint32) (string, []binaryXMLAttribute, error) {
	if headerSize+20 > len(chunk) {
		return "", nil, errors.New("malformed binary XML element")
	}
	element := chunk[headerSize:]
	name := binaryXMLString(pool, binary.LittleEndian.Uint32(element[4:]))
	attributeStart := int(binary.LittleEndian.Uint16(element[8:]))
	attributeSize := int(binary.LittleEndian.Uint16(element[10:]))
	attributeCount := int(binary.LittleEndian.Uint16(element[12:]))
	if attributeSize < 20 || attributeStart+attributeCount*attributeSize > len(element) {
		return "", nil, errors.New("binary XML attributes overflow their element")
	}
	attributes := make([]binaryXMLAttribute, attributeCount)
	for index := range attributes {
		entry := element[attributeStart+index*attributeSize:]
		nameIndex := binary.LittleEndian.Uint32(entry[4:])
		attribute := binaryXMLAttribute{
			name: binaryXMLString(pool, nameIndex),
			raw:  binary.LittleEndian.Uint32(entry[8:]),
			kind: entry[15],
			data: binary.LittleEndian.Uint32(entry[16:]),
		}
		if int(nameIndex) < len(resources) {
			attribute.resource = resources[nameIndex]
		}
		attributes[index] = attribute
	}
	return name, attributes, nil
}

func binaryXMLString(pool []string, index uint32) string {
	if index == binaryXMLNoIndex || int(index) >= len(pool) {
		return ""
	}
	return pool[index]
}

func (attribute binaryXMLAttribute) text(pool []string) string {
	if attribute.raw != binaryXMLNoIndex {
		return binaryXMLString(pool, attribute.raw)
	}
	if attribute.kind == binaryXMLStringValue {
		return binaryXMLString(pool, attribute.data)
	}
	return ""
}

func manifestFromAttributes(attributes []binaryXMLAttribute, pool []string) (apkManifest, error) {
	var manifest apkManifest
	for _, attribute := range attributes {
		switch {
		case attribute.resource == androidVersionCodeAttr || attribute.resource == 0 && attribute.name == "versionCode":
			switch attribute.kind {
			case binaryXMLDecimalValue, binaryXMLHexValue:
				manifest.VersionCode = int(attribute.data)
			default:
				code, err := strconv.Atoi(attribute.text(pool))
				if err != nil {
					return apkManifest{}, fmt.Errorf("unreadable versionCode: %w", err)
				}
				manifest.VersionCode = code
			}
		case attribute.resource == androidVersionNameAttr || attribute.resource == 0 && attribute.name == "versionName":
			manifest.VersionName = attribute.text(pool)
		case attribute.name == "package":
			manifest.Package = attribute.text(pool)
		case attribute.name == "split":
			manifest.Split = attribute.text(pool)
		}
	}
	if manifest.Package == "" {
		return apkManifest{}, errors.New("the manifest names no package")
	}
	return manifest, nil
}
