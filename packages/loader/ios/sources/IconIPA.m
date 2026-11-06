#import "IconIPA.h"

#import <stdio.h>
#import <sys/stat.h>
#import <zlib.h>

#import "../shared/UBAppIcons.h"

static const uint32_t kLocalHeader   = 0x04034b50;
static const uint32_t kCentralHeader = 0x02014b50;
static const uint32_t kEndOfCentral  = 0x06054b50;
static const uint16_t kZipVersion    = 20;
static const uint16_t kMadeByUnix    = (3 << 8) | 20;
static const size_t   kChunk         = 1 << 20;

@interface                            UBZipEntry : NSObject
@property (nonatomic, copy) NSString *name;
@property (nonatomic) uint32_t        crc;
@property (nonatomic) uint32_t        size;
@property (nonatomic) uint32_t        offset;
@property (nonatomic) uint32_t        mode;
@end

@implementation UBZipEntry
@end

static void put16(NSMutableData *data, uint16_t value)
{
    uint8_t bytes[2] = {(uint8_t) value, (uint8_t) (value >> 8)};
    [data appendBytes:bytes length:2];
}

static void put32(NSMutableData *data, uint32_t value)
{
    uint8_t bytes[4] = {(uint8_t) value, (uint8_t) (value >> 8), (uint8_t) (value >> 16),
                        (uint8_t) (value >> 24)};
    [data appendBytes:bytes length:4];
}

static BOOL fileCRC(NSString *path, uint32_t *crc, uint32_t *size)
{
    FILE *file = fopen(path.fileSystemRepresentation, "rb");
    if (!file)
    {
        return NO;
    }
    uLong    value  = crc32(0, Z_NULL, 0);
    uint64_t total  = 0;
    uint8_t *buffer = malloc(kChunk);
    size_t   read;
    while ((read = fread(buffer, 1, kChunk, file)) > 0)
    {
        value = crc32(value, buffer, (uInt) read);
        total += read;
    }
    free(buffer);
    fclose(file);
    if (total > UINT32_MAX)
    {
        return NO;
    }
    *crc  = (uint32_t) value;
    *size = (uint32_t) total;
    return YES;
}

static NSData *localHeader(UBZipEntry *entry)
{
    NSData        *name = [entry.name dataUsingEncoding:NSUTF8StringEncoding];
    NSMutableData *data = [NSMutableData data];
    put32(data, kLocalHeader);
    put16(data, kZipVersion);
    put16(data, 0x0800);
    put16(data, 0);
    put16(data, 0);
    put16(data, 0x21);
    put32(data, entry.crc);
    put32(data, entry.size);
    put32(data, entry.size);
    put16(data, (uint16_t) name.length);
    put16(data, 0);
    [data appendData:name];
    return data;
}

static NSData *centralHeader(UBZipEntry *entry)
{
    NSData        *name = [entry.name dataUsingEncoding:NSUTF8StringEncoding];
    NSMutableData *data = [NSMutableData data];
    put32(data, kCentralHeader);
    put16(data, kMadeByUnix);
    put16(data, kZipVersion);
    put16(data, 0x0800);
    put16(data, 0);
    put16(data, 0);
    put16(data, 0x21);
    put32(data, entry.crc);
    put32(data, entry.size);
    put32(data, entry.size);
    put16(data, (uint16_t) name.length);
    put16(data, 0);
    put16(data, 0);
    put16(data, 0);
    put16(data, 0);
    put32(data, entry.mode << 16);
    put32(data, entry.offset);
    [data appendData:name];
    return data;
}

static BOOL appendFile(FILE *zip, NSString *path)
{
    FILE *file = fopen(path.fileSystemRepresentation, "rb");
    if (!file)
    {
        return NO;
    }
    uint8_t *buffer = malloc(kChunk);
    size_t   read;
    BOOL     written = YES;
    while (written && (read = fread(buffer, 1, kChunk, file)) > 0)
    {
        written = fwrite(buffer, 1, read, zip) == read;
    }
    free(buffer);
    fclose(file);
    return written;
}

static BOOL writeData(FILE *zip, NSData *data)
{
    return fwrite(data.bytes, 1, data.length, zip) == data.length;
}

static BOOL addDirectory(FILE *zip, NSString *name, NSMutableArray<UBZipEntry *> *entries)
{
    UBZipEntry *entry = [UBZipEntry new];
    entry.offset      = (uint32_t) ftello(zip);
    entry.mode        = S_IFDIR | 0755;
    entry.name        = [name stringByAppendingString:@"/"];
    [entries addObject:entry];
    return writeData(zip, localHeader(entry));
}

static BOOL addFile(FILE *zip, NSString *name, NSString *source,
                    NSMutableArray<UBZipEntry *> *entries)
{
    struct stat info;
    uint32_t    crc, size;
    if (stat(source.fileSystemRepresentation, &info) != 0 || !S_ISREG(info.st_mode) ||
        !fileCRC(source, &crc, &size))
    {
        NSLog(@"Unbound: Failed to add %@ to the icon IPA", name);
        return NO;
    }
    UBZipEntry *entry = [UBZipEntry new];
    entry.offset      = (uint32_t) ftello(zip);
    entry.mode        = S_IFREG | (info.st_mode & 0777) | 0644;
    entry.name        = name;
    entry.crc         = crc;
    entry.size        = size;
    [entries addObject:entry];
    return writeData(zip, localHeader(entry)) && appendFile(zip, source);
}

