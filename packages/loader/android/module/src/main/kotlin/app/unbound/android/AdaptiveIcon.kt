package app.unbound.android

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Rect
import android.graphics.drawable.Icon
import java.io.File

internal object AdaptiveIcon {
    private const val SIZE = 432

    fun fromFile(image: File): Icon? {
        val source = BitmapFactory.decodeFile(image.path) ?: return null
        return Icon.createWithAdaptiveBitmap(fill(source))
    }

    private fun fill(source: Bitmap): Bitmap {
        val canvas = Bitmap.createBitmap(SIZE, SIZE, Bitmap.Config.ARGB_8888)
        val scale = maxOf(SIZE.toFloat() / source.width, SIZE.toFloat() / source.height)
        val width = (source.width * scale).toInt()
        val height = (source.height * scale).toInt()
        val left = (SIZE - width) / 2
        val top = (SIZE - height) / 2
        Canvas(canvas).drawBitmap(source, null, Rect(left, top, left + width, top + height), null)
        return canvas
    }
}
