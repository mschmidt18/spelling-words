// Main application orchestrator
class App {
    constructor() {
        this.currentView = 'camera';
        this.extractedWords = [];
        this.practiceSession = null;

        this.views = {
            camera: document.getElementById('camera-view'),
            processing: document.getElementById('processing-view'),
            confirmation: document.getElementById('confirmation-view'),
            practice: document.getElementById('practice-view')
        };

        this.init();
    }

    init() {
        // Initialize camera module
        if (typeof CameraModule !== 'undefined') {
            CameraModule.init(
                (imageData) => this.handleImageCaptured(imageData),
                (error) => this.handleCameraError(error)
            );
        }

        // Set up event listeners
        this.setupEventListeners();

        // Show camera view initially
        this.showView('camera');
    }

    setupEventListeners() {
        // Confirmation view buttons
        const beginPracticeBtn = document.getElementById('begin-practice-btn');
        const retakeBtn = document.getElementById('retake-btn');

        if (beginPracticeBtn) {
            beginPracticeBtn.addEventListener('click', () => this.startPractice());
        }

        if (retakeBtn) {
            retakeBtn.addEventListener('click', () => this.retakePicture());
        }

        // Practice view buttons
        const speakWordBtn = document.getElementById('speak-word-btn');
        const repeatWordBtn = document.getElementById('repeat-word-btn');
        const newSheetBtn = document.getElementById('new-sheet-btn');

        if (speakWordBtn) {
            speakWordBtn.addEventListener('click', () => this.speakNextWord());
        }

        if (repeatWordBtn) {
            repeatWordBtn.addEventListener('click', () => this.repeatWord());
        }

        if (newSheetBtn) {
            newSheetBtn.addEventListener('click', () => this.newSheet());
        }
    }

    showView(viewName) {
        // Hide all views
        Object.values(this.views).forEach(view => {
            if (view) view.style.display = 'none';
        });

        // Show requested view
        if (this.views[viewName]) {
            this.views[viewName].style.display = 'block';
            this.currentView = viewName;
        }
    }

    async handleImageCaptured(imageData) {
        try {
            // Show processing view
            this.showView('processing');
            this.updateProcessingStatus('Initializing OCR...', 0);

            // Process image with OCR
            if (typeof OCRModule !== 'undefined') {
                const words = await OCRModule.extractWords(
                    imageData,
                    (status, progress) => this.updateProcessingStatus(status, progress)
                );

                if (words && words.length > 0) {
                    this.extractedWords = words;
                    this.showConfirmation(words);
                } else {
                    this.showError('No words detected. Please retake with better lighting and ensure the text is clear.');
                    this.showView('camera');
                }
            } else {
                throw new Error('OCR module not loaded');
            }
        } catch (error) {
            console.error('Error processing image:', error);
            this.showError('Failed to process image: ' + error.message);
            this.showView('camera');
        }
    }

    handleCameraError(error) {
        const errorElement = document.getElementById('camera-error');
        if (errorElement) {
            errorElement.textContent = error;
            errorElement.style.display = 'block';
        }
    }

    updateProcessingStatus(status, progress) {
        const statusElement = document.getElementById('processing-status');
        const progressFill = document.getElementById('progress-fill');
        const progressText = document.getElementById('progress-text');

        if (statusElement) {
            statusElement.textContent = status;
        }

        if (progressFill && progress !== undefined) {
            progressFill.style.width = progress + '%';
        }

        if (progressText && progress !== undefined) {
            progressText.textContent = Math.round(progress) + '%';
        }
    }

