# Linguaflow

AI-powered language learning mobile app with phoneme-level accent training.

**Repo:** https://github.com/imalfect/linguaflow-mobile

---

## What it is

Linguaflow centers on *pronunciation training*. The user picks (or types) a topic, AI generates a 10-task module of increasing difficulty (vocabulary → phrases → free speech), and for each task the user records themselves speaking the target sentence. Azure's Pronunciation Assessment scores every phoneme; the app paints the transcript green/yellow/red per sound and an LLM gives three short Polish hints for what to fix. 70 % accuracy unlocks the next task. Finish a module — pick another. XP and daily streaks keep score.

The UI is Polish, the learning target can be English (US/GB/AU), Italian, German, Spanish, Japanese, Chinese (Simplified), or Russian.

## Architecture

```
linguaflow-mobile/
├── apps/
│   ├── mobile/        # Tauri 2 + React 19 + Vite + Tailwind (iOS / Android)
│   └── api/           # SST 4 → AWS Lambda (HTTP API Gateway)
├── packages/
│   └── shared/        # Zod schemas + language config
├── supabase/
│   └── migrations/    # Database schema
└── docs/              # Contest documentation PDF (Polish)
```

| Layer | Tech |
|---|---|
| Mobile shell | Tauri 2 (iOS 13+, Android 24+) |
| Frontend | React 19, Vite, TailwindCSS, Zustand, React Router |
| Backend | SST 4 → AWS Lambda + API Gateway HTTP API (9 functions) |
| DB / Auth | Supabase (PostgreSQL + JWT) |
| Speech assessment | Azure Speech REST API (phoneme-granularity pronunciation) |
| LLM | Google Gemini 3.1 Flash Lite via OpenRouter (module/task generation, feedback) |
| TTS | OpenAI `gpt-4o-mini-tts` (target-sentence playback in the picked accent) |

Audio is captured client-side via Web Audio + a custom 16 kHz mono 16-bit PCM WAV encoder — so the Lambda layer is a thin proxy, no FFmpeg, no native deps.

---

## 1. Installation

Two paths: install a pre-built APK (fastest, for the contest jury) or build from source (full control, your own backend).

### 1.1 Pre-built APK

The shipped `linguaflow.apk` already has the server URL and Supabase keys baked in. Nothing to configure.

1. Copy the APK to an Android phone.
2. Allow installs from unknown sources: *Settings → Apps → Special app access → Install unknown apps → (your file manager) → Allow*.
3. Open the APK and confirm. Google Play Protect may warn — pick *Install anyway*.
4. Launch Linguaflow. It'll request the microphone permission on first recording — grant it.

Requirements: Android 7.0 (API 24)+, ~50 MB free space, internet, microphone.

### 1.2 Build from source

#### Prerequisites

