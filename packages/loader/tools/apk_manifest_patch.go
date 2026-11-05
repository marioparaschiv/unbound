package main

import (
	"bytes"
	"encoding/binary"
	"errors"
	"fmt"
	"unicode/utf16"
)

const (
	binaryXMLEndElement    = 0x0103
	binaryXMLSortedFlag    = 0x1
	androidNameAttr        = 0x01010003
	usesPermissionElement  = "uses-permission"
	requestInstallPackages = "android.permission.REQUEST_INSTALL_PACKAGES"
)

type binaryXMLChunk struct {
	kind       uint16
	headerSize int
	data       []byte
}

type binaryXMLDocumentParts struct {
	chunks    []binaryXMLChunk
	pool      []string
	resources []uint32
}

// patchBinaryManifest returns data with the manifest's versionCode set to versionCode and, when permission is not empty, a uses-permission element for it.
func patchBinaryManifest(data []byte, versionCode uint32, permission string) ([]byte, error) {
	document, err := splitBinaryXML(data)
	if err != nil {
		return nil, err
	}
	if err := setManifestVersionCode(document, versionCode); err != nil {
		return nil, err
	}
	if permission != "" && !document.hasPermission(permission) {
		if err := document.addPermission(permission); err != nil {
			return nil, err
		}
	}
	return document.encode(), nil
}

func splitBinaryXML(data []byte) (*binaryXMLDocumentParts, error) {
	if len(data) < 8 || binary.LittleEndian.Uint16(data) != binaryXMLDocument {
		return nil, errors.New("AndroidManifest.xml is not binary XML")
	}
	document := &binaryXMLDocumentParts{}
	offset := int(binary.LittleEndian.Uint16(data[2:]))
	for offset+8 <= len(data) {
		kind := binary.LittleEndian.Uint16(data[offset:])
		headerSize := int(binary.LittleEndian.Uint16(data[offset+2:]))
		size := int(binary.LittleEndian.Uint32(data[offset+4:]))
		if size < 8 || headerSize < 8 || offset+size > len(data) {
			return nil, fmt.Errorf("malformed binary XML chunk at %d", offset)
		}
		chunk := binaryXMLChunk{kind: kind, headerSize: headerSize, data: bytes.Clone(data[offset : offset+size])}
		switch kind {
		case binaryXMLStringPool:
			pool, err := parseBinaryXMLStrings(chunk.data, headerSize)
			if err != nil {
				return nil, err
			}
			document.pool = pool
		case binaryXMLResourceMap:
			for position := headerSize; position+4 <= size; position += 4 {
				document.resources = append(document.resources, binary.LittleEndian.Uint32(chunk.data[position:]))
			}
		}
		document.chunks = append(document.chunks, chunk)
		offset += size
	}
	return document, nil
}

func (document *binaryXMLDocumentParts) encode() []byte {
	var body bytes.Buffer
	for _, chunk := range document.chunks {
		body.Write(chunk.data)
	}
	header := make([]byte, 8, 8+body.Len())
	binary.LittleEndian.PutUint16(header, binaryXMLDocument)
	binary.LittleEndian.PutUint16(header[2:], 8)
	binary.LittleEndian.PutUint32(header[4:], uint32(8+body.Len()))
	return append(header, body.Bytes()...)
}

// attribute returns the offset within chunk of the element's attribute with the given resource id, or -1.
func (document *binaryXMLDocumentParts) attribute(chunk binaryXMLChunk, resource uint32) int {
	element := chunk.headerSize
	if element+20 > len(chunk.data) {
		return -1
	}
	start := element + int(binary.LittleEndian.Uint16(chunk.data[element+8:]))
	size := int(binary.LittleEndian.Uint16(chunk.data[element+10:]))
	count := int(binary.LittleEndian.Uint16(chunk.data[element+12:]))
	if size < 20 || start+count*size > len(chunk.data) {
		return -1
	}
	for index := range count {
		offset := start + index*size
		name := binary.LittleEndian.Uint32(chunk.data[offset+4:])
		if int(name) < len(document.resources) && document.resources[name] == resource {
			return offset
		}
	}
	return -1
}

func (document *binaryXMLDocumentParts) elementName(chunk binaryXMLChunk) string {
	if chunk.headerSize+8 > len(chunk.data) {
		return ""
	}
	return binaryXMLString(document.pool, binary.LittleEndian.Uint32(chunk.data[chunk.headerSize+4:]))
}

func setManifestVersionCode(document *binaryXMLDocumentParts, versionCode uint32) error {
	for _, chunk := range document.chunks {
		if chunk.kind != binaryXMLStartElement {
			continue
		}
		if name := document.elementName(chunk); name != "manifest" {
			return fmt.Errorf("the root element is %q, not manifest", name)
		}
		offset := document.attribute(chunk, androidVersionCodeAttr)
		if offset < 0 {
			return errors.New("the manifest has no versionCode")
		}
		binary.LittleEndian.PutUint32(chunk.data[offset+8:], binaryXMLNoIndex)
		chunk.data[offset+15] = binaryXMLDecimalValue
		binary.LittleEndian.PutUint32(chunk.data[offset+16:], versionCode)
		return nil
	}
	return errors.New("AndroidManifest.xml has no manifest element")
}

