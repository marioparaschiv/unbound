#import "Utilities+CodeSignature.h"
#import "Attestation.h"

@interface Utilities (CodeSignaturePrivate)
+ (NSDictionary *)readEntitlementsFrom64BitBinary:(FILE *)file;
+ (NSDictionary *)extractEntitlements:(FILE *)file offset:(uint32_t)offset;
+ (NSDictionary *)readEntitlementsBlob:(FILE *)file offset:(uint32_t)offset;
@end

@implementation Utilities (CodeSignature)

+ (NSDictionary *)getApplicationEntitlements
{
    NSDictionary *signatureInfo = [self getApplicationSignatureInfo];
    return signatureInfo[@"entitlements"] ?: @{};
}

+ (NSDictionary *)getApplicationSignatureInfo
{
    NSBundle *bundle         = [NSBundle mainBundle];
    NSString *executableName = bundle.infoDictionary[@"CFBundleExecutable"];
    if (!executableName)
    {
        return @{};
    }

    NSString *executablePath = [bundle pathForResource:executableName ofType:nil];
    if (!executablePath)
    {
        return @{};
    }

    FILE *file = fopen([executablePath UTF8String], "rb");
    if (!file)
    {
        return @{};
    }

    uint32_t magic;
    if (fread(&magic, sizeof(magic), 1, file) != 1)
    {
        fclose(file);
        return @{};
    }

    fseek(file, 0, SEEK_SET);

    NSDictionary *result = nil;
    if (magic == MH_MAGIC_64 || magic == MH_CIGAM_64)
    {
        result = [self readEntitlementsFrom64BitBinary:file];
    }
    else
    {
        result = @{};
    }

    fclose(file);
    return result ?: @{};
}

+ (NSDictionary *)readEntitlementsFrom64BitBinary:(FILE *)file
{
    struct mach_header_64 header;
    if (fread(&header, sizeof(header), 1, file) != 1)
    {
        return nil;
    }

    for (uint32_t i = 0; i < header.ncmds; i++)
    {
        struct load_command cmd;
        long                cmdPos = ftell(file);

        if (fread(&cmd, sizeof(cmd), 1, file) != 1)
        {
            return nil;
        }

        if (cmd.cmd == LC_CODE_SIGNATURE)
        {
            struct linkedit_data_command sigCmd;
            fseek(file, cmdPos, SEEK_SET);
            if (fread(&sigCmd, sizeof(sigCmd), 1, file) != 1)
            {
                return nil;
            }

            return [self extractEntitlements:file offset:sigCmd.dataoff];
        }

        fseek(file, cmdPos + cmd.cmdsize, SEEK_SET);
    }

    return nil;
}

+ (NSDictionary *)extractEntitlements:(FILE *)file offset:(uint32_t)offset
{
    if (fseek(file, offset, SEEK_SET) != 0)
    {
        return nil;
    }

    struct {
        uint32_t magic;
        uint32_t length;
        uint32_t count;
    } superBlob;

    if (fread(&superBlob, sizeof(superBlob), 1, file) != 1)
    {
        return nil;
    }

    superBlob.magic  = CFSwapInt32BigToHost(superBlob.magic);
    superBlob.length = CFSwapInt32BigToHost(superBlob.length);
    superBlob.count  = CFSwapInt32BigToHost(superBlob.count);

    if (superBlob.magic != 0xfade0cc0)
    { // CSMAGIC_EMBEDDED_SIGNATURE
        return nil;
    }

    for (uint32_t i = 0; i < superBlob.count; i++)
    {
        struct {
            uint32_t type;
            uint32_t offset;
        } blobIndex;

        if (fread(&blobIndex, sizeof(blobIndex), 1, file) != 1)
        {
            continue;
        }

        blobIndex.type   = CFSwapInt32BigToHost(blobIndex.type);
        blobIndex.offset = CFSwapInt32BigToHost(blobIndex.offset);

        if (blobIndex.type == 5)
        { // CSSLOT_ENTITLEMENTS
            long          currentPos   = ftell(file);
            NSDictionary *entitlements = [self readEntitlementsBlob:file
                                                             offset:offset + blobIndex.offset];
            fseek(file, currentPos, SEEK_SET);

            if (entitlements)
            {
                return @{@"entitlements" : entitlements};
            }
        }
    }

    return @{};
}

+ (NSDictionary *)readEntitlementsBlob:(FILE *)file offset:(uint32_t)offset
{
    if (fseek(file, offset, SEEK_SET) != 0)
        return nil;

    struct {
        uint32_t magic;
        uint32_t length;
    } blobHeader;

    if (fread(&blobHeader, sizeof(blobHeader), 1, file) != 1)
        return nil;

    blobHeader.magic  = CFSwapInt32BigToHost(blobHeader.magic);
    blobHeader.length = CFSwapInt32BigToHost(blobHeader.length);

    if (blobHeader.magic != 0xfade7171)
        return nil;

    uint32_t       entitlementsLength = blobHeader.length - 8;
    NSMutableData *entitlementsData   = [NSMutableData dataWithLength:entitlementsLength];

    if (fread([entitlementsData mutableBytes], entitlementsLength, 1, file) != 1)
        return nil;

    NSError      *error        = nil;
    NSDictionary *entitlements = [NSPropertyListSerialization propertyListWithData:entitlementsData
                                                                           options:0
                                                                            format:nil
                                                                             error:&error];

    return (error || !entitlements) ? nil : entitlements;
}

+ (NSString *)formatEntitlementsAsPlist:(NSDictionary *)entitlements
{
    if (!entitlements || entitlements.count == 0)
    {
        return nil;
    }

    NSError *error = nil;
    NSData  *plistData =
        [NSPropertyListSerialization dataWithPropertyList:entitlements
                                                   format:NSPropertyListXMLFormat_v1_0
                                                  options:0
                                                    error:&error];

    if (error || !plistData)
    {
        return nil;
    }

    NSString *plistString = [[NSString alloc] initWithData:plistData encoding:NSUTF8StringEncoding];
    return plistString;
}

+ (BOOL)isVerifiedBuild
{
#if ATTESTATION_ENABLED
    return VerifyEmbeddedAttestation() ? YES : NO;
#else
    return YES;
#endif
}

+ (BOOL)hasDiscordProductionEntitlements
{
    NSDictionary *entitlements = [self getApplicationEntitlements];

    NSString *teamIdentifier = entitlements[@"com.apple.developer.team-identifier"];

    BOOL hasProductionEntitlements = [teamIdentifier isEqualToString:@"53Q6R32WPB"];

    [Logger debug:LOG_CATEGORY_UTILITIES
           format:@"Team identifier: %@, has production entitlements: %@",
                  teamIdentifier ?: @"(none)", hasProductionEntitlements ? @"YES" : @"NO"];

    return hasProductionEntitlements;
}

@end