| Tool | Version | Why |
|---|---|---|
| [bun](https://bun.sh) | 1.3+ | workspace manager + JS runtime |
| Node.js | 22 LTS | required by SST/Pulumi at deploy time |
| Rust + cargo | stable | Tauri 2 native shell |
| Android Studio | SDK 24+, NDK | Android build toolchain |
| [Supabase CLI](https://supabase.com/docs/guides/cli) | 2.x | migrations |
| AWS CLI | 2.x | auth for SST deploy |

#### Step 1 — Clone and install

```bash
git clone https://github.com/imalfect/linguaflow-mobile.git
cd linguaflow-mobile
bun install
```

#### Step 2 — External services

Create accounts (free tiers are enough):

- **Supabase** — database + auth (`supabase.com`)
- **AWS** — Lambda backend hosting (`aws.amazon.com`)
- **Azure Cognitive Services / Speech** — phoneme assessment, region `westeurope`, plan F0 (free)
- **OpenRouter** — LLM access (`openrouter.ai`)

#### Step 3 — `.env`

Copy `.env.example` to `.env` and fill in:

```sh
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
OPENROUTER_API_KEY=sk-or-...
OPENROUTER_MODEL=google/gemini-3.1-flash-lite-preview
OPENAI_API_KEY=sk-...
AZURE_SPEECH_KEY=...
AZURE_SPEECH_REGION=westeurope

VITE_SUPABASE_URL=https://<project>.supabase.co
VITE_SUPABASE_ANON_KEY=...
VITE_API_URL=https://<assigned-after-deploy>
```

#### Step 4 — Supabase database

```bash
supabase login
supabase link --project-ref <project-id>
supabase db push
```

The migration in `supabase/migrations/20260513000000_init.sql` creates all tables (`profiles`, `modules`, `module_tasks`, `pronunciation_sessions`, `level_test_results`), RLS policies, the auto-profile trigger, and the atomic `award_xp` RPC.

In the Supabase dashboard turn email confirmation off: *Authentication → Settings → Confirm email = OFF*.

#### Step 5 — AWS login

SST uses the standard AWS credential chain. Simplest path:

```bash
aws configure
# Access Key, Secret, region (eu-central-1)
```

If you use SSO / Identity Center, configure a profile with a `credential_process` directive so Pulumi can fetch credentials too.

#### Step 6 — Deploy the backend

```bash
cd apps/api

# Store secrets in SST (one-time)
bun sst secret set OPENROUTER_API_KEY "..." --stage production
bun sst secret set OPENROUTER_MODEL "google/gemini-3.1-flash-lite-preview" --stage production
bun sst secret set OPENAI_API_KEY "..." --stage production
bun sst secret set AZURE_SPEECH_KEY "..." --stage production
bun sst secret set AZURE_SPEECH_REGION "westeurope" --stage production
bun sst secret set SUPABASE_URL "..." --stage production
bun sst secret set SUPABASE_SERVICE_ROLE_KEY "..." --stage production

# Deploy
PATH="/opt/homebrew/opt/node@22/bin:$PATH" bun sst deploy --stage production
```

Output contains the API Gateway URL, e.g. `https://xxxxxxxxxx.execute-api.eu-central-1.amazonaws.com`. Paste it as `VITE_API_URL` in `.env`.

> **Note:** SST 4 internally runs Pulumi via Node. The packaged `@grpc/grpc-js` has serialization issues on Node 25/26 — pin Node 22 LTS on `PATH` for the deploy.

#### Step 7 — Build the Android APK

```bash
cd apps/mobile
bun run android:init                          # one-time
../../scripts/patch-android-manifest.sh        # adds RECORD_AUDIO permission
bun run android:build                          # release APK
```

Output: `apps/mobile/src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release.apk`.

#### Step 8 — Build for iOS (optional)

Linguaflow runs on iOS as well — same Rust crate, same WebView layer, same audio capture pipeline. Apple's distribution rules just add some constraints.

**Environment:**
- **macOS** (Apple won't let you build iOS elsewhere)
- **Xcode** 15+ with Command Line Tools
- An **Apple ID** added to Xcode (*Settings → Accounts*) — free works
- Rust targets: `rustup target add aarch64-apple-ios aarch64-apple-ios-sim x86_64-apple-ios`

> **Apple distribution caveats.** A free Apple ID (*Personal Team*) installs the app on your own USB-tethered iPhone, but the build expires after 7 days and can't be redistributed. Full distribution (App Store, TestFlight, ad-hoc) needs a paid **Apple Developer Program** account — $99/year. For the contest, the free tier is enough.

**Build sequence:**

```bash
cd apps/mobile
bun run ios:init                              # one-time — generates the Xcode project
../../scripts/patch-ios-plist.sh              # adds NSMicrophoneUsageDescription

# Dev mode — builds + installs to a connected iPhone, with live reload
bun run ios:dev

# Or: produce a debug .app for sideloading via Xcode → Devices and Simulators
bun --filter @linguaflow/mobile tauri ios build --debug
```

**Signing in Xcode** (one-time): open `apps/mobile/src-tauri/gen/apple/linguaflow.xcodeproj`, select the `linguaflow_iOS` target → *Signing & Capabilities* → set Team to your Apple ID → ensure *Automatically manage signing* is on → click *Try Again* if the profile is missing.

**Trust the dev profile on the iPhone** (one-time, after first install): *Settings → General → VPN & Device Management → Apple Development: \<your-email\> → Trust*.

The build expires every 7 days under a Personal Team — re-running `bun run ios:dev` refreshes it.

> **Heads up:** Xcode build scripts run with a stripped `PATH` that doesn't include `bun` / `cargo`. The generated `project.pbxproj` already has a PATH prelude in the *Build Rust Code* phase; if you re-run `tauri ios init`, re-apply the same patch.

---

## 2. Launch

### First launch & permissions

First screen has *Sign up* and *Sign in*. No configuration required — the APK ships with the server URL baked in. On first recording, iOS/Android will ask for microphone permission — granting it is required for accent assessment.

### Sign up

1. Tap *Załóż konto* on the welcome screen.
2. Enter name, email, password (6+ chars). No email verification needed.
3. The app signs you in and routes you to onboarding.

### Onboarding & level test

Three steps:

1. **Pick a language** — English, Italian, German, Spanish, Japanese, Chinese (Simplified), or Russian.
2. **Pick an accent** (English only) — American / British / Australian. Affects both the speech-recognition model and the TTS voice for sample playback.
3. **15-question level test** — alternating *vocabulary (MCQ)* / *speech (read the sentence)* / *translation (from Polish)*. The end screen shows your CEFR level (A1–C2), a per-category breakdown, and an AI-generated summary with three focus areas.

The test can be retaken from the *Profile* tab; results are stored and influence future task difficulty.

---

## 3. Operation

Linguaflow has one loop: **module → 10 tasks → next module**.

### 3.1 Picking a module

After onboarding (and after every completed module), three AI-generated topic suggestions appear, tuned to your level and avoiding recent topics — one practical (*"At the coffee shop"*), one fun (*"Reviewing a movie"*), one broader (*"Small talk about weather"*). Or type your own topic.

Generating the full module (with all 10 tasks) takes 10–20 seconds. Tasks scale in difficulty:
- **0–2** — *vocabulary*: single words or short phrases (2–4 words) with translation + IPA
- **3–6** — *phrases*: useful sentences in context (5–9 words)
- **7–9** — *free speech*: longer constructions (10–16 words)

For Japanese / Chinese / Russian, each task gets an extra romanization (romaji / pinyin / Latin transliteration).

### 3.2 Speech & accent recognition

The headline feature. Powered by **Azure Cognitive Services — Speech** (the same engine Microsoft uses commercially for language-tutor products).

Pipeline:

1. **Record.** Web Audio API captures raw PCM, the client resamples to 16 kHz mono and encodes a WAV blob (≈ 30–200 KB).
2. **Upload.** WAV bytes go to `/pronunciation/assess` along with the target sentence and language/accent.
3. **Score.** Lambda forwards the audio to Azure's pronunciation REST endpoint with `Granularity: Phoneme` + `EnableMiscue: true`. Azure returns four sentence-level scores plus per-word and per-phoneme accuracy.
4. **Feedback.** The result goes back to the client; in parallel `/pronunciation/feedback` asks the LLM for three short Polish hints based on the worst-scoring words.

Four metrics shown:

| Metric | What it means |
|---|---|
| **Accuracy** | How close each phoneme is to the reference pronunciation |
| **Fluency** | Pace and pause naturalness |
| **Completeness** | Did you actually say every word |
| **Prosody** | Stress and intonation — especially load-bearing for English |

The transcript is painted **per phoneme**:
- **Green** — score ≥ 80
- **Yellow** — 60–79
- **Red / coral** — < 60 or an error type (omission / insertion / mispronunciation)

Tapping a word reveals its IPA and a numeric score. Below the transcript: three concrete AI hints (*"Pronounce 'th' with the tongue between the teeth"*, *"Stress the second syllable in 'de-VE-lop'"*).

### 3.3 Task flow

1. **Read** — target sentence with IPA + Polish translation on top. Vocabulary tasks also show a list of 3–5 key words.
2. **Listen** — tap the speaker icon to hear the reference pronunciation (OpenAI TTS, picked accent).
3. **Record** — tap the yellow mic, speak, tap to stop.
4. **See results** — four scores, phoneme-painted transcript, three AI hints. ≥ 70 % accuracy unlocks the next task.
5. **Retry or continue** — failed attempts stay on the same task. Every attempt (passed or not) is logged in `pronunciation_sessions` for progress tracking.

### 3.4 XP

Every passing task (≥ 70 % accuracy) awards **15 XP**, accumulating in your profile. XP doesn't gate anything — it's a motivation signal. Awarded atomically through the `award_xp(user_id, xp)` RPC, which also bumps the streak in the same transaction.

### 3.5 Daily streaks

Number of consecutive days with at least one completed task:
- Same day as last activity → streak unchanged
- Next calendar day (UTC) → streak +1
- Gap of more than one day → streak resets to 1

The app tracks both the current streak (flame icon on home) and the all-time longest, which never decreases.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `tauri android init` fails on missing NDK | Set `ANDROID_HOME` and `NDK_HOME`, e.g. `export NDK_HOME=$ANDROID_HOME/ndk/<version>` |
| "Mic unavailable" on Android | Run `scripts/patch-android-manifest.sh` after `android:init` and grant the permission in system settings |
| `Azure assessment failed: 401` | Wrong `AZURE_SPEECH_KEY` or wrong region (it's part of the URL!) |
| `OpenRouter request failed: 401` | Wrong `OPENROUTER_API_KEY` or out of credit |
| iOS build → `No profiles for 'dev.imal.linguaflow'` | Open the Xcode project, set Team in *Signing & Capabilities*, enable automatic signing, plug in your iPhone |
| iOS build → `tauri terminated by signal SIGABRT` from Xcode Run button | Don't drive the build from Xcode UI — run `bun run ios:dev` from terminal instead |
| SST deploy → `b.Va is not a function` | Use Node 22 LTS for the deploy: `PATH="/opt/homebrew/opt/node@22/bin:$PATH" bun sst deploy ...` |
| Profile not created on signup | Check the migration ran — `on_auth_user_created` trigger handles profile creation |

---

## Contest submission

For the jury, the deliverable is:

1. **Source code** — this repository.
2. **Installable binary** — `linguaflow.apk` built per Step 7 above, already configured with the production backend.
3. **Installation guide** — the Polish PDF in `docs/Linguaflow-dokumentacja.pdf` covers it end-to-end (installation, launch, operation).

The APK ships with the backend URL and Supabase keys baked in, so the jury only needs to install and run.