    showConfirmation(words) {
        // Update word count
        const wordCountElement = document.getElementById('word-count');
        if (wordCountElement) {
            wordCountElement.textContent = `${words.length} word${words.length !== 1 ? 's' : ''} found`;
        }

        // Display word list
        const wordListContainer = document.getElementById('word-list-container');
        if (wordListContainer) {
            const wordList = document.createElement('ul');
            wordList.className = 'word-list';

            words.forEach(word => {
                const listItem = document.createElement('li');
                listItem.className = 'word-item';
                listItem.textContent = word;
                wordList.appendChild(listItem);
            });

            wordListContainer.innerHTML = '';
            wordListContainer.appendChild(wordList);
        }

        // Show warning if word count is low
        const warningElement = document.getElementById('confirmation-warning');
        if (warningElement && words.length < 10) {
            warningElement.textContent = 'Low word count detected. Consider retaking if this seems incorrect.';
            warningElement.style.display = 'block';
        } else if (warningElement) {
            warningElement.style.display = 'none';
        }

        // Show confirmation view
        this.showView('confirmation');
    }

    startPractice() {
        if (this.extractedWords.length === 0) {
            this.showError('No words available for practice');
            return;
        }

        // Initialize practice session
        if (typeof PracticeSession !== 'undefined') {
            this.practiceSession = new PracticeSession(this.extractedWords);
            this.updateWordCounter();
            this.showView('practice');

            // Disable repeat button initially (no word spoken yet)
            const repeatWordBtn = document.getElementById('repeat-word-btn');
            if (repeatWordBtn) {
                repeatWordBtn.disabled = true;
            }

            // Hide practice message
            const practiceMessage = document.getElementById('practice-message');
            if (practiceMessage) {
                practiceMessage.style.display = 'none';
            }
        } else {
            this.showError('Practice module not loaded');
        }
    }

    speakNextWord() {
        if (!this.practiceSession) {
            return;
        }

        const word = this.practiceSession.getNextWord();

        // Enable repeat button after first word
        const repeatWordBtn = document.getElementById('repeat-word-btn');
        if (repeatWordBtn) {
            repeatWordBtn.disabled = false;
        }

        // Speak the word
        if (typeof SpeechModule !== 'undefined') {
            SpeechModule.speak(word, () => {
                // Success callback
                this.updateWordCounter();
            }, (error) => {
                // Error callback - show word as fallback
                this.showWordAsFallback(word, error);
            });
        } else {
            this.showWordAsFallback(word, 'Speech module not available');
        }

        this.updateWordCounter();
    }

    repeatWord() {
        if (!this.practiceSession || !this.practiceSession.hasCurrentWord()) {
            return;
        }

        const word = this.practiceSession.getCurrentWord();

        // Speak the current word (without incrementing counter)
        if (typeof SpeechModule !== 'undefined') {
            SpeechModule.speak(word, () => {
                // Success callback - no counter update
            }, (error) => {
                // Error callback - show word as fallback
                this.showWordAsFallback(word, error);
            });
        } else {
            this.showWordAsFallback(word, 'Speech module not available');
        }
    }

    updateWordCounter() {
        if (!this.practiceSession) {
            return;
        }

        const counterElement = document.getElementById('word-counter');
        if (counterElement) {
            const total = this.practiceSession.getTotalWords();
            const spoken = this.practiceSession.getWordsSpoken();
            counterElement.textContent = `Word ${spoken} of ${total}`;
        }
    }

    showWordAsFallback(word, error) {
        console.warn('Speech failed, showing word:', error);

        const wordDisplay = document.getElementById('word-display');
        const practiceMessage = document.getElementById('practice-message');

        if (wordDisplay) {
            wordDisplay.textContent = word;
            wordDisplay.style.display = 'flex';

            // Hide after 3 seconds
            setTimeout(() => {
                wordDisplay.style.display = 'none';
            }, 3000);
        }

        if (practiceMessage) {
            practiceMessage.textContent = 'Text-to-speech unavailable. Word shown instead.';
            practiceMessage.style.display = 'block';
        }
    }

    retakePicture() {
        this.extractedWords = [];
        this.practiceSession = null;

        // Restart camera
        if (typeof CameraModule !== 'undefined') {
            CameraModule.restart();
        }

        this.showView('camera');
    }

    newSheet() {
        this.retakePicture();
    }

    showError(message) {
        console.error('App error:', message);
        alert(message);
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
});
