package app.unbound.android

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.ColorFilter
import android.graphics.Paint
import android.graphics.Path
import android.graphics.PixelFormat
import android.graphics.drawable.Drawable

/** Nucleo micro-bold IconWrench, stroked on its 20-unit viewBox and scaled to the bounds. */
class WrenchIcon(private val side: Int) : Drawable() {
    private val strokePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE
        strokeCap = Paint.Cap.ROUND
        strokeJoin = Paint.Join.ROUND
        strokeWidth = STROKE_WIDTH
        color = Color.WHITE
    }
    private val paint = Paint(Paint.FILTER_BITMAP_FLAG)
    private var cache: Bitmap? = null

    // The GPU canvas can stroke a path without anti-aliasing (as the emulator does), so the stroke is
    // drawn once on a software canvas, the way VectorDrawable caches its paths.
    override fun draw(canvas: Canvas) {
        if (bounds.isEmpty) return
        val bitmap = cache?.takeIf { it.width == bounds.width() && it.height == bounds.height() }
            ?: render(bounds.width(), bounds.height()).also { cache = it }
        canvas.drawBitmap(bitmap, bounds.left.toFloat(), bounds.top.toFloat(), paint)
    }

    private fun render(width: Int, height: Int): Bitmap {
        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        Canvas(bitmap).apply {
            scale(width / VIEW_BOX, height / VIEW_BOX)
            drawPath(PATH, strokePaint)
        }
        return bitmap
    }

    override fun getIntrinsicWidth(): Int = side

    override fun getIntrinsicHeight(): Int = side

    override fun setAlpha(alpha: Int) {
        paint.alpha = alpha
        invalidateSelf()
    }

    override fun setColorFilter(colorFilter: ColorFilter?) {
        paint.colorFilter = colorFilter
        invalidateSelf()
    }

    @Deprecated("Deprecated in Java")
    override fun getOpacity(): Int = PixelFormat.TRANSLUCENT

    private companion object {
        const val VIEW_BOX = 20f
        const val STROKE_WIDTH = 2f

        // The SVG's relative commands, made absolute.
        val PATH = Path().apply {
            moveTo(12.5f, 17f)
            lineTo(12.074f, 13.592f)
            cubicTo(14.083f, 12.773f, 15.5f, 10.803f, 15.5f, 8.5f)
            cubicTo(15.5f, 6.169f, 14.047f, 4.181f, 12f, 3.381f)
            lineTo(12f, 8f)
            cubicTo(12f, 8.552f, 11.552f, 9f, 11f, 9f)
            lineTo(9f, 9f)
            cubicTo(8.448f, 9f, 8f, 8.552f, 8f, 8f)
            lineTo(8f, 3.381f)
            cubicTo(5.953f, 4.182f, 4.5f, 6.169f, 4.5f, 8.5f)
            cubicTo(4.5f, 10.803f, 5.917f, 12.773f, 7.926f, 13.592f)
            lineTo(7.5f, 17f)
        }
    }
}
