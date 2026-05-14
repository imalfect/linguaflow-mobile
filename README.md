# Linguaflow

Trener akcentu i wymowy oparty o AI. Aplikacja mobilna w Tauri 2 (iOS / Android), z serverless backendem na AWS Lambda i bazą w Supabase.

## Architektura

```
linguaflow-mobile/
├── apps/
│   ├── mobile/        # Tauri 2 + React + Vite + Tailwind (iOS / Android / Desktop)
│   └── api/           # SST v3 → AWS Lambda (HTTP API Gateway)
├── packages/
│   └── shared/        # Wspólne typy i schematy Zod
└── supabase/
    └── migrations/    # Schema bazy danych
```

**Stack**

- **UI**: React 19, Vite, TailwindCSS, Zustand, React Router
- **Mobilność**: Tauri 2 (iOS 13+, Android 24+)
- **Backend**: SST v3 → AWS Lambda + API Gateway HTTP API
- **DB / Auth**: Supabase
- **AI**: OpenRouter (Gemini 2.0 Flash) do generowania zadań i ocen, Azure Speech do oceny wymowy (REST API z analizą fonemów), OpenAI gpt-4o-mini-tts do odsłuchu

**Klucze różnice względem starej wersji**

- Tylko mobile (Tauri) — usunięte zostały tryb dialogowy, realtime API i ścieżka nauki.
- Główny przepływ to **moduły 10-zadaniowe** generowane przez AI: użytkownik wybiera jeden z trzech proponowanych tematów (lub wpisuje własny), wykonuje 10 zadań rosnącej trudności, po ukończeniu wybiera nowy moduł.
- Trening akcentu pozostaje zrealizowany w identyczny sposób (Azure Pronunciation Assessment + fonemy + AI tips), ale audio jest kodowane jako WAV PCM po stronie klienta — Lambda nie wymaga FFmpeg.
- Punkty + dzienna passa (streak) za poprawne zadania.

## 1. Wymagania

