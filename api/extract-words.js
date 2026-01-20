import { generateText } from 'ai';
import { google } from '@ai-sdk/google';

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
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
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
