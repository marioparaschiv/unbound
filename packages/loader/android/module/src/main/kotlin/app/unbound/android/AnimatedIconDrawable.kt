package app.unbound.android

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.ColorFilter
import android.graphics.Paint
import android.graphics.Picture
import android.graphics.PixelFormat
import android.graphics.PorterDuff
import android.graphics.PorterDuffXfermode
import android.graphics.Rect
import android.graphics.drawable.Drawable
import android.os.SystemClock

internal class AnimatedIconDrawable(val original: Drawable, private val frames: List<Bitmap>, private val timing: AnimatedIconTiming) :
    Drawable() {
    companion object {
        private const val ADAPTIVE_ZOOM = 1.15f
    }

    private val paint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG)
    private var masked: List<Bitmap> = emptyList()
    private var maskedSize = 0
    private var failed = false
    private var frame = timing.rest
    private var running = false
    private val advance = Runnable { showNext() }

    init {
        bounds = original.copyBounds()
    }

    override fun draw(canvas: Canvas) {
        val bounds = bounds
        val size = maxOf(bounds.width(), bounds.height())
        if (size <= 0) return
        if (maskedSize != size && !failed) failed = runCatching { maskFrames(size) }.isFailure
        if (failed) {
            original.draw(canvas)
            return
        }
        canvas.drawBitmap(masked[frame], null, bounds, paint)
        if (!running && isVisible) start()
    }

    private fun maskFrames(size: Int) {
        val previous = Rect(original.bounds)
        val picture = Picture()
        original.setBounds(0, 0, size, size)
        original.draw(picture.beginRecording(size, size))
        picture.endRecording()
        original.bounds = previous
        val recorded = Bitmap.createBitmap(picture)
        val mask = recorded.copy(Bitmap.Config.ARGB_8888, true)
        recorded.recycle()
        val inset = ((size * ADAPTIVE_ZOOM - size) / 2).toInt()
        val target = Rect(-inset, -inset, size + inset, size + inset)
        val framePaint = Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG).apply {
            xfermode = PorterDuffXfermode(PorterDuff.Mode.SRC_IN)
        }
        masked = frames.map { source ->
            val output = mask.copy(Bitmap.Config.ARGB_8888, true)
            Canvas(output).drawBitmap(source, null, target, framePaint)
            output
        }
        mask.recycle()
        maskedSize = size
    }

    override fun setVisible(visible: Boolean, restart: Boolean): Boolean {
        val changed = super.setVisible(visible, restart)
        original.setVisible(visible, restart)
        if (!visible) stop()
        return changed
    }

    private fun start() {
        running = true
        frame = 0
        scheduleSelf(advance, SystemClock.uptimeMillis() + timing.durations[0])
    }

    private fun stop() {
        running = false
        unscheduleSelf(advance)
        frame = timing.rest
    }

    private fun showNext() {
        if (!running) return
        frame = (frame + 1) % frames.size
        invalidateSelf()
        scheduleSelf(advance, SystemClock.uptimeMillis() + timing.durations[frame])
    }

    override fun onBoundsChange(bounds: Rect) {
        original.bounds = bounds
    }

    override fun getIntrinsicWidth(): Int = original.intrinsicWidth

    override fun getIntrinsicHeight(): Int = original.intrinsicHeight

    override fun setAlpha(alpha: Int) {
        original.alpha = alpha
        paint.alpha = alpha
    }

    override fun setColorFilter(colorFilter: ColorFilter?) {
        original.colorFilter = colorFilter
        paint.colorFilter = colorFilter
    }

    @Deprecated("Deprecated in Java")
    override fun getOpacity(): Int = PixelFormat.TRANSLUCENT
}
