# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the App

### Local Development (Recommended: Vercel CLI)

```bash
# Install Vercel CLI globally (one-time)
npm install -g vercel

# Create .env file with your API key
echo "GOOGLE_GENERATIVE_AI_API_KEY=your-key-here" > .env

# Run local dev server (serves static + API routes)
vercel dev
```

Access at http://localhost:3000

### Alternative: Separate Servers

If you prefer not to use Vercel CLI, you need to run both static files and a mock API.

## Setup Requirements

1. Create `.env` from template:
```bash
cp .env.example .env
```

2. Add your Gemini API key to `.env`. Get key from: https://makersuite.google.com/app/apikey

**Critical:** `.env` is git-ignored. Never commit API keys.

## Architecture Overview

This is a vanilla JavaScript single-page application deployed on Vercel with a serverless backend for secure API key handling.

### Project Structure

```
spelling-words/
├── api/
│   └── extract-words.js      # Serverless function (Gemini API proxy)
├── public/                   # Static files
│   ├── index.html
│   ├── css/styles.css
│   └── js/
│       ├── app.js            # Central orchestrator
│       ├── camera.js         # Camera capture and file upload
│       ├── ocr.js            # Calls /api/extract-words
│       ├── practice.js       # Practice session management
│       └── speech.js         # Text-to-speech
├── .env                      # Local env vars (git-ignored)
├── .env.example              # Template
├── package.json
└── vercel.json               # Routing config
```

### Module Communication Pattern

The app uses an **ES6 class orchestrator** pattern where `app.js` coordinates all modules:

```
App (app.js) - ES6 class orchestrator, exposed as window.app
├─> CameraModule (camera.js) - Provides callbacks: onCapture(imageData), onError(message)
├─> OCRModule (ocr.js) - Returns Promise<string[]>, calls /api/extract-words
├─> PracticeSession (practice.js) - Class-based state management
└─> SpeechModule (speech.js) - Provides speak(word, onSuccess, onError)
```

**Key pattern:** Utility modules (camera, ocr, speech) export a public API via `return {}` at the end of their IIFE. App.js uses an ES6 class exposed globally via `window.app`. No ES6 imports - modules communicate via global namespace objects.

### View State Machine

The app has 4 views (only one visible at a time):

1. **camera-view** → User captures/uploads image
2. **processing-view** → API processes image (1-3 seconds)
3. **confirmation-view** → User reviews extracted words
4. **practice-view** → User practices spelling words

State transitions are handled by `App.showView(viewName)` which hides all views and shows the requested one.

### Data Flow

```
Camera Capture → Image Preprocessing (brightness/contrast) → Base64 Data URL
    ↓
/api/extract-words → Gemini Vision API → JSON array of words → Word validation
    ↓
PracticeSession class → Shuffled word queue (Fisher-Yates)
    ↓
Speech API → Voice selection (quality scoring) → TTS output
```

### Critical Module Interfaces

**OCRModule.extractWords(imageData, progressCallback)**
- Expects: data URL (base64 PNG with prefix)
- Returns: Promise<string[]> of lowercase words
- Calls progressCallback(statusText, percentage) at 10%, 30%, 50%, 80%, 100%
- Throws on API errors with user-friendly messages

**PracticeSession class**
- Constructor: Takes word array, shuffles immediately
- `getNextWord()`: Returns next word, increments counter, sets currentWord
- `getCurrentWord()`: Returns last spoken word (for repeat feature)
- Auto-reshuffles when all words used (infinite practice)
- **Important:** Counter increments only on getNextWord(), not on repeat

**SpeechModule.speak(word, onSuccess, onError)**
- Voice selection uses quality scoring algorithm (see public/js/speech.js:53-80)
- Prioritizes: premium/enhanced/neural > Google/Microsoft > en-US > female voices
- Configured: rate=0.9, pitch=1.1 for clarity
- Cancels any in-flight speech before starting new

**CameraModule preprocessing**
- Applied to both camera captures and file uploads
- Brightness +10, Contrast +50 via pixel manipulation
- Max resolution capped at 1920px (performance)

## Backend API

### /api/extract-words (POST)

Serverless function that proxies Gemini Vision API using `gemini-2.5-flash` model.

**Request:**
```json
{
  "imageData": "data:image/png;base64,..."
}
```

**Response (success):**
```json
{
  "words": ["apple", "banana", "challenge"]
}
```