static BOOL addBundle(FILE *zip, NSString *bundle, NSString *prefix,
                      NSDictionary<NSString *, NSString *> *overrides,
                      NSMutableArray<UBZipEntry *>         *entries)
{
    if (!addDirectory(zip, @"Payload", entries) || !addDirectory(zip, prefix, entries))
    {
        return NO;
    }
    NSDirectoryEnumerator *walker = [NSFileManager.defaultManager enumeratorAtPath:bundle];
    for (NSString *relative in walker)
    {
        if ([relative.lastPathComponent isEqualToString:@"SC_Info"])
        {
            [walker skipDescendants];
            continue;
        }
        if ([relative hasPrefix:@"UnboundCustom"] || overrides[relative])
        {
            continue;
        }
        NSString *name   = [prefix stringByAppendingPathComponent:relative];
        BOOL      folder = [walker.fileAttributes.fileType isEqualToString:NSFileTypeDirectory];
        if (!(folder
                  ? addDirectory(zip, name, entries)
                  : addFile(zip, name, [bundle stringByAppendingPathComponent:relative], entries)))
        {
            return NO;
        }
    }
    for (NSString *relative in overrides)
    {
        if (!addFile(zip, [prefix stringByAppendingPathComponent:relative], overrides[relative],
                     entries))
        {
            return NO;
        }
    }
    return YES;
}

static BOOL writeIPA(NSString *bundle, NSDictionary<NSString *, NSString *> *overrides,
                     NSString *output)
{
    FILE *zip = fopen(output.fileSystemRepresentation, "wb");
    if (!zip)
    {
        return NO;
    }
    NSMutableArray<UBZipEntry *> *entries = [NSMutableArray array];
    NSString *prefix       = [@"Payload" stringByAppendingPathComponent:bundle.lastPathComponent];
    BOOL      written      = addBundle(zip, bundle, prefix, overrides, entries);
    uint32_t  centralStart = (uint32_t) ftello(zip);
    for (UBZipEntry *entry in entries)
    {
        written = written && writeData(zip, centralHeader(entry));
    }
    uint32_t       centralSize = (uint32_t) ftello(zip) - centralStart;
    NSMutableData *end         = [NSMutableData data];
    put32(end, kEndOfCentral);
    put16(end, 0);
    put16(end, 0);
    put16(end, (uint16_t) entries.count);
    put16(end, (uint16_t) entries.count);
    put32(end, centralSize);
    put32(end, centralStart);
    put16(end, 0);
    written = written && writeData(zip, end) && entries.count < UINT16_MAX;
    return fclose(zip) == 0 && written;
}

static NSString *writePatchedInfo(NSString *bundle, NSString *iconDirectory,
                                  NSArray<NSDictionary *> *icons, NSString *work)
{
    NSData *data =
        [NSData dataWithContentsOfFile:[bundle stringByAppendingPathComponent:@"Info.plist"]];
    NSMutableDictionary *info =
        data ? [NSPropertyListSerialization
                   propertyListWithData:data
                                options:NSPropertyListMutableContainersAndLeaves
                                 format:nil
                                  error:nil]
             : nil;
    if (![info isKindOfClass:NSMutableDictionary.class])
    {
        return nil;
    }
    UBAddAlternateIcon(info, @"UnboundIcon");
    UBAddCustomIcons(info, UBRenderableIcons(iconDirectory, icons));
    NSData *patched =
        [NSPropertyListSerialization dataWithPropertyList:info
                                                   format:NSPropertyListBinaryFormat_v1_0
                                                  options:0
                                                    error:nil];
    NSString *path = [work stringByAppendingPathComponent:@"Info.plist"];
    return patched && [patched writeToFile:path atomically:YES] ? path : nil;
}

NSString *UBBuildIconIPA(NSString *documentsDirectory)
{
    NSFileManager *files  = NSFileManager.defaultManager;
    NSString      *bundle = NSBundle.mainBundle.bundlePath;
    NSString      *work = [NSTemporaryDirectory() stringByAppendingPathComponent:@"UnboundIconIPA"];
    NSString      *icons = [work stringByAppendingPathComponent:@"Icons"];
    NSString      *output =
        [NSTemporaryDirectory() stringByAppendingPathComponent:@"Discord-Unbound-icons.ipa"];
    [files removeItemAtPath:work error:nil];
    [files removeItemAtPath:output error:nil];
    if (![files createDirectoryAtPath:icons
            withIntermediateDirectories:YES
                             attributes:nil
                                  error:nil])
    {
        return nil;
    }
    NSArray<NSDictionary *> *custom = UBCustomIcons(documentsDirectory);
    UBSyncCustomIconFiles(icons, custom);
    NSString *info = writePatchedInfo(bundle, icons, custom, work);
    NSMutableDictionary<NSString *, NSString *> *overrides = [NSMutableDictionary dictionary];
    for (NSString *file in [files contentsOfDirectoryAtPath:icons error:nil])
    {
        overrides[file] = [icons stringByAppendingPathComponent:file];
    }
    if (info)
    {
        overrides[@"Info.plist"] = info;
    }
    BOOL built = info && writeIPA(bundle, overrides, output);
    [files removeItemAtPath:work error:nil];
    if (!built)
    {
        NSLog(@"Unbound: Failed to build the icon IPA %@", output);
        [files removeItemAtPath:output error:nil];
        return nil;
    }
    return output;
}
