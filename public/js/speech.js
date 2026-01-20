// Text-to-speech module using Web Speech API
const SpeechModule = (function() {
    let synth = null;
    let voices = [];

    function init() {
        // Check if speech synthesis is supported
        if (!('speechSynthesis' in window)) {
            console.warn('Speech synthesis not supported in this browser');
            return false;
        }

        synth = window.speechSynthesis;

        // Load voices
        loadVoices();

        // Voices might load asynchronously
        if (synth.onvoiceschanged !== undefined) {
            synth.onvoiceschanged = loadVoices;
        }

        return true;
    }

    function loadVoices() {
        voices = synth.getVoices();

        // Sort voices: prioritize high-quality English voices
        voices.sort((a, b) => {
            // Check if voice is English
            const aIsEnglish = a.lang.startsWith('en');
            const bIsEnglish = b.lang.startsWith('en');

            if (aIsEnglish && !bIsEnglish) return -1;
            if (!aIsEnglish && bIsEnglish) return 1;

            // Both English or both not English - check for quality indicators
            const aQuality = getVoiceQualityScore(a);
            const bQuality = getVoiceQualityScore(b);

            return bQuality - aQuality; // Higher quality first
        });
    }

    function getVoiceQualityScore(voice) {
        let score = 0;
        const nameLower = voice.name.toLowerCase();

        // Premium/enhanced voices (highest priority)
        if (nameLower.includes('premium')) score += 50;
        if (nameLower.includes('enhanced')) score += 50;
        if (nameLower.includes('neural')) score += 50;
        if (nameLower.includes('natural')) score += 40;

        // High-quality providers
        if (nameLower.includes('google')) score += 30;
        if (nameLower.includes('microsoft')) score += 25;

        // Prefer US English
        if (voice.lang === 'en-US') score += 20;
        else if (voice.lang.startsWith('en-')) score += 10;

        // Specific high-quality voice names
        if (nameLower.includes('samantha')) score += 35;
        if (nameLower.includes('zira')) score += 30;
        if (nameLower.includes('david')) score += 30;

        // Female voices often clearer for spelling
        if (nameLower.includes('female')) score += 10;

        return score;
    }

    function speak(word, onSuccess, onError) {
        if (!synth) {
            init();
        }

        if (!synth) {
            if (onError) {
                onError('Speech synthesis not supported');
            }
            return;
        }

        // Cancel any ongoing speech
        synth.cancel();

        const utterance = new SpeechSynthesisUtterance(word);

        // Configure utterance for optimal clarity
        utterance.lang = 'en-US';
        utterance.rate = 0.9;   // Slightly faster for more natural speech
        utterance.pitch = 1.1;  // Slightly higher pitch for clarity
        utterance.volume = 1.0;

        // Select the best available voice (voices are already sorted by quality)
        const bestVoice = selectBestVoice();
        if (bestVoice) {
            utterance.voice = bestVoice;
            console.log('Using voice:', bestVoice.name);
        }

        // Event handlers
        utterance.onend = function() {
            if (onSuccess) {
                onSuccess();
            }
        };

        utterance.onerror = function(event) {
            console.error('Speech synthesis error:', event);
            if (onError) {
                onError(event.error);
            }
        };

        // Speak the word
        try {
            synth.speak(utterance);
        } catch (error) {
            console.error('Error speaking word:', error);
            if (onError) {
                onError(error.message);
            }
        }
    }

    function selectBestVoice() {
        // Voices are already sorted by quality in loadVoices()
        // Return the first English voice (highest quality)
        const englishVoice = voices.find(voice => voice.lang.startsWith('en'));
        return englishVoice || voices[0] || null;
    }

    function cancel() {
        if (synth) {
            synth.cancel();
        }
    }

    function isSupported() {
        return 'speechSynthesis' in window;
    }

    // Initialize on load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    return {
        speak,
        cancel,
        isSupported
    };
})();
