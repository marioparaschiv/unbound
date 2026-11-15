package main

import (
	"encoding/base64"
	"encoding/binary"
	"errors"
	"fmt"
	"math"
	"strconv"
	"time"
	"unicode/utf16"
)

const (
	binaryPlistTrailerSize = 32
	binaryPlistMaxDepth    = 64
)

var binaryPlistEpoch = time.Date(2001, time.January, 1, 0, 0, 0, 0, time.UTC)

type binaryPlist struct {
	data     []byte
	offsets  []uint64
	refSize  int
	visiting map[uint64]bool
}

func decodeBinaryPlist(data []byte) (*plistNode, error) {
	if len(data) < len(binaryPlists)+binaryPlistTrailerSize {
		return nil, errors.New("binary plist is truncated")
	}

	trailer := data[len(data)-binaryPlistTrailerSize:]
	offsetSize := int(trailer[6])
	refSize := int(trailer[7])
	count := binary.BigEndian.Uint64(trailer[8:])
	top := binary.BigEndian.Uint64(trailer[16:])

	tableOffset := binary.BigEndian.Uint64(trailer[24:])
	if offsetSize < 1 || offsetSize > 8 || refSize < 1 || refSize > 8 || count > uint64(len(data)) || tableOffset+count*uint64(offsetSize) > uint64(len(data)) {
		return nil, errors.New("binary plist trailer is invalid")
	}

	plist := &binaryPlist{data: data, refSize: refSize, visiting: map[uint64]bool{}}
	for index := range count {
		plist.offsets = append(plist.offsets, readBigEndian(data[tableOffset+index*uint64(offsetSize):], offsetSize))
	}

	return plist.object(top, 0)
}

func readBigEndian(data []byte, size int) uint64 {
	var value uint64
	for index := range size {
		value = value<<8 | uint64(data[index])
	}

	return value
}

func (plist *binaryPlist) object(ref uint64, depth int) (*plistNode, error) {
	if ref >= uint64(len(plist.offsets)) || depth > binaryPlistMaxDepth || plist.visiting[ref] {
		return nil, fmt.Errorf("binary plist object %d is out of range or cyclic", ref)
	}

	plist.visiting[ref] = true
	defer delete(plist.visiting, ref)

	offset := plist.offsets[ref]
	if offset >= uint64(len(plist.data)) {
		return nil, fmt.Errorf("binary plist object %d starts outside the file", ref)
	}

	marker := plist.data[offset]

	kind, info := marker>>4, marker&0x0F
	switch kind {
	case 0x0:
		return plist.simple(info)
	case 0x1:
		return plist.integer(offset+1, 1<<info)
	case 0x2:
		return plist.real(offset+1, 1<<info)
	case 0x3:
		return plist.date(offset + 1)
	case 0x4, 0x5, 0x6:
		return plist.bytesObject(kind, offset, info)
	case 0xA:
		return plist.array(offset, info, depth)
	case 0xD:
		return plist.dictionary(offset, info, depth)
	}

	return nil, fmt.Errorf("unsupported binary plist marker %#x", marker)
}

func (plist *binaryPlist) simple(info byte) (*plistNode, error) {
	switch info {
	case 0x8:
		return &plistNode{kind: plistFalseKind}, nil
	case 0x9:
		return &plistNode{kind: plistTrueKind}, nil
	}

	return nil, fmt.Errorf("unsupported binary plist simple value %#x", info)
}

func (plist *binaryPlist) slice(offset uint64, size uint64) ([]byte, error) {
	if offset+size > uint64(len(plist.data)) || offset+size < offset {
		return nil, errors.New("binary plist value runs past the file")
	}

	return plist.data[offset : offset+size], nil
}

func (plist *binaryPlist) integer(offset uint64, size int) (*plistNode, error) {
	raw, err := plist.slice(offset, uint64(size))
	if err != nil {
		return nil, err
	}

	value := readBigEndian(raw, min(size, 8))
	if size < 8 {
		return &plistNode{kind: "integer", text: strconv.FormatUint(value, 10)}, nil
	}

	return &plistNode{kind: "integer", text: strconv.FormatInt(int64(value), 10)}, nil
}

