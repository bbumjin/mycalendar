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
import androidx.glance.appwidget.SizeMode
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.layout.Alignment
import androidx.glance.layout.Box
import androidx.glance.layout.Column
import androidx.glance.layout.Row
import androidx.glance.layout.Spacer
import androidx.glance.layout.fillMaxHeight
import androidx.glance.layout.fillMaxSize
import androidx.glance.layout.fillMaxWidth
import androidx.glance.layout.height
import androidx.glance.layout.padding
import androidx.glance.layout.width
import androidx.glance.text.FontWeight
import androidx.glance.text.Text
import androidx.glance.text.TextStyle
import com.aicalendar.widget.api.ApiClient
import com.aicalendar.widget.api.MonthEvent
import com.aicalendar.widget.store.TokenStore
import java.time.LocalDate
import java.time.YearMonth
import java.time.ZoneId

class MonthWidget : GlanceAppWidget() {

    // Recompose at the actual dragged size so the grid fills proportionally.
    override val sizeMode = SizeMode.Exact

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val token = TokenStore.get(context)
        val today = LocalDate.now(ZoneId.of("Asia/Seoul"))
        val ym = "%04d-%02d".format(today.year, today.monthValue)
        val resp = if (token == null) null
        else runCatching { ApiClient.month(token, ym) }.getOrNull()
        val holidays = resp?.holidays?.toSet() ?: emptySet()
        val byDay = HashMap<String, MutableList<MonthEvent>>()
        resp?.events?.forEach { ev ->
            byDay.getOrPut(TimeFmt.yyyymmdd(ev.start_time)) { mutableListOf() }.add(ev)
        }

        provideContent {
            GlanceTheme {
                if (token == null) NotConfigured() else MonthBody(today, holidays, byDay)
            }
        }
    }
}

@androidx.compose.runtime.Composable
private fun MonthBody(
    today: LocalDate,
    holidays: Set<String>,
    byDay: Map<String, List<MonthEvent>>
) {
    val yearMonth = YearMonth.from(today)
    val firstWeekday = (yearMonth.atDay(1).dayOfWeek.value % 7) // 0=Sun … 6=Sat
    val daysInMonth = yearMonth.lengthOfMonth()
    val totalCells = ((firstWeekday + daysInMonth + 6) / 7) * 7

    Column(
        modifier = GlanceModifier
            .fillMaxSize()
            .background(WidgetTheme.bg)
            .cornerRadius(20.dp)
            .padding(10.dp)
            .clickable(openCalendar())
    ) {
        // Header: title + add button
        Row(modifier = GlanceModifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
            Text(
                "${yearMonth.year}년 ${yearMonth.monthValue}월",
                style = TextStyle(color = WidgetTheme.fg, fontSize = 14.sp, fontWeight = FontWeight.Bold),
                modifier = GlanceModifier.defaultWeight()
            )
            Box(
                modifier = GlanceModifier
                    .height(26.dp)
                    .width(26.dp)
                    .cornerRadius(13.dp)
                    .background(WidgetTheme.accent)
                    .clickable(openQuickAdd()),
                contentAlignment = Alignment.Center
            ) {
                Text("＋", style = TextStyle(color = WidgetTheme.bg, fontSize = 16.sp, fontWeight = FontWeight.Bold))
            }
        }
        Spacer(GlanceModifier.height(6.dp))

        // Day-of-week header (Sun red, Sat blue)
        Row(modifier = GlanceModifier.fillMaxWidth()) {
            listOf("일", "월", "화", "수", "목", "금", "토").forEachIndexed { i, d ->
                val c = if (i == 0) WidgetTheme.red else if (i == 6) WidgetTheme.blue else WidgetTheme.muted
                Box(modifier = GlanceModifier.defaultWeight(), contentAlignment = Alignment.Center) {
                    Text(d, style = TextStyle(color = c, fontSize = 9.sp))
                }
            }
        }
        Spacer(GlanceModifier.height(2.dp))

        var cellIndex = 0
        while (cellIndex < totalCells) {
            Row(modifier = GlanceModifier.fillMaxWidth().defaultWeight()) {
                for (col in 0 until 7) {
                    val day = cellIndex - firstWeekday + 1
                    val inMonth = day in 1..daysInMonth
                    val isToday = inMonth && day == today.dayOfMonth
                    val ymd = if (inMonth)
                        "%04d-%02d-%02d".format(yearMonth.year, yearMonth.monthValue, day)
                    else ""
                    val isHoliday = inMonth && holidays.contains(ymd)
                    val dayEvents = if (inMonth) byDay[ymd].orEmpty() else emptyList()

                    val numColor = when {
                        isToday -> WidgetTheme.bg
                        isHoliday || col == 0 -> WidgetTheme.red
                        col == 6 -> WidgetTheme.blue
                        else -> WidgetTheme.fg
                    }
                    val subColor = if (isToday) WidgetTheme.bg else WidgetTheme.muted

                    var cellMod = GlanceModifier.defaultWeight().fillMaxHeight().padding(1.dp)
                    if (isToday) cellMod = cellMod.cornerRadius(6.dp).background(WidgetTheme.accent)
                    // Tapping an in-month day opens that day's event list.
                    if (inMonth) cellMod = cellMod.clickable(openDay(ymd))

                    Box(modifier = cellMod) {
                        if (inMonth) {
                            Column(modifier = GlanceModifier.fillMaxSize().padding(horizontal = 2.dp, vertical = 1.dp)) {
                                Text(
                                    day.toString(),
                                    style = TextStyle(
                                        color = numColor,
                                        fontSize = 10.sp,
                                        fontWeight = if (isToday || isHoliday) FontWeight.Bold else FontWeight.Normal
                                    )
                                )
                                dayEvents.take(2).forEach { ev ->
                                    Text(
                                        if (ev.all_day) "종일" else TimeFmt.short(ev.start_time),
                                        maxLines = 1,
                                        style = TextStyle(color = subColor, fontSize = 8.sp)
                                    )
                                }
                                if (dayEvents.size > 2) {
                                    Text("+${dayEvents.size - 2}", style = TextStyle(color = subColor, fontSize = 8.sp))
                                }
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
