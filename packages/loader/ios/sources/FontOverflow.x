#import "FontOverflow.h"

// A replacement font can be taller than the line box Discord's text styles fix. TextKit seats
// such a line on the box's bottom and React Native clips the paragraph to its frame, cutting the
// ink's top. Each line is instead centred on its own ink, and the paragraph draws past its frame.

static NSString *const kInkSample        = @"ABLWbdfhjkltgpqy";
static const void     *kRequestedClipKey = &kRequestedClipKey;

// Ink of a font's Latin letters per point: `top` above the baseline, `bottom` below it, and
// `side`, how far a letter reaches past its advance on either side.
typedef struct {
    CGFloat top;
    CGFloat bottom;
    CGFloat side;
} FontInk;

static FontInk sampleInkOf(UIFont *font)
{
    static NSMutableDictionary<NSString *, NSValue *> *cache = nil;
    @synchronized([FontLineCentring class])
    {
        NSValue *cached = cache[font.fontName];
        if (cached)
        {
            FontInk ink;
            [cached getValue:&ink];
            return ink;
        }
    }

    NSUInteger length = kInkSample.length;
    UniChar    characters[length];
    CGGlyph    glyphs[length];
    CGRect     bounds[length];
    CGSize     advances[length];
    [kInkSample getCharacters:characters range:NSMakeRange(0, length)];
    CTFontRef ct = (__bridge CTFontRef) font;
    CTFontGetGlyphsForCharacters(ct, characters, glyphs, length);
    CTFontGetBoundingRectsForGlyphs(ct, kCTFontOrientationHorizontal, glyphs, bounds, length);
    CTFontGetAdvancesForGlyphs(ct, kCTFontOrientationHorizontal, glyphs, advances, length);

    CGFloat size = font.pointSize > 0 ? font.pointSize : 1;
    FontInk ink  = {0, 0, 0};
    for (NSUInteger i = 0; i < length; i++)
    {
        ink.top    = MAX(ink.top, CGRectGetMaxY(bounds[i]) / size);
        ink.bottom = MAX(ink.bottom, -CGRectGetMinY(bounds[i]) / size);
        ink.side   = MAX(
            ink.side,
            MAX(-CGRectGetMinX(bounds[i]), CGRectGetMaxX(bounds[i]) - advances[i].width) / size);
    }

    @synchronized([FontLineCentring class])
    {
        cache                = cache ?: [NSMutableDictionary dictionary];
        cache[font.fontName] = [NSValue valueWithBytes:&ink objCType:@encode(FontInk)];
    }
    return ink;
}

// The baseline, from the top of a `box`-tall line, that centres ink reaching `top` above it and
// `bottom` below. NO when the ink already fits around `baseline`.
static BOOL centredBaseline(CGFloat box, CGFloat baseline, CGFloat top, CGFloat bottom,
                            CGFloat *centred)
{
    if (top <= baseline && bottom <= box - baseline)
    {
        return NO;
    }
    *centred = (box + top - bottom) / 2;
    return YES;
}

// The union of the bounds of the glyphs `layout` drew for `range` in `font`, from their baseline.
static CGRect glyphInk(NSLayoutManager *layout, NSRange range, UIFont *font)
{
    CGGlyph         *glyphs     = malloc(sizeof(CGGlyph) * range.length);
    NSGlyphProperty *properties = malloc(sizeof(NSGlyphProperty) * range.length);
    NSUInteger       count      = [layout getGlyphsInRange:range
                                                    glyphs:glyphs
                                                properties:properties
                                          characterIndexes:NULL
                                                bidiLevels:NULL];
    CGRect           ink        = CGRectNull;
    CTFontRef        ct         = (__bridge CTFontRef) font;
    for (NSUInteger i = 0; i < count; i++)
    {
        // Control characters such as newlines have no glyph; theirs is the font's .notdef box.
        if (properties[i] & (NSGlyphPropertyNull | NSGlyphPropertyControlCharacter))
        {
            continue;
        }
        CGRect bounds =
            CTFontGetBoundingRectsForGlyphs(ct, kCTFontOrientationHorizontal, &glyphs[i], NULL, 1);
        ink = CGRectUnion(ink, bounds);
    }
    free(glyphs);
    free(properties);
    return ink;
}

static BOOL drawsReplacement(NSAttributedString *text)
{
    __block BOOL found = NO;
    [text enumerateAttribute:NSFontAttributeName
                     inRange:NSMakeRange(0, text.length)
                     options:0
                  usingBlock:^(UIFont *font, NSRange range, BOOL *stop) {
                      found = *stop = [Fonts isReplacement:font];
                  }];
    return found;
}

// How far past its frame `text` may draw: the most a replacement font's ink is taller than its
// line box, or reaches past a letter's advance. 0 when every replacement fits.
static CGFloat outsetOf(NSAttributedString *text)
{
    __block CGFloat outset = 0;
    [text enumerateAttribute:NSFontAttributeName
                     inRange:NSMakeRange(0, text.length)
                     options:0
                  usingBlock:^(UIFont *font, NSRange range, BOOL *stop) {
                      if (![Fonts isReplacement:font])
                      {
                          return;
                      }
                      NSParagraphStyle *style = [text attribute:NSParagraphStyleAttributeName
                                                        atIndex:range.location
                                                 effectiveRange:NULL];
                      CGFloat           box =
                          style.maximumLineHeight > 0 ? style.maximumLineHeight : font.lineHeight;
                      FontInk ink  = sampleInkOf(font);
                      CGFloat size = font.pointSize;
                      outset =
                          MAX(outset, MAX((ink.top + ink.bottom) * size - box, ink.side * size));
                  }];
    return outset > 0 ? ceil(outset) : 0;
}

