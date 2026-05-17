package com.aicalendar.widget.widgets

import androidx.compose.ui.graphics.Color

object WidgetTheme {
    val BG = Color(0xFFFFFFFF)
    val SURFACE_2 = Color(0xFFF1F1EE)
    val FG = Color(0xFF111111)
    val MUTED = Color(0xFF6B6B6B)
    val BORDER = Color(0xFFE7E7E3)
    val ACCENT = Color(0xFF111111)
}

object TimeFmt {
    /** "2026-05-19T15:00:00+09:00" -> "오후 3:00" (KST). */
    fun short(iso: String): String {
        return try {
            val instant = java.time.OffsetDateTime.parse(iso)
            val seoul = instant.atZoneSameInstant(java.time.ZoneId.of("Asia/Seoul"))
            val hour = seoul.hour
            val minute = seoul.minute
            val ampm = if (hour < 12) "오전" else "오후"
            val h12 = if (hour == 0) 12 else if (hour > 12) hour - 12 else hour
            "%s %d:%02d".format(ampm, h12, minute)
        } catch (_: Exception) {
            iso
        }
    }

    fun yyyymmdd(iso: String): String {
        return try {
            val odt = java.time.OffsetDateTime.parse(iso)
            val seoul = odt.atZoneSameInstant(java.time.ZoneId.of("Asia/Seoul"))
            "%04d-%02d-%02d".format(seoul.year, seoul.monthValue, seoul.dayOfMonth)
        } catch (_: Exception) {
            iso.take(10)
        }
    }
}
