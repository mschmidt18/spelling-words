import { generateText } from 'ai';
import { google } from '@ai-sdk/google';

// Simple in-memory rate limiting
// Note: This is per-instance, not distributed across all serverless instances
// Still effective against burst attacks since Vercel keeps functions warm
const rateLimitMap = new Map();
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10; // 10 requests per minute per IP

function getRateLimitKey(req) {
    // Vercel provides the real IP in x-forwarded-for or x-real-ip
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
        || req.headers['x-real-ip']
        || 'unknown';
}

function checkRateLimit(ip) {
    const now = Date.now();
    const windowStart = now - RATE_LIMIT_WINDOW_MS;

    // Clean up old entries on each request (since setInterval doesn't work in serverless)
    for (const [key, entry] of rateLimitMap) {
        entry.timestamps = entry.timestamps.filter(t => t > windowStart);
        if (entry.timestamps.length === 0) {
            rateLimitMap.delete(key);
        }
    }

    // Get or create entry for this IP
    let entry = rateLimitMap.get(ip);
    if (!entry) {
        entry = { timestamps: [] };
        rateLimitMap.set(ip, entry);
    }

    // Check if over limit
    if (entry.timestamps.length >= MAX_REQUESTS_PER_WINDOW) {
        return { allowed: false, remaining: 0, resetIn: Math.ceil((entry.timestamps[0] + RATE_LIMIT_WINDOW_MS - now) / 1000) };
    }

    // Add this request
    entry.timestamps.push(now);
    return { allowed: true, remaining: MAX_REQUESTS_PER_WINDOW - entry.timestamps.length, resetIn: 60 };
}

// Allowed origins for CORS and origin validation
// In production, set ALLOWED_ORIGINS env var to your domain(s), comma-separated
// e.g., "https://spelling-words.vercel.app,https://myapp.com"
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim())
    : ['http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:3000'];

function isOriginAllowed(origin) {
    if (!origin) return false;
    return ALLOWED_ORIGINS.some(allowed => {
        // Exact match or wildcard subdomain match
        if (allowed === origin) return true;
        // Support wildcard like "*.vercel.app"
        if (allowed.startsWith('*.')) {
            const domain = allowed.slice(2);
            return origin.endsWith(domain) && origin.includes('://');
        }
        return false;
    });
}

function setCorsHeaders(res, origin) {
    // Only set allowed origin if it's in our list
    if (origin && isOriginAllowed(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Expose-Headers', 'X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset');
    res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
}

const EXTRACTION_PROMPT = `You are analyzing an image of a spelling word practice sheet.

Extract ALL spelling words from this image. The sheet may contain:
- Numbered words (e.g., "1. apple", "2. banana")
- Challenge words (labeled as "Challenge Word:")
- Content words (labeled as "Content Word:")
- Bonus words (labeled as "Bonus Word:" or "bonus:")

IMPORTANT:
- Extract ONLY the spelling words themselves, not the numbers or labels
- Return the words as a valid JSON array of strings
- Each word should be lowercase
- Do not include any explanatory text, just the JSON array

Example output format:
["apple", "banana", "challenge", "telephone", "dictionary"]`;

function cleanWord(word) {
    if (typeof word !== 'string') {
        return '';
    }
    word = word.trim();
    word = word.replace(/^[\.\,\:\;\!\?]+/, '');
    word = word.replace(/[\.\,\:\;\!\?]+$/, '');
    word = word.toLowerCase();
    return word;
}

function isValidWord(word) {
    if (!word || word.length < 2) {
        return false;
    }
    if (!/[a-zA-Z]/.test(word)) {
        return false;
    }
    const letterCount = (word.match(/[a-zA-Z]/g) || []).length;
    if (letterCount < word.length / 2) {
        return false;
    }
    return true;
}

export default async function handler(req, res) {
    const origin = req.headers.origin;

    // Handle CORS preflight
    if (req.method === 'OPTIONS') {
        setCorsHeaders(res, origin);
        return res.status(204).end();
    }

    // Set CORS headers for all responses
    setCorsHeaders(res, origin);

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    // Origin validation - reject requests from unauthorized origins
    // In browsers, fetch/XHR always sends Origin header for cross-origin requests
    // Missing origin could be: same-origin request, server-to-server, or curl
    // We require origin to be present and valid for security
    if (!origin) {
        return res.status(403).json({ error: 'Forbidden: Missing origin header' });
    }
    if (!isOriginAllowed(origin)) {
        console.warn(`Blocked request from unauthorized origin: ${origin}`);
        return res.status(403).json({ error: 'Forbidden: Unauthorized origin' });
    }

    // Rate limiting
    const clientIp = getRateLimitKey(req);
    const rateLimit = checkRateLimit(clientIp);

    // Add rate limit headers to response
    res.setHeader('X-RateLimit-Limit', MAX_REQUESTS_PER_WINDOW);
    res.setHeader('X-RateLimit-Remaining', rateLimit.remaining);
    res.setHeader('X-RateLimit-Reset', rateLimit.resetIn);

    if (!rateLimit.allowed) {
        console.warn(`Rate limited IP: ${clientIp}`);
        return res.status(429).json({
            error: 'Too many requests. Please wait a minute before trying again.',
            retryAfter: rateLimit.resetIn
        });
    }

    if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY && !process.env.GEMINI_API_KEY) {
        return res.status(500).json({ error: 'Server configuration error: Missing API key' });
    }

    const { imageData } = req.body;
    if (!imageData) {
        return res.status(400).json({ error: 'Missing imageData in request body' });
    }

    // Extract base64 data (remove data URL prefix if present)
    const base64Data = imageData.includes(',') ? imageData.split(',')[1] : imageData;
    if (!base64Data) {
        return res.status(400).json({ error: 'Invalid image data' });
    }

    try {
        const { text } = await generateText({
            model: google('gemini-2.5-flash'),
            messages: [
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: EXTRACTION_PROMPT },
                        {
                            type: 'image',
                            image: base64Data,
                            mimeType: 'image/png',
                        },
                    ],
                },
            ],
        });

        // Parse the JSON array from the response
        let words;
        try {
            words = JSON.parse(text);
        } catch (e) {
            const jsonMatch = text.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                words = JSON.parse(jsonMatch[0]);
            } else {
                return res.status(500).json({ error: 'Could not parse word list from API response' });
            }
        }

        if (!Array.isArray(words)) {
            return res.status(500).json({ error: 'API did not return a valid word array' });
        }

        // Clean and validate words
        words = words
            .map(word => cleanWord(word))
            .filter(word => isValidWord(word));

        return res.status(200).json({ words });

    } catch (error) {
        console.error('Extract words error:', error);

        if (error.message?.includes('401') || error.message?.includes('API key')) {
            return res.status(500).json({ error: 'Invalid API key' });
        }
        if (error.message?.includes('429') || error.message?.includes('quota')) {
            return res.status(429).json({ error: 'API quota exceeded. Please try again later' });
        }

        return res.status(500).json({ error: 'Failed to process image' });
    }
}
