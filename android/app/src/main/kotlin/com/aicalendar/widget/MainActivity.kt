package com.aicalendar.widget

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.OpenInNew
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.glance.appwidget.updateAll
import androidx.lifecycle.lifecycleScope
import com.aicalendar.widget.api.ApiClient
import com.aicalendar.widget.store.TokenStore
import com.aicalendar.widget.widgets.MonthWidget
import com.aicalendar.widget.widgets.NextEventWidget
import com.aicalendar.widget.widgets.TodayWidget
import com.aicalendar.widget.worker.RefreshScheduler
import kotlinx.coroutines.flow.collectLatest
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // Schedule periodic widget refresh on cold start
        RefreshScheduler.schedule(applicationContext)

        setContent {
            MaterialTheme(colorScheme = lightColorScheme(primary = Color(0xFF111111))) {
                Surface(modifier = Modifier.fillMaxSize(), color = Color(0xFFF7F7F5)) {
                    SetupScreen()
                }
            }
        }
    }
}

@Composable
fun SetupScreen() {
    val context = LocalContext.current
    val scope = (context as? ComponentActivity)?.lifecycleScope
    var current by remember { mutableStateOf<String?>(null) }
    var input by remember { mutableStateOf("") }
    var status by remember { mutableStateOf<String?>(null) }
    var validating by remember { mutableStateOf(false) }

    LaunchedEffect(Unit) {
        TokenStore.token(context).collectLatest {
            current = it
            if (input.isEmpty() && it != null) input = it
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp)
            .systemBarsPadding(),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text("AI 캘린더 위젯", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.SemiBold)
        Text(
            "위젯이 일정을 가져오려면 웹 앱에서 발급한 토큰이 필요합니다.\n" +
                "설정 → 캘린더 구독 → \"갤럭시·안드로이드 위젯 토큰\" 에서 복사한 값을 붙여넣어주세요.",
            style = MaterialTheme.typography.bodyMedium,
            color = Color(0xFF6B6B6B)
        )

        OutlinedButton(
            onClick = {
                val url = "${BuildConfig.WEB_BASE_URL}/settings"
                context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)))
            },
            modifier = Modifier.fillMaxWidth()
        ) {
            Icon(Icons.Default.OpenInNew, contentDescription = null)
            Spacer(Modifier.width(8.dp))
            Text("웹에서 토큰 받기")
        }

        OutlinedTextField(
            value = input,
            onValueChange = { input = it.trim() },
            label = { Text("ICS / 위젯 토큰") },
            placeholder = { Text("xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx") },
            modifier = Modifier.fillMaxWidth(),
            singleLine = true,
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Ascii)
        )

        Button(
            enabled = !validating && input.length >= 16,
            onClick = {
                scope?.launch {
                    validating = true
                    status = null
                    val ok = ApiClient.validateToken(input)
                    if (ok) {
                        TokenStore.save(context, input)
                        // Force-refresh all widget instances
                        TodayWidget().updateAll(context)
                        NextEventWidget().updateAll(context)
                        MonthWidget().updateAll(context)
                        status = "✓ 저장되었습니다. 홈 화면에 위젯을 추가해보세요."
                    } else {
                        status = "✗ 토큰이 유효하지 않습니다. 다시 확인해주세요."
                    }
                    validating = false
                }
            },
            modifier = Modifier.fillMaxWidth()
        ) {
            if (validating) {
                CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp, color = Color.White)
            } else {
                Icon(Icons.Default.CheckCircle, contentDescription = null)
            }
            Spacer(Modifier.width(8.dp))
            Text("토큰 저장")
        }

        status?.let {
            Text(it, color = if (it.startsWith("✓")) Color(0xFF059669) else Color(0xFFE11D48))
        }

        Spacer(Modifier.height(8.dp))

        Text(
            "위젯 추가 방법",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.SemiBold
        )
        Text(
            "1. 홈 화면 빈 공간 길게 누르기 → 위젯\n" +
                "2. 목록에서 \"AI 캘린더 위젯\" 찾기\n" +
                "3. 원하는 위젯(오늘 / 다음 일정 / 월간) 드래그",
            style = MaterialTheme.typography.bodyMedium,
            color = Color(0xFF6B6B6B)
        )

        current?.let {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    "현재 저장된 토큰: ${it.take(8)}…",
                    style = MaterialTheme.typography.bodySmall,
                    color = Color(0xFF6B6B6B),
                    fontFamily = FontFamily.Monospace
                )
                Spacer(Modifier.weight(1f))
                TextButton(onClick = {
                    scope?.launch {
                        TodayWidget().updateAll(context)
                        NextEventWidget().updateAll(context)
                        MonthWidget().updateAll(context)
                        status = "✓ 위젯을 새로고침했습니다."
                    }
                }) {
                    Icon(Icons.Outlined.Refresh, contentDescription = null)
                    Spacer(Modifier.width(4.dp))
                    Text("새로고침")
                }
            }
        }
    }
}
