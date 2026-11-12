#import "WrenchIcon.h"

// Nucleo micro-bold IconWrench on its 20pt viewBox, with relative SVG commands made absolute.
static const CGFloat kViewBox     = 20;
static const CGFloat kStrokeWidth = 2;

static UIBezierPath *wrenchPath(void)
{
    UIBezierPath *path = [UIBezierPath bezierPath];
    [path moveToPoint:CGPointMake(12.5, 17)];
    [path addLineToPoint:CGPointMake(12.074, 13.592)];
    [path addCurveToPoint:CGPointMake(15.5, 8.5)
            controlPoint1:CGPointMake(14.083, 12.773)
            controlPoint2:CGPointMake(15.5, 10.803)];
    [path addCurveToPoint:CGPointMake(12, 3.381)
            controlPoint1:CGPointMake(15.5, 6.169)
            controlPoint2:CGPointMake(14.047, 4.181)];
    [path addLineToPoint:CGPointMake(12, 8)];
    [path addCurveToPoint:CGPointMake(11, 9)
            controlPoint1:CGPointMake(12, 8.552)
            controlPoint2:CGPointMake(11.552, 9)];
    [path addLineToPoint:CGPointMake(9, 9)];
    [path addCurveToPoint:CGPointMake(8, 8)
            controlPoint1:CGPointMake(8.448, 9)
            controlPoint2:CGPointMake(8, 8.552)];
    [path addLineToPoint:CGPointMake(8, 3.381)];
    [path addCurveToPoint:CGPointMake(4.5, 8.5)
            controlPoint1:CGPointMake(5.953, 4.182)
            controlPoint2:CGPointMake(4.5, 6.169)];
    [path addCurveToPoint:CGPointMake(7.926, 13.592)
            controlPoint1:CGPointMake(4.5, 10.803)
            controlPoint2:CGPointMake(5.917, 12.773)];
    [path addLineToPoint:CGPointMake(7.5, 17)];
    return path;
}

UIImage *wrenchIcon(CGFloat side)
{
    UIGraphicsImageRenderer *renderer =
        [[UIGraphicsImageRenderer alloc] initWithSize:CGSizeMake(side, side)];
    UIImage *image = [renderer imageWithActions:^(UIGraphicsImageRendererContext *context) {
        CGFloat       scale = side / kViewBox;
        UIBezierPath *path  = wrenchPath();
        [path applyTransform:CGAffineTransformMakeScale(scale, scale)];
        path.lineWidth     = kStrokeWidth * scale;
        path.lineCapStyle  = kCGLineCapRound;
        path.lineJoinStyle = kCGLineJoinRound;
        [UIColor.blackColor setStroke];
        [path stroke];
    }];
    return [image imageWithRenderingMode:UIImageRenderingModeAlwaysTemplate];
}
