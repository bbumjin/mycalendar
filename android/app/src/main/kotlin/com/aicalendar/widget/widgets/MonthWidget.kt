package com.aicalendar.widget.widgets

import android.content.Context
import android.content.Intent
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.glance.GlanceId
import androidx.glance.GlanceModifier
import androidx.glance.GlanceTheme
import androidx.glance.action.actionStartActivity
import androidx.glance.action.clickable
import androidx.glance.appwidget.GlanceAppWidget
import androidx.glance.appwidget.GlanceAppWidgetReceiver
import androidx.glance.appwidget.cornerRadius
import androidx.glance.appwidget.provideContent
import androidx.glance.background
import androidx.glance.color.ColorProvider
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
import com.aicalendar.widget.MainActivity
import com.aicalendar.widget.api.ApiClient
import com.aicalendar.widget.store.TokenStore
import com.aicalendar.widget.widgets.WidgetTheme.ACCENT
import com.aicalendar.widget.widgets.WidgetTheme.BG
import com.aicalendar.widget.widgets.WidgetTheme.FG
import com.aicalendar.widget.widgets.WidgetTheme.MUTED
import java.time.LocalDate
import java.time.YearMonth
import java.time.ZoneId

class MonthWidget : GlanceAppWidget() {

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val token = TokenStore.get(context)
        val today = LocalDate.now(ZoneId.of("Asia/Seoul"))
        val ym = "%04d-%02d".format(today.year, today.monthValue)
        val daysWith = if (token == null) emptySet()
        else runCatching { ApiClient.month(token, ym).days_with_events.toSet() }.getOrDefault(emptySet())

        provideContent {
            GlanceTheme {
                if (token == null) {
                    NotConfigured(context)
                } else {
                    MonthBody(today, daysWith, context)
                }
            }
        }
    }
}

@androidx.compose.runtime.Composable
private fun MonthBody(today: LocalDate, daysWith: Set<String>, context: Context) {
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
            .clickable(actionStartActivity(Intent(context, MainActivity::class.java)))
    ) {
        Text(
            "${yearMonth.year}년 ${yearMonth.monthValue}월",
            style = TextStyle(color = ColorProvider(FG), fontSize = 14.sp, fontWeight = FontWeight.Bold)
        )
        Spacer(GlanceModifier.height(8.dp))

        // Day-of-week header
        Row(modifier = GlanceModifier.fillMaxWidth()) {
            listOf("일", "월", "화", "수", "목", "금", "토").forEach { d ->
                Box(modifier = GlanceModifier.defaultWeight(), contentAlignment = Alignment.Center) {
                    Text(d, style = TextStyle(color = ColorProvider(MUTED), fontSize = 10.sp))
                }
            }
        }
        Spacer(GlanceModifier.height(4.dp))

        // Day cells in rows of 7
        var cellIndex = 0
        while (cellIndex < totalCells) {
            Row(modifier = GlanceModifier.fillMaxWidth().padding(vertical = 2.dp)) {
                for (col in 0 until 7) {
                    val day = cellIndex - firstWeekday + 1
                    val inMonth = day in 1..daysInMonth
                    val isToday = inMonth && day == today.dayOfMonth
                    val ymd = if (inMonth)
                        "%04d-%02d-%02d".format(yearMonth.year, yearMonth.monthValue, day)
                    else ""
                    val hasEvent = inMonth && daysWith.contains(ymd)

                    Box(
                        modifier = GlanceModifier.defaultWeight().height(28.dp),
                        contentAlignment = Alignment.Center
                    ) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally) {
                            if (inMonth) {
                                if (isToday) {
                                    Box(
                                        modifier = GlanceModifier
                                            .width(20.dp)
                                            .height(20.dp)
                                            .cornerRadius(12.dp)
                                            .background(ColorProvider(ACCENT)),
                                        contentAlignment = Alignment.Center
                                    ) {
                                        Text(
                                            day.toString(),
                                            style = TextStyle(color = ColorProvider(BG), fontSize = 11.sp, fontWeight = FontWeight.Bold)
                                        )
                                    }
                                } else {
                                    Text(
                                        day.toString(),
                                        style = TextStyle(color = ColorProvider(FG), fontSize = 11.sp)
                                    )
                                }
                                if (hasEvent && !isToday) {
                                    Spacer(GlanceModifier.height(2.dp))
                                    Box(
                                        modifier = GlanceModifier
                                            .width(4.dp)
                                            .height(4.dp)
                                            .cornerRadius(2.dp)
                                            .background(ColorProvider(ACCENT))
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