**Response (error):**
```json
{
  "error": "Error message here"
}
```

**Word validation:**
- Minimum 2 characters
- Must contain at least one letter
- At least 50% of characters must be letters (filters out mostly-numeric entries)
- Words are cleaned (lowercase, punctuation stripped from ends)

**Error handling:** Maps API errors to user-actionable messages (401=invalid key, 429=quota exceeded).

**Security:**
- **Origin validation:** Only requests from allowed origins are accepted. Configure via `ALLOWED_ORIGINS` env var (comma-separated). Defaults to localhost for development. Supports wildcards (e.g., `*.vercel.app`).
- **Rate limiting:** 10 requests per minute per IP (in-memory, per-instance). Returns 429 with `retryAfter` field when exceeded.
- **CORS:** Strict CORS headers only allow configured origins.

Rate limit constants are at the top of `api/extract-words.js`:
```javascript
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10;
```

## Important Implementation Details

### Word Counter Behavior
The counter shows "Word X of Y" where:
- X = total words spoken across all cycles (never resets)
- Y = total unique words in list (constant)
- This creates an incrementing practice counter (1, 2, 3...) not a position indicator

### Repeat Button State
- Initially disabled when practice session starts
- Enabled after first word spoken
- Calls `practiceSession.getCurrentWord()`
- Does NOT increment counter
- Re-disabled when starting new sheet

### View Transitions
When transitioning views, app.js must:
1. Update any state needed for new view
2. Call `showView(viewName)`
3. Initialize view-specific UI (enable/disable buttons, reset displays)

Example: `startPractice()` must disable repeat button before showing practice view.

### Image Preprocessing Location
Preprocessing happens in camera.js BEFORE sending to ocr.js. This is intentional - Gemini API benefits from enhanced contrast/brightness, and we avoid duplicate preprocessing between capture and upload paths.

## Common Modifications

### Adding New Word Patterns
Modify the `EXTRACTION_PROMPT` in `api/extract-words.js` to instruct Gemini to look for new patterns. The AI understands natural language instructions.

### Changing Speech Settings
Voice quality scoring in public/js/speech.js:53-80. Adjust scores to change voice priority.
Speech parameters in public/js/speech.js:101-103 (rate, pitch, volume).

### Modifying UI Flow
Views are in public/index.html. Each view div has `id="*-view"`.
State management in app.js properties: currentView, extractedWords, practiceSession.

### API Error Handling
OCR errors are thrown from ocr.js and caught in app.js.
Always provide actionable user messages (don't just show raw errors).

## Testing Checklist

When making changes, manually test:
1. Camera capture AND file upload paths (both go through preprocessing)
2. API error states (invalid key, quota exceeded, network offline)
3. Repeat button enable/disable logic across view transitions
4. Word counter incrementing correctly (next vs repeat)
5. View transitions maintain proper state (no leftover UI states)
6. Check browser console for voice selection logs (helps debug speech issues)

## File Modification Guidelines

**.env** - Never commit (git-ignored). User-created from template.

**public/index.html** - Single file contains all views. app.js must load last.

**public/css/styles.css** - Mobile-first responsive design with hardcoded color values (primary: #667eea, accent: #764ba2, success: #10b981). Includes accessibility support (prefers-reduced-motion, high-contrast mode). No CSS preprocessing.

**public/js/** - Utility modules (camera, ocr, speech, practice) are self-contained IIFEs. app.js is an ES6 class. No ES6 imports/exports - modules use global namespace. Keep public APIs minimal.

**api/extract-words.js** - Serverless function using Vercel AI SDK (`@ai-sdk/google`) with `gemini-2.5-flash` model. Reads `GOOGLE_GENERATIVE_AI_API_KEY` or `GEMINI_API_KEY` from process.env (either works).

## Browser Compatibility Notes

**Camera access:** Requires HTTPS or localhost (security restriction)

**Speech API:** Voice availability varies by browser/OS. Always check console logs to see what voices are available.

**Fetch API:** Required for API calls (all modern browsers)

## Deployment

### Deploy to Vercel

1. Push to GitHub
2. Connect repo to Vercel dashboard
3. Add `GOOGLE_GENERATIVE_AI_API_KEY` environment variable in Vercel dashboard
4. Deploy

Vercel automatically:
- Serves `/public/*` as static files
- Runs `/api/*` as serverless functions
- Provides HTTPS (required for camera access)
