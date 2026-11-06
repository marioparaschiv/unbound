#import "UBAppIcons.h"

#import <CoreGraphics/CoreGraphics.h>
#import <ImageIO/ImageIO.h>
#import <sys/stat.h>

NSString *const UBIconNamesKey = @"UnboundIconNames";

static NSString *const kCustomPrefix   = @"UnboundCustom";
static NSString *const kCustomManifest = @"Unbound/AppIcons/custom.json";

typedef struct
{
    NSString *suffix;
    size_t    pixels;
} IconRendition;

static const IconRendition kRenditions[] = {
    {@"60x60@2x.png", 120},
    {@"60x60@3x.png", 180},
    {@"76x76@2x~ipad.png", 152},
};

static BOOL isCustomIconId(id iconId)
{
    NSRegularExpression *pattern = [NSRegularExpression regularExpressionWithPattern:@"^UnboundCustom[A-Za-z0-9]{1,32}$"
                                                                             options:0
                                                                               error:nil];
    return [iconId isKindOfClass:NSString.class] &&
           [pattern numberOfMatchesInString:iconId options:0 range:NSMakeRange(0, [iconId length])] == 1;
}


NSArray<NSDictionary *> *UBCustomIcons(NSString *documentsDirectory)
{
    NSString *manifestPath = [documentsDirectory stringByAppendingPathComponent:kCustomManifest];
    NSData   *data         = [NSData dataWithContentsOfFile:manifestPath];
    NSArray  *entries      = data ? [NSJSONSerialization JSONObjectWithData:data options:0 error:nil] : nil;
    if (![entries isKindOfClass:NSArray.class])
    {
        return @[];
    }
    NSString       *directory = manifestPath.stringByDeletingLastPathComponent;
    NSMutableArray *icons     = [NSMutableArray array];
    for (NSDictionary *entry in entries)
    {
        if (![entry isKindOfClass:NSDictionary.class] || !isCustomIconId(entry[@"id"]) ||
            ![entry[@"name"] isKindOfClass:NSString.class] || ![entry[@"file"] isKindOfClass:NSString.class] ||
            [entry[@"file"] containsString:@"/"])
        {
            continue;
        }
        [icons addObject:@{
            @"id" : entry[@"id"],
            @"name" : entry[@"name"],
            @"image" : [directory stringByAppendingPathComponent:entry[@"file"]],
        }];
    }
    return icons;
}


static void addAlternateIconFiles(NSMutableDictionary *info, NSString *key, NSArray<NSString *> *files)
{
    NSString *iconId = [files.firstObject substringToIndex:[files.firstObject length] - @"60x60".length];
    NSMutableDictionary *icons = [info[key] mutableCopy];
    if (!icons)
    {
        return;
    }
    NSMutableDictionary *alternates = [icons[@"CFBundleAlternateIcons"] mutableCopy] ?: [NSMutableDictionary dictionary];
    alternates[iconId]              = @{@"CFBundleIconFiles" : files};
    icons[@"CFBundleAlternateIcons"] = alternates;
    info[key]                        = icons;
}


static NSArray<NSString *> *iconFileNames(NSString *iconId, BOOL ipad)
{
    NSString *phone = [iconId stringByAppendingString:@"60x60"];
    return ipad ? @[ phone, [iconId stringByAppendingString:@"76x76"] ] : @[ phone ];
}


void UBAddAlternateIcon(NSMutableDictionary *info, NSString *iconId)
{
    addAlternateIconFiles(info, @"CFBundleIcons", iconFileNames(iconId, NO));
    addAlternateIconFiles(info, @"CFBundleIcons~ipad", iconFileNames(iconId, YES));
}

void UBAddCustomIcons(NSMutableDictionary *info, NSArray<NSDictionary *> *icons)
{
    NSMutableDictionary *names = [NSMutableDictionary dictionary];
    for (NSDictionary *icon in icons)
    {
        UBAddAlternateIcon(info, icon[@"id"]);
        names[icon[@"id"]] = icon[@"name"];
    }
    info[UBIconNamesKey] = names;
}