func (document *binaryXMLDocumentParts) hasPermission(permission string) bool {
	for _, chunk := range document.chunks {
		if chunk.kind != binaryXMLStartElement || document.elementName(chunk) != usesPermissionElement {
			continue
		}
		offset := document.attribute(chunk, androidNameAttr)
		if offset >= 0 && binaryXMLString(document.pool, binary.LittleEndian.Uint32(chunk.data[offset+16:])) == permission {
			return true
		}
	}
	return false
}

// addPermission copies the first uses-permission element and its end tag right after it, naming the copy permission.
func (document *binaryXMLDocumentParts) addPermission(permission string) error {
	start := -1
	for index, chunk := range document.chunks {
		if chunk.kind == binaryXMLStartElement && document.elementName(chunk) == usesPermissionElement {
			start = index
			break
		}
	}
	if start < 0 || start+1 >= len(document.chunks) || document.chunks[start+1].kind != binaryXMLEndElement {
		return errors.New("the manifest has no empty uses-permission element to copy")
	}
	nameOffset := document.attribute(document.chunks[start], androidNameAttr)
	if nameOffset < 0 {
		return errors.New("the uses-permission element has no android:name")
	}
	index, err := document.appendString(permission)
	if err != nil {
		return err
	}
	element := binaryXMLChunk{kind: binaryXMLStartElement, headerSize: document.chunks[start].headerSize, data: bytes.Clone(document.chunks[start].data)}
	binary.LittleEndian.PutUint32(element.data[nameOffset+8:], index)
	element.data[nameOffset+15] = binaryXMLStringValue
	binary.LittleEndian.PutUint32(element.data[nameOffset+16:], index)
	end := document.chunks[start+1]
	end.data = bytes.Clone(end.data)
	document.chunks = append(document.chunks[:start+2], append([]binaryXMLChunk{element, end}, document.chunks[start+2:]...)...)
	return nil
}

// appendString adds value at the end of the string pool and returns its index; existing indices stay valid.
func (document *binaryXMLDocumentParts) appendString(value string) (uint32, error) {
	for position, chunk := range document.chunks {
		if chunk.kind != binaryXMLStringPool {
			continue
		}
		old := chunk.data
		count := int(binary.LittleEndian.Uint32(old[8:]))
		styles := binary.LittleEndian.Uint32(old[12:])
		flags := binary.LittleEndian.Uint32(old[16:])
		stringsStart := int(binary.LittleEndian.Uint32(old[20:]))
		if styles != 0 {
			return 0, errors.New("the manifest string pool has styles")
		}
		offsetsEnd := chunk.headerSize + count*4
		encoded := encodeBinaryXMLString(value, flags&binaryXMLUTF8Flag != 0)
		data := make([]byte, 0, len(old)+4+len(encoded)+3)
		data = append(data, old[:offsetsEnd]...)
		data = binary.LittleEndian.AppendUint32(data, uint32(len(old)-stringsStart))
		data = append(data, old[offsetsEnd:]...)
		data = append(data, encoded...)
		for len(data)%4 != 0 {
			data = append(data, 0)
		}
		binary.LittleEndian.PutUint32(data[4:], uint32(len(data)))
		binary.LittleEndian.PutUint32(data[8:], uint32(count+1))
		binary.LittleEndian.PutUint32(data[16:], flags&^binaryXMLSortedFlag)
		binary.LittleEndian.PutUint32(data[20:], uint32(stringsStart+4))
		document.chunks[position].data = data
		document.pool = append(document.pool, value)
		return uint32(count), nil
	}
	return 0, errors.New("AndroidManifest.xml has no string pool")
}

func encodeBinaryXMLString(value string, utf8Pool bool) []byte {
	units := utf16.Encode([]rune(value))
	var out []byte
	if utf8Pool {
		out = appendBinaryXMLUTF8Length(out, len(units))
		out = appendBinaryXMLUTF8Length(out, len(value))
		out = append(out, value...)
		return append(out, 0)
	}
	if len(units) > 0x7fff {
		out = binary.LittleEndian.AppendUint16(out, uint16(len(units)>>16)|0x8000)
	}
	out = binary.LittleEndian.AppendUint16(out, uint16(len(units)))
	for _, unit := range units {
		out = binary.LittleEndian.AppendUint16(out, unit)
	}
	return binary.LittleEndian.AppendUint16(out, 0)
}

func appendBinaryXMLUTF8Length(out []byte, length int) []byte {
	if length > 0x7f {
		out = append(out, byte(length>>8)|0x80)
	}
	return append(out, byte(length))
}
