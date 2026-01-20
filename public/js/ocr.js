// OCR module using backend API
const OCRModule = (function() {
    async function extractWords(imageData, progressCallback) {
        try {
            if (progressCallback) {
                progressCallback('Preparing image...', 10);
            }

            if (!imageData) {
                throw new Error('Invalid image data');
            }

            if (progressCallback) {
                progressCallback('Sending to server...', 30);
            }

            if (progressCallback) {
                progressCallback('Analyzing image...', 50);
            }

            // Call the backend API
            const response = await fetch('/api/extract-words', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ imageData })
            });

            if (progressCallback) {
                progressCallback('Extracting words...', 80);
            }

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || `API error: ${response.status}`);
            }

            if (!data.words || !Array.isArray(data.words)) {
                throw new Error('Invalid response from server');
            }

            if (progressCallback) {
                progressCallback('Complete!', 100);
            }

            console.log('Extracted words:', data.words);

            return data.words;
        } catch (error) {
            console.error('OCR error:', error);
            throw error;
        }
    }

    async function cleanup() {
        // No cleanup needed for API-based approach
    }

    return {
        extractWords,
        cleanup
    };
})();
