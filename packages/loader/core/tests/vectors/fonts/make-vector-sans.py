from fontTools.fontBuilder import FontBuilder
from fontTools.pens.ttGlyphPen import TTGlyphPen
from fontTools.ttLib import TTFont

def box(pen, w):
    pen.moveTo((50, 0)); pen.lineTo((50, 700)); pen.lineTo((w, 700)); pen.lineTo((w, 0)); pen.closePath()

fb = FontBuilder(1000, isTTF=True)
fb.setupGlyphOrder([".notdef", "A"])
fb.setupCharacterMap({0x41: "A"})
glyphs = {}
for name in [".notdef", "A"]:
    pen = TTGlyphPen(None); box(pen, 450); glyphs[name] = pen.glyph()
fb.setupGlyf(glyphs)
fb.setupHorizontalMetrics({".notdef": (500, 50), "A": (500, 50)})
fb.setupHorizontalHeader(ascent=800, descent=-200)
fb.setupNameTable({"familyName": "Vector Sans", "styleName": "Regular", "psName": "VectorSans-Regular"})
fb.setupOS2(usWeightClass=400)
fb.setupPost()
axes = [("wght", 100, 400, 900, "Weight"), ("wdth", 75, 100, 100, "Width")]
instances = [
    dict(location=dict(wght=400, wdth=100), stylename="Regular"),
    dict(location=dict(wght=700, wdth=100), stylename="Bold", postscriptfontname="VectorSans-Bold"),
    dict(location=dict(wght=400, wdth=75), stylename="Condensed"),
]
fb.setupFvar(axes, instances)
# gvar so the weight axis moves the outline: A widens at wght 900.
from fontTools.ttLib.tables.TupleVariation import TupleVariation
fb.setupGvar({"A": [TupleVariation({"wght": (0, 1, 1)}, [(0, 0), (0, 0), (300, 0), (300, 0), (0, 0), (0, 0), (0, 0), (0, 0)])], ".notdef": []})
fb.save("vector-sans-variable.ttf")

f = TTFont("vector-sans-variable.ttf"); f.flavor = "woff"; f.save("vector-sans-variable.woff")
f = TTFont("vector-sans-variable.ttf"); f.flavor = "woff2"; f.save("vector-sans-variable.woff2")