@implementation FontLineCentring
- (BOOL)layoutManager:(NSLayoutManager *)layoutManager
    shouldSetLineFragmentRect:(inout CGRect *)lineFragmentRect
         lineFragmentUsedRect:(inout CGRect *)lineFragmentUsedRect
               baselineOffset:(inout CGFloat *)baselineOffset
              inTextContainer:(NSTextContainer *)textContainer
                forGlyphRange:(NSRange)glyphRange
{
    NSTextStorage *storage    = layoutManager.textStorage;
    NSRange        characters = [layoutManager characterRangeForGlyphRange:glyphRange
                                                          actualGlyphRange:NULL];
    __block CGRect ink        = CGRectNull;
    [storage enumerateAttribute:NSFontAttributeName
                        inRange:characters
                        options:0
                     usingBlock:^(UIFont *font, NSRange range, BOOL *stop) {
                         if (![Fonts isReplacement:font])
                         {
                             return;
                         }
                         NSRange glyphs = [layoutManager glyphRangeForCharacterRange:range
                                                                actualCharacterRange:NULL];
                         ink            = CGRectUnion(ink, glyphInk(layoutManager, glyphs, font));
                     }];

    CGFloat centred;
    if (CGRectIsNull(ink) || !centredBaseline(lineFragmentRect->size.height, *baselineOffset,
                                              CGRectGetMaxY(ink), -CGRectGetMinY(ink), &centred))
    {
        return NO;
    }
    *baselineOffset = centred;
    return YES;
}
@end

static FontLineCentring *centring = nil;

// Grows the paragraph's text view past `frame`, the paragraph's own, by `outset` on every side,
// keeping its drawing in place, and lifts the clip of the view holding it. 0 puts both back.
static void applyOutset(UIView *textView, CGRect frame, CGFloat outset)
{
    UIView   *clip      = textView.superview;
    NSNumber *requested = objc_getAssociatedObject(clip, kRequestedClipKey);
    if (outset > 0 && !requested)
    {
        objc_setAssociatedObject(clip, kRequestedClipKey, @(clip.layer.masksToBounds),
                                 OBJC_ASSOCIATION_RETAIN_NONATOMIC);
        clip.layer.masksToBounds = NO;
    }
    else if (outset <= 0 && requested)
    {
        clip.layer.masksToBounds = requested.boolValue;
        objc_setAssociatedObject(clip, kRequestedClipKey, nil, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
    }

    // The bounds' origin keeps the drawing and its press highlight where they were.
    CGRect grown  = CGRectInset(frame, -outset, -outset);
    CGRect bounds = CGRectMake(-outset, -outset, grown.size.width, grown.size.height);
    if (!CGRectEqualToRect(textView.frame, grown) || !CGRectEqualToRect(textView.bounds, bounds))
    {
        textView.frame  = grown;
        textView.bounds = bounds;
        [textView setNeedsDisplay];
    }
}

%hook RCTTextLayoutManager
// `paragraphAttributes` is a C++ struct passed by value, which arm64 passes as a pointer.
- (NSTextStorage *)_textStorageAndLayoutManagerWithAttributesString:(NSAttributedString *)string
                                                paragraphAttributes:(void *)attributes
                                                               size:(CGSize)size
{
    NSTextStorage   *storage = %orig;
    NSLayoutManager *layout  = storage.layoutManagers.firstObject;
    if (layout && !layout.delegate && drawsReplacement(storage))
    {
        layout.delegate = centring;
        [layout invalidateLayoutForCharacterRange:NSMakeRange(0, storage.length)
                             actualCharacterRange:NULL];
    }
    return storage;
}
%end

%hook RCTParagraphComponentView
- (void)layoutSubviews
{
    %orig;
    Ivar    ivar     = class_getInstanceVariable(object_getClass(self), "_textView");
    UIView *textView = ivar ? object_getIvar(self, ivar) : nil;
    if (!textView.superview || ![self respondsToSelector:@selector(attributedText)])
    {
        return;
    }
    CGRect  frame  = [self convertRect:self.bounds toView:textView.superview];
    CGFloat outset = [Fonts overrides].count ? outsetOf(self.attributedText) : 0;
    applyOutset(textView, frame, outset);
}

// Discord's `overflow` arrives here; while the paragraph draws past its frame it is kept for later.
- (void)setClipsToBounds:(BOOL)clipsToBounds
{
    if (objc_getAssociatedObject(self, kRequestedClipKey))
    {
        objc_setAssociatedObject(self, kRequestedClipKey, @(clipsToBounds),
                                 OBJC_ASSOCIATION_RETAIN_NONATOMIC);
        return;
    }
    %orig;
}
%end

%ctor
{
    centring = [FontLineCentring new];
    SEL storage =
        @selector(_textStorageAndLayoutManagerWithAttributesString:paragraphAttributes:size:);
    if (![objc_getClass("RCTTextLayoutManager") instancesRespondToSelector:storage] ||
        !class_getInstanceVariable(objc_getClass("RCTParagraphComponentView"), "_textView"))
    {
        [Logger warning:LOG_CATEGORY_FONTS
                 format:@"React Native's text classes changed; tall fonts may be clipped."];
    }
}