func (plist *binaryPlist) real(offset uint64, size int) (*plistNode, error) {
	raw, err := plist.slice(offset, uint64(size))
	if err != nil {
		return nil, err
	}

	value := math.Float64frombits(readBigEndian(raw, size))
	if size == 4 {
		value = float64(math.Float32frombits(uint32(readBigEndian(raw, size))))
	}

	return &plistNode{kind: "real", text: strconv.FormatFloat(value, 'g', -1, 64)}, nil
}

func (plist *binaryPlist) date(offset uint64) (*plistNode, error) {
	raw, err := plist.slice(offset, 8)
	if err != nil {
		return nil, err
	}

	seconds := math.Float64frombits(binary.BigEndian.Uint64(raw))
	moment := binaryPlistEpoch.Add(time.Duration(seconds * float64(time.Second)))

	return &plistNode{kind: "date", text: moment.Format(time.RFC3339)}, nil
}

func (plist *binaryPlist) length(offset uint64, info byte) (uint64, uint64, error) {
	if info != 0x0F {
		return uint64(info), offset + 1, nil
	}

	if offset+1 >= uint64(len(plist.data)) || plist.data[offset+1]>>4 != 0x1 {
		return 0, 0, errors.New("binary plist length is malformed")
	}

	size := 1 << (plist.data[offset+1] & 0x0F)

	raw, err := plist.slice(offset+2, uint64(size))
	if err != nil {
		return 0, 0, err
	}

	return readBigEndian(raw, min(size, 8)), offset + 2 + uint64(size), nil
}

func (plist *binaryPlist) bytesObject(kind byte, offset uint64, info byte) (*plistNode, error) {
	count, start, err := plist.length(offset, info)
	if err != nil {
		return nil, err
	}

	switch kind {
	case 0x4:
		raw, err := plist.slice(start, count)
		if err != nil {
			return nil, err
		}

		return &plistNode{kind: "data", text: base64.StdEncoding.EncodeToString(raw)}, nil
	case 0x5:
		raw, err := plist.slice(start, count)
		if err != nil {
			return nil, err
		}

		return plistText(string(raw)), nil
	}

	raw, err := plist.slice(start, count*2)
	if err != nil {
		return nil, err
	}

	units := make([]uint16, count)
	for index := range units {
		units[index] = binary.BigEndian.Uint16(raw[index*2:])
	}

	return plistText(string(utf16.Decode(units))), nil
}

func (plist *binaryPlist) refs(start, count uint64) ([]uint64, error) {
	raw, err := plist.slice(start, count*uint64(plist.refSize))
	if err != nil {
		return nil, err
	}

	refs := make([]uint64, count)
	for index := range refs {
		refs[index] = readBigEndian(raw[index*plist.refSize:], plist.refSize)
	}

	return refs, nil
}

func (plist *binaryPlist) array(offset uint64, info byte, depth int) (*plistNode, error) {
	count, start, err := plist.length(offset, info)
	if err != nil {
		return nil, err
	}

	refs, err := plist.refs(start, count)
	if err != nil {
		return nil, err
	}

	node := &plistNode{kind: plistArrayKind}

	for _, ref := range refs {
		value, err := plist.object(ref, depth+1)
		if err != nil {
			return nil, err
		}

		node.values = append(node.values, value)
	}

	return node, nil
}

func (plist *binaryPlist) dictionary(offset uint64, info byte, depth int) (*plistNode, error) {
	count, start, err := plist.length(offset, info)
	if err != nil {
		return nil, err
	}

	refs, err := plist.refs(start, count*2)
	if err != nil {
		return nil, err
	}

	node := newPlistDict()

	for index := range count {
		key, err := plist.object(refs[index], depth+1)
		if err != nil {
			return nil, err
		}

		if key.kind != plistStringKind {
			return nil, errors.New("binary plist dictionary key is not a string")
		}

		value, err := plist.object(refs[count+index], depth+1)
		if err != nil {
			return nil, err
		}

		node.keys = append(node.keys, key.text)
		node.values = append(node.values, value)
	}

	return node, nil
}