- [bun](https://bun.sh) 1.3+
- [Node.js](https://nodejs.org) 20+
- [Rust](https://www.rust-lang.org) (do Tauri)
- [Android Studio](https://developer.android.com/studio) (SDK 24+, NDK) — dla buildów Androida
- [Xcode](https://developer.apple.com/xcode/) — dla buildów iOS (tylko macOS)
- Konto AWS + skonfigurowane `aws-cli` (do deploya backendu)
- Konto Supabase
- Klucze: `OPENROUTER_API_KEY`, `OPENAI_API_KEY`, `AZURE_SPEECH_KEY`

## 2. Pierwsze uruchomienie

```bash
# instalacja zależności
bun install

# skopiuj plik .env.example i uzupełnij własnymi wartościami
cp .env.example .env
```

## 3. Supabase

```bash
# zainstaluj Supabase CLI
brew install supabase/tap/supabase

# zaloguj się i zlinkuj projekt
supabase login
supabase link --project-ref <PROJECT_REF>

# wypchnij schemat bazy
supabase db push
```

Migracja w `supabase/migrations/20260513000000_init.sql` tworzy:

- `profiles` (xp, streak, wykryty poziom)
- `modules` (lista modułów użytkownika)
- `module_tasks` (10 zadań na moduł)
- `pronunciation_sessions` (historia ocen)
- `level_test_results`
- Trigger auto-tworzący profil po rejestracji
- RPC `award_xp` — atomicznie zwiększa XP i passę
- RLS policies dla wszystkich tabel

W Supabase Dashboard wyłącz potwierdzenie e-maila: **Auth → Settings → "Confirm email"** = OFF.

## 4. Deploy backendu (SST → AWS Lambda)

```bash
cd apps/api

# zapisz sekrety w SST (raz, na środowisko)
bun sst secret set OPENROUTER_API_KEY "sk-or-..." --stage production
bun sst secret set OPENAI_API_KEY "sk-..." --stage production
bun sst secret set AZURE_SPEECH_KEY "..." --stage production
bun sst secret set AZURE_SPEECH_REGION "westeurope" --stage production
bun sst secret set SUPABASE_URL "https://...supabase.co" --stage production
bun sst secret set SUPABASE_SERVICE_ROLE_KEY "eyJ..." --stage production
bun sst secret set SUPABASE_JWT_SECRET "...jwt-secret-z-supabase..." --stage production

# deploy
bun sst deploy --stage production
```

Po deployu zobaczysz URL API w outputach, np.
`https://xxxxxx.execute-api.eu-central-1.amazonaws.com`. Zapisz go — wjedzie do `.env` mobile'a.

**Tańszy wariant**: `bun sst dev` uruchamia backend lokalnie i tuneluje funkcje przez AWS. Idealny do iteracji.

### Endpointy

Wszystkie metoda POST. Routy wymagające autoryzacji oczekują `Authorization: Bearer <supabase-access-token>`:

| Route | Auth | Opis |
|---|---|---|
| `/pronunciation/task` | ✓ | Zwraca zdanie do ćwiczenia + IPA |
| `/pronunciation/assess` | ✓ | Body = WAV PCM 16kHz mono; nagłówki: `X-Target-Sentence` (urlencoded), `X-Language`, `X-Accent` |
| `/pronunciation/feedback` | ✓ | 3 wskazówki po polsku na podstawie błędów |
| `/level-test/question` | — | Generuje pytanie testu poziomu |
| `/level-test/evaluate` | — | Ocenia tłumaczenie |
| `/level-test/result` | — | Liczy poziom + streszczenie |
| `/modules/suggest` | ✓ | 3 sugestie modułów |
| `/modules/generate` | ✓ | Pełny moduł (10 zadań) dla wybranego tematu |
| `/tts` | ✓ | Audio MP3 z wymową target sentence |

## 5. Aplikacja mobilna

### Wartości w `.env` aplikacji

Vite czyta tylko `VITE_*`. Plik `.env` w `apps/mobile/` musi zawierać:

```
VITE_SUPABASE_URL=https://...supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_API_URL=https://<sst-output>.execute-api.eu-central-1.amazonaws.com
```

### Dev (webview na komputerze)

```bash
bun run dev:mobile
# Otwórz http://localhost:1420
```

### Android (APK)

```bash
# 1. inicjalizacja projektu Android (raz)
cd apps/mobile && bun run android:init

# 2. patch manifestu (dodaje RECORD_AUDIO)
cd ../.. && ./scripts/patch-android-manifest.sh

# 3. dev (urządzenie podłączone przez USB lub emulator)
cd apps/mobile && bun run android:dev

# 4. APK release
bun run android:build
# Wynik: apps/mobile/src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release.apk
```

Patch dodaje:
- `<uses-permission android:name="android.permission.RECORD_AUDIO" />`
- `<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />`
- `android:usesCleartextTraffic="true"` (dla dev)

### iOS (.ipa)

```bash
# 1. inicjalizacja projektu iOS (raz)
cd apps/mobile && bun run ios:init

# 2. patch Info.plist (dodaje NSMicrophoneUsageDescription)
cd ../.. && ./scripts/patch-ios-plist.sh

# 3. dev
cd apps/mobile && bun run ios:dev

# 4. release build (wymaga certyfikatu/team ID skonfigurowanego w Xcode)
bun run ios:build
```

## 6. Zgłoszenie do konkursu

Komisja powinna dostać:

1. **Kod źródłowy** — to repo.
2. **Plik wykonywalny** — `app-universal-release.apk` z kroku Android wyżej.
3. **Adres backendu** — wkleić do `VITE_API_URL` przed buildem APK (już jest, jeśli `.env` był poprawny).
4. **Instrukcję instalacji** — wystarczy *Zainstaluj APK → nadaj uprawnienie do mikrofonu → załóż konto → przejdź test poziomu*.

Sam APK ma już w sobie zalinkowany backend i URL do Supabase — komisja nie musi nic konfigurować.

## 7. Najczęstsze problemy

| Problem | Rozwiązanie |
|---|---|
| `tauri android init` nie znajduje NDK | Ustaw `ANDROID_HOME` i `NDK_HOME`, np. `export NDK_HOME=$ANDROID_HOME/ndk/<wersja>` |
| `Mikrofon nie jest dostępny` na Androidzie | Sprawdź, czy patch manifestu został zastosowany i czy aplikacja ma uprawnienie w ustawieniach systemowych |
| `Azure assessment failed: 401` | Złe `AZURE_SPEECH_KEY` / `AZURE_SPEECH_REGION` — sprawdź region (region jest częścią URL!) |
| `OpenRouter request failed: 401` | Złe `OPENROUTER_API_KEY` — sprawdź credit balance |
| Trzeci kompendium "Empty audio body" | Webview nie dostał uprawnień; mikrofon był rzeczywiście wyciszony lub permission denied |
| Profil nie istnieje po rejestracji | Trigger `on_auth_user_created` nie zadziałał — sprawdź, czy migracja `20260513000000_init.sql` została wypchnięta |

## 8. Roadmap (po konkursie)

- Tryb offline z cache modułów
- TTS na urządzeniu (np. RustNative)
- Wymowa pojedynczych słów ze słownictwa (klik = wymowa eksperta)
- Pełna historia sesji + heatmapa najtrudniejszych fonemów
