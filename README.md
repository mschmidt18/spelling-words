# Spelling Word Practice Web App

A simple single-page web application that uses camera capture and AI vision to extract spelling words from a paper sheet, then speaks words randomly via text-to-speech for practice sessions.

## Features

- Camera capture or file upload for spelling word sheets
- **AI-powered OCR using Google Gemini Vision API** for accurate word extraction
- **Secure backend** - API key stored server-side, not exposed to browser
- **API protection** - Origin validation and rate limiting to prevent abuse
- **Enhanced text-to-speech** with optimized voice selection for clarity
- **Repeat button** to hear the current word again
- Random word selection with no repeats until all words used
- Mobile-friendly responsive design
- No data persistence - session-based only

## Quick Start (Deployed Version)

If deployed to Vercel, just visit the URL. No setup required for end users.

## Local Development

### Prerequisites

- Node.js installed
- A Gemini API key from [Google AI Studio](https://makersuite.google.com/app/apikey)

### Setup

1. Clone the repository

2. Create `.env` file with your API key:
   ```bash
   cp .env.example .env
   ```

3. Edit `.env` and add your Gemini API key:
   ```
   GOOGLE_GENERATIVE_AI_API_KEY=your-api-key-here
   ```

4. Install and run with Vercel CLI:
   ```bash
   npm install -g vercel
   vercel dev
   ```

5. Open http://localhost:3000 in your browser

**Important:** The `.env` file is git-ignored to protect your API key. Never commit API keys to version control.

## How to Use

### Using the App

1. **Capture Image**
   - Allow camera access when prompted
   - Point camera at spelling word sheet
   - Click "Capture Image" or use "Upload Image" button

2. **Review Words**
   - The Gemini Vision API will process the image (typically 1-3 seconds)
   - Review the extracted words
   - Click "Begin Practice" to start or "Retake Picture" if words are incorrect

3. **Practice Session**
   - Click "Speak Word" to hear a random word
   - Click "Repeat Word" to hear the same word again (doesn't advance counter)
   - The word will NOT be displayed on screen
   - No word repeats until all words have been used
   - Session auto-reshuffles when complete
   - Click "New Sheet" to return to camera

## Technical Details

### Tech Stack
- HTML/CSS/JavaScript (no frameworks)
- **Vercel AI SDK** (`@ai-sdk/google`) for Gemini API integration
- **Google Gemini Vision API (gemini-1.5-flash)** for OCR
- Web Speech API for text-to-speech with optimized voice selection
- MediaDevices API for camera access

### Project Structure

```
spelling-words/
├── api/
│   └── extract-words.js      # Serverless function (Gemini API proxy)
├── public/                   # Static files
│   ├── index.html
│   ├── css/styles.css
│   └── js/
│       ├── app.js            # Main application orchestrator
│       ├── camera.js         # Camera capture and file upload
│       ├── ocr.js            # Calls backend API
│       ├── practice.js       # Practice session management
│       └── speech.js         # Text-to-speech implementation
├── .env.example              # Environment variable template
├── package.json
├── vercel.json               # Vercel routing config
└── README.md
```

### Browser Compatibility
- Chrome/Edge: Full support
- Safari: Requires HTTPS or localhost for camera
- Firefox: Full support
- Mobile browsers: Generally well supported

### Word Extraction
The Gemini Vision API analyzes the image and extracts:
- Numbered words (1-20+): "1. word", "1) word", "1: word"
- Challenge words: "Challenge Word: word"
- Content/Bonus words: "Content Word: word", "Bonus: word"

### Speech Quality Improvements
- Automatic selection of high-quality voices (Google, Microsoft, Premium, Enhanced, Neural)
- Optimized speech rate (0.9) and pitch (1.1) for clarity
- Console logging of available voices for debugging
- Fallback to text display if speech unavailable

### Performance
- OCR processing: 1-3 seconds typically
- More accurate word extraction compared to traditional OCR
- Works well with various handwriting styles and lighting conditions

## Deployment

### Deploy to Vercel

1. Push your code to GitHub

2. Connect the repository to [Vercel](https://vercel.com)

3. Add environment variables in Vercel dashboard:
   - `GOOGLE_GENERATIVE_AI_API_KEY`: Your Gemini API key
   - `ALLOWED_ORIGINS`: Your production URL (e.g., `https://spelling-words.vercel.app`)

4. Deploy

Vercel automatically:
- Serves static files from `/public/`
- Runs serverless functions from `/api/`
- Provides HTTPS (required for camera access)

## Troubleshooting

### API Errors

**"Server configuration error"**
- The `GOOGLE_GENERATIVE_AI_API_KEY` environment variable is not set
- For local dev: Check your `.env` file
- For Vercel: Check environment variables in dashboard

**"API quota exceeded"**
- You may have reached your free tier limit
- Check your usage at [Google AI Studio](https://makersuite.google.com)
- Wait for your quota to reset or upgrade your plan

**"Too many requests"**
- Rate limit is 10 requests per minute per IP
- Wait a minute and try again

**"Forbidden: Unauthorized origin"**
- The `ALLOWED_ORIGINS` environment variable doesn't include your domain
- For local dev: Defaults allow localhost:3000
- For production: Add your Vercel URL to `ALLOWED_ORIGINS`

### Camera Not Working
- Ensure you're accessing via HTTPS or localhost
- Check browser camera permissions
- Use "Upload Image" as fallback

### No Words Detected
- Ensure good lighting when capturing image
- Hold camera steady for clear focus
- Make sure text is clearly visible and not blurry
- The Gemini API works much better than traditional OCR but still requires readable text

### Text-to-Speech Not Working
- Some browsers require user gesture before TTS
- Check browser compatibility
- Open browser console to see which voice is being used
- App will display word as fallback if TTS unavailable

### Best Practices
- Use well-lit images with clear, dark text
- Avoid shadows and glare on the paper
- Ensure the word list fills a good portion of the image frame
- Review extracted words before starting practice

## API Costs

Google Gemini API offers a generous free tier:
- Free tier: 15 requests per minute
- Each image analysis counts as one request
- Typical usage (one spelling sheet) = 1 request
- Cost is minimal for personal use

Check current pricing at [Google AI Pricing](https://ai.google.dev/pricing)

## Future Enhancements (Out of Scope)
- Manual word editing after OCR
- Local storage for word lists
- Multiple word list management
- Typing mode for spelling practice
- Progress tracking across sessions
- Cloud TTS for better voice quality
