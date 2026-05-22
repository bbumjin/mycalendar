package com.aicalendar.widget.widgets

import android.content.Context
import androidx.compose.ui.graphics.Color
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
import androidx.glance.unit.ColorProvider
import com.aicalendar.widget.api.ApiClient
import com.aicalendar.widget.api.WidgetEvent
import com.aicalendar.widget.store.TokenStore
import com.aicalendar.widget.widgets.WidgetTheme.BG
import com.aicalendar.widget.widgets.WidgetTheme.FG
import com.aicalendar.widget.widgets.WidgetTheme.MUTED

class TodayWidget : GlanceAppWidget() {

    override val sizeMode = androidx.glance.appwidget.SizeMode.Exact

    override suspend fun provideGlance(context: Context, id: GlanceId) {
        val token = TokenStore.get(context)
        val events: List<WidgetEvent> = if (token == null) {
            emptyList()
        } else {
            runCatching { ApiClient.today(token).events }.getOrDefault(emptyList())
        }

        provideContent {
            GlanceTheme {
                if (token == null) NotConfigured() else TodayBody(events)
            }
        }
    }
}

@androidx.compose.runtime.Composable
private fun TodayBody(events: List<WidgetEvent>) {
    Column(
        modifier = GlanceModifier
            .fillMaxSize()
            .background(ColorProvider(BG))
            .cornerRadius(20.dp)
            .padding(14.dp)
            .clickable(openApp())
    ) {
        Text(
            "오늘",
            style = TextStyle(color = ColorProvider(MUTED), fontSize = 11.sp, fontWeight = FontWeight.Medium)
        )
        Spacer(GlanceModifier.height(4.dp))
        if (events.isEmpty()) {
            Text("일정이 없습니다.", style = TextStyle(color = ColorProvider(FG), fontSize = 14.sp))
        } else {
            events.take(4).forEach { e ->
                Row(
                    modifier = GlanceModifier.fillMaxWidth().padding(vertical = 3.dp),
                    verticalAlignment = Alignment.CenterVertically
                ) {
                    ProviderDot(e.source_provider)
                    Spacer(GlanceModifier.width(6.dp))
                    Text(
                        TimeFmt.short(e.start_time),
                        style = TextStyle(color = ColorProvider(MUTED), fontSize = 12.sp),
                        modifier = GlanceModifier.width(48.dp)
                    )
                    Text(
                        e.title,
                        maxLines = 1,
                        style = TextStyle(color = ColorProvider(FG), fontSize = 13.sp, fontWeight = FontWeight.Medium)
                    )
                }
            }
            if (events.size > 4) {
                Text("+${events.size - 4}개 더", style = TextStyle(color = ColorProvider(MUTED), fontSize = 11.sp))
            }
        }
    }
}

@androidx.compose.runtime.Composable
internal fun NotConfigured() {
    Box(
        modifier = GlanceModifier
            .fillMaxSize()
            .background(ColorProvider(BG))
            .cornerRadius(20.dp)
            .padding(16.dp)
            .clickable(openApp()),
        contentAlignment = Alignment.Center
    ) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text("AI 캘린더", style = TextStyle(color = ColorProvider(FG), fontSize = 14.sp, fontWeight = FontWeight.Bold))
            Spacer(GlanceModifier.height(4.dp))
            Text("탭하여 토큰 설정", style = TextStyle(color = ColorProvider(MUTED), fontSize = 11.sp))
        }
    }
}

@androidx.compose.runtime.Composable
internal fun ProviderDot(provider: String?) {
    val color = when (provider) {
        "google" -> Color(0xFF4285F4)
        "microsoft" -> Color(0xFF0078D4)
        else -> Color(0xFF111111)
    }
    Box(
        modifier = GlanceModifier
            .width(7.dp)
            .height(7.dp)
            .cornerRadius(4.dp)
            .background(ColorProvider(color))
    ) {}
}

class TodayWidgetReceiver : GlanceAppWidgetReceiver() {
    override val glanceAppWidget: GlanceAppWidget = TodayWidget()
}
