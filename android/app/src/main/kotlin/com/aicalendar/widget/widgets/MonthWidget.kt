package com.aicalendar.widget.widgets

import android.content.Context
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.GlanceTheme
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.unit.ColorProvider
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.width
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import com.aicalendar.widget.api.ApiClient
import com.aicalendar.widget.store.TokenStore
import com.aicalendar.widget.widgets.WidgetTheme.ACCENT
import com.aicalendar.widget.widgets.WidgetTheme.BG
import com.aicalendar.widget.widgets.WidgetTheme.FG
import com.aicalendar.widget.widgets.WidgetTheme.MUTED
import java.time.LocalDate
import java.time.YearMonth
import java.time.ZoneId

private val RED = androidx.compose.ui.graphics.Color(0xFFEF4444)
private val BLUE = androidx.compose.ui.graphics.Color(0xFF3B82F6)

class MonthWidget : GlanceAppWidget() {

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val token = TokenStore.get(context)
        val today = LocalDate.now(ZoneId.of("Asia/Seoul"))
        val ym = "%04d-%02d".format(today.year, today.monthValue)
        val resp = if (token == null) null
        else runCatching { ApiClient.month(token, ym) }.getOrNull()
        val daysWith = resp?.days_with_events?.toSet() ?: emptySet()
        val holidays = resp?.holidays?.toSet() ?: emptySet()

        provideContent {
            GlanceTheme {
                if (token == null) {
                    NotConfigured()
                } else {
                    MonthBody(today, daysWith, holidays)
                }
            }
        }
    }
}

@androidx.compose.runtime.Composable
private fun MonthBody(today: LocalDate, daysWith: Set<String>, holidays: Set<String>) {
    val yearMonth = YearMonth.from(today)
    val firstDay = yearMonth.atDay(1)
    val firstWeekday = (firstDay.dayOfWeek.value % 7) // 0=Sun, 1=Mon, …, 6=Sat
    val daysInMonth = yearMonth.lengthOfMonth()
    val totalCells = ((firstWeekday + daysInMonth + 6) / 7) * 7

    Column(
        modifier = GlanceModifier
            .fillMaxSize()
            .background(ColorProvider(BG))
            .cornerRadius(20.dp)
            .padding(12.dp)
            .clickable(openApp())
    ) {
        Text(
            "${yearMonth.year}년 ${yearMonth.monthValue}월",
            style = TextStyle(color = ColorProvider(FG), fontSize = 14.sp, fontWeight = FontWeight.Bold)
        )
        Spacer(GlanceModifier.height(8.dp))

        // Day-of-week header (Sun red, Sat blue)
        Row(modifier = GlanceModifier.fillMaxWidth()) {
            listOf("일", "월", "화", "수", "목", "금", "토").forEachIndexed { i, d ->
                val c = if (i == 0) RED else if (i == 6) BLUE else MUTED
                Box(modifier = GlanceModifier.defaultWeight(), contentAlignment = Alignment.Center) {
                    Text(d, style = TextStyle(color = ColorProvider(c), fontSize = 10.sp))
                }
            }
        }
        Spacer(GlanceModifier.height(4.dp))

        var cellIndex = 0
        while (cellIndex < totalCells) {
            Row(modifier = GlanceModifier.fillMaxWidth().padding(vertical = 1.dp)) {
                for (col in 0 until 7) {
                    val day = cellIndex - firstWeekday + 1
                    val inMonth = day in 1..daysInMonth
                    val isToday = inMonth && day == today.dayOfMonth
                    val ymd = if (inMonth)
                        "%04d-%02d-%02d".format(yearMonth.year, yearMonth.monthValue, day)
                    else ""
                    val hasEvent = inMonth && daysWith.contains(ymd)
                    val isHoliday = inMonth && holidays.contains(ymd)

                    // date number color: today=inverted; holiday/Sun=red; Sat=blue; else fg
                    val numColor = when {
                        isToday -> BG
                        isHoliday || col == 0 -> RED
                        col == 6 -> BLUE
                        else -> FG
                    }

                    // today fills the whole cell with accent
                    val cellMod = GlanceModifier.defaultWeight().height(30.dp).let {
                        if (isToday) it.cornerRadius(8.dp).background(ColorProvider(ACCENT)) else it
                    }

                    Box(modifier = cellMod, contentAlignment = Alignment.Center) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            if (inMonth) {
                                Text(
                                    day.toString(),
                                    style = TextStyle(
                                        color = ColorProvider(numColor),
                                        fontSize = 11.sp,
                                        fontWeight = if (isToday || isHoliday) FontWeight.Bold else FontWeight.Normal
                                    )
                                )
                                if (hasEvent) {
                                    Spacer(GlanceModifier.height(2.dp))
                                    Box(
                                        modifier = GlanceModifier
                                            .width(4.dp)
                                            .height(4.dp)
                                            .cornerRadius(2.dp)
                                            .background(ColorProvider(if (isToday) BG else ACCENT))
                                    ) {}
                                }
                            } else {
                                Text("", style = TextStyle(color = ColorProvider(MUTED), fontSize = 11.sp))
                            }
                        }
                    }
                    cellIndex++
                }
            }
        }
    }
}

class MonthWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = MonthWidget()
}