static CGImageRef squareImage(NSString *path)
{
    CGImageSourceRef source = CGImageSourceCreateWithURL((__bridge CFURLRef)[NSURL fileURLWithPath:path], NULL);
    if (!source)
    {
        return NULL;
    }
    CGImageRef image = CGImageSourceCreateImageAtIndex(source, 0, NULL);
    CFRelease(source);
    if (!image)
    {
        return NULL;
    }
    size_t     side    = MIN(CGImageGetWidth(image), CGImageGetHeight(image));
    CGRect     crop    = CGRectMake((CGImageGetWidth(image) - side) / 2, (CGImageGetHeight(image) - side) / 2, side, side);
    CGImageRef cropped = CGImageCreateWithImageInRect(image, crop);
    CGImageRelease(image);
    return cropped;
}


static NSData *renderPNG(CGImageRef image, size_t pixels)
{
    CGColorSpaceRef space   = CGColorSpaceCreateDeviceRGB();
    CGContextRef    context = CGBitmapContextCreate(NULL, pixels, pixels, 8, 0, space,
                                                    kCGImageAlphaNoneSkipLast | kCGBitmapByteOrderDefault);
    CGColorSpaceRelease(space);
    if (!context)
    {
        return nil;
    }
    CGContextSetInterpolationQuality(context, kCGInterpolationHigh);
    CGContextDrawImage(context, CGRectMake(0, 0, pixels, pixels), image);
    CGImageRef      scaled = CGBitmapContextCreateImage(context);
    CGContextRelease(context);
    NSMutableData  *data        = [NSMutableData data];
    CGImageDestinationRef sink  = CGImageDestinationCreateWithData((__bridge CFMutableDataRef)data, CFSTR("public.png"), 1, NULL);
    CGImageDestinationAddImage(sink, scaled, NULL);
    BOOL written = CGImageDestinationFinalize(sink);
    CFRelease(sink);
    CGImageRelease(scaled);
    return written ? data : nil;
}


static BOOL writeIfChanged(NSData *data, NSString *target)
{
    if (!data || [data isEqualToData:[NSData dataWithContentsOfFile:target]])
    {
        return NO;
    }
    if (![data writeToFile:target atomically:YES])
    {
        NSLog(@"Unbound: Failed to write %@", target);
        return NO;
    }
    chmod(target.fileSystemRepresentation, 0644);
    return YES;
}


static BOOL renderCustomIcon(NSString *bundlePath, NSDictionary *icon)
{
    CGImageRef image = squareImage(icon[@"image"]);
    if (!image)
    {
        NSLog(@"Unbound: Failed to read custom icon %@", icon[@"id"]);
        return NO;
    }
    BOOL changed = NO;
    for (size_t index = 0; index < sizeof(kRenditions) / sizeof(kRenditions[0]); index++)
    {
        NSString *name = [icon[@"id"] stringByAppendingString:kRenditions[index].suffix];
        changed = writeIfChanged(renderPNG(image, kRenditions[index].pixels),
                                 [bundlePath stringByAppendingPathComponent:name]) || changed;
    }
    CGImageRelease(image);
    return changed;
}


BOOL UBSyncCustomIconFiles(NSString *bundlePath, NSArray<NSDictionary *> *icons)
{
    BOOL      changed = NO;
    NSArray  *wanted  = [icons valueForKey:@"id"];
    for (NSString *file in [NSFileManager.defaultManager contentsOfDirectoryAtPath:bundlePath error:nil])
    {
        NSString *iconId = [file componentsSeparatedByString:@"60x60"].firstObject;
        iconId           = [iconId componentsSeparatedByString:@"76x76"].firstObject;
        if ([file hasPrefix:kCustomPrefix] && ![wanted containsObject:iconId])
        {
            changed = [NSFileManager.defaultManager removeItemAtPath:[bundlePath stringByAppendingPathComponent:file]
                                                               error:nil] || changed;
        }
    }
    for (NSDictionary *icon in icons)
    {
        changed = renderCustomIcon(bundlePath, icon) || changed;
    }
    return changed;
}


NSArray<NSDictionary *> *UBRenderableIcons(NSString *bundlePath, NSArray<NSDictionary *> *icons)
{
    NSMutableArray *rendered = [NSMutableArray array];
    for (NSDictionary *icon in icons)
    {
        NSString *file = [icon[@"id"] stringByAppendingString:kRenditions[0].suffix];
        if ([NSFileManager.defaultManager fileExistsAtPath:[bundlePath stringByAppendingPathComponent:file]])
        {
            [rendered addObject:icon];
        }
    }
    return rendered;
}
