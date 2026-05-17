# AI 캘린더 위젯 (Android, One UI 7 / Galaxy Fold 7)

홈 화면에서 일정을 한눈에 보여주는 Jetpack Glance 위젯 3종.

| 위젯 | 사이즈 | 내용 |
|---|---|---|
| **오늘** | 4×2 | 오늘 남은 일정 (최대 4개) |
| **다음 일정** | 4×2 | 가장 가까운 일정 + 권장 알림 시각 |
| **월간** | 4×4 | 이번 달 달력, 일정 있는 날에 점 |

모두 클릭하면 토큰 설정 화면이 열립니다. 데이터는 웹 앱(<https://mycalendar-nine.vercel.app>)의 widget API에서 받아옵니다.

---

## 빌드 & 설치 (Android Studio)

### 1. Android Studio 준비
- [Android Studio](https://developer.android.com/studio) Ladybug 이상 설치
- SDK Manager로 **Android 14 (API 34)** 및 **Android 15 (API 35)** 설치
- 갤럭시 Z Fold 7에서 **개발자 옵션 → USB 디버깅** 켜기

### 2. 프로젝트 열기
1. Android Studio 실행 → **Open** → 이 저장소의 `android/` 폴더 선택
2. Gradle sync가 끝날 때까지 대기 (처음엔 5–10분)

### 3. (옵션) Base URL 변경
`android/local.properties`에 한 줄 추가하면 다른 배포 URL로 빌드할 수 있습니다 (기본은 `https://mycalendar-nine.vercel.app`):
```
WEB_BASE_URL=https://your-domain.example
```

### 4. APK 빌드 + 설치
- USB로 Fold 7 연결
- Android Studio 상단 디바이스 셀렉터에서 폰 선택
- **Run** ▶ 버튼 클릭 (또는 Shift+F10)
- 폰에서 "출처를 알 수 없는 앱 설치" 허용 요청이 뜨면 허용

명령줄로:
```bash
cd android
./gradlew installDebug
```

### 5. 토큰 등록
1. 폰 Chrome으로 <https://mycalendar-nine.vercel.app/settings> 접속
2. 로그인 후 "캘린더 구독" → "갤럭시·안드로이드 위젯 토큰" → "복사"
3. 폰에서 **AI 캘린더 위젯** 앱 실행 → 토큰 붙여넣기 → "토큰 저장"
4. "✓ 저장되었습니다" 보이면 성공

### 6. 홈 화면에 위젯 추가
1. 홈 화면 빈 곳 길게 누르기 → 위젯
2. "AI 캘린더 위젯" 찾기
3. 원하는 위젯 드래그 (오늘 / 다음 일정 / 월간)
4. Fold 7 외부 화면·내부 화면 모두 사이즈 조정 가능

---

## 동작 방식

- 위젯이 표시될 때마다 `provideGlance()`가 호출되어 `/api/widget/*?token=<ICS_TOKEN>` 에서 데이터를 가져옵니다.
- 추가로 `WorkManager` 가 **15분마다** 자동 새로고침합니다 (Wi-Fi/모바일 데이터 연결시).
- 위젯 탭 → 메인 앱(`MainActivity`) 열림 → 토큰 관리, 강제 새로고침.

### 인증
- ICS 구독에 쓰는 토큰을 위젯이 재사용합니다 (`profiles.ics_token`).
- 서버 사이드: `/api/widget/*` 가 쿠키 세션 또는 `?token=` 쿼리스트링 둘 다 받아 처리.
- `lib/widget-auth.ts → resolveWidgetUser()` 가 토큰을 검증하고 user_id 를 돌려줌.

### 알림
- 알림 자체는 위젯이 발화하지 않고, **폰의 기본 Google 캘린더 / Samsung 캘린더 앱**이 처리합니다 (이미 동기화된 상태이므로).
- 위젯은 단지 **글러서블 정보**만 표시.

---

## 디렉토리 구조

```
android/
├── build.gradle.kts                          # 루트 Gradle (플러그인 버전 고정)
├── settings.gradle.kts
├── gradle.properties
├── app/
│   ├── build.gradle.kts                       # 앱 모듈 (compose, glance, ktor, datastore, workmanager)
│   ├── proguard-rules.pro
│   └── src/main/
│       ├── AndroidManifest.xml
│       ├── kotlin/com/aicalendar/widget/
│       │   ├── MainActivity.kt                # 토큰 입력 + 위젯 새로고침 UI
│       │   ├── api/
│       │   │   ├── ApiClient.kt               # Ktor HTTP client
│       │   │   └── Models.kt                  # @Serializable DTO들
│       │   ├── store/
│       │   │   └── TokenStore.kt              # Preferences DataStore
│       │   ├── widgets/
│       │   │   ├── TodayWidget.kt
│       │   │   ├── NextEventWidget.kt
│       │   │   ├── MonthWidget.kt
│       │   │   └── Theme.kt                   # 색상 + 시간 포맷터
│       │   └── worker/
│       │       └── RefreshWorker.kt           # WorkManager 주기 작업
│       └── res/
│           ├── xml/                            # 각 위젯의 appwidget-provider XML
│           ├── values/                         # strings, colors, themes
│           ├── drawable/                       # 런처 아이콘 foreground
│           ├── mipmap-anydpi-v26/              # 적응형 아이콘
│           └── layout/
│               └── widget_glance_initial.xml   # 위젯 첫 표시될 폴백 레이아웃
```

---

## 트러블슈팅

**"토큰이 유효하지 않습니다"가 나옴**
- 웹 설정에서 다시 토큰 복사 (앞뒤 공백 주의)
- 웹 앱이 배포 중이면 잠시 후 재시도

**위젯에 "탭하여 토큰 설정"이 계속 보임**
- 메인 앱에서 토큰 저장이 끝났는지 확인
- 앱에서 "새로고침" 버튼 누르기
- 위젯을 삭제하고 다시 추가

**위젯이 업데이트 안 됨**
- Settings → 배터리 → AI 캘린더 위젯 → 백그라운드 제한 해제
- 폰을 재부팅하면 WorkManager가 다시 스케줄됨

**일정이 일부만 보임**
- `oncePresent provideGlance()` 응답 사이즈에는 한계가 있어 오늘 위젯은 4개, 다음 일정 위젯은 1개만 표시. 자세히 보려면 위젯 탭 → 웹앱.

---

## 다음 단계 (선택)

- Play Store 내부 테스트 채널에 업로드해 OTA로 받기
- 위젯 알림 권한 → 폰 시스템 알림 (현재는 캘린더 앱에 위임)
- 사용자별 색상 테마, 어두운 모드 추가 토큰
