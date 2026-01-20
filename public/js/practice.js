// Practice session management
class PracticeSession {
    constructor(words) {
        if (!words || words.length === 0) {
            throw new Error('Cannot create practice session with empty word list');
        }

        this.allWords = [...words]; // Copy of all words
        this.remainingWords = this.shuffle([...words]); // Shuffled copy for practice
        this.wordsSpoken = 0;
        this.currentWord = null; // Track the current word for repeat functionality
    }

    getNextWord() {
        // If no words remaining, reshuffle all words
        if (this.remainingWords.length === 0) {
            this.remainingWords = this.shuffle([...this.allWords]);
            console.log('All words used - reshuffling deck');
        }

        // Pick a random word from remaining words
        const randomIndex = Math.floor(Math.random() * this.remainingWords.length);
        const word = this.remainingWords.splice(randomIndex, 1)[0];

        this.wordsSpoken++;
        this.currentWord = word; // Store current word for repeat functionality

        return word;
    }

    shuffle(array) {
        // Fisher-Yates shuffle algorithm
        const shuffled = [...array];

        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }

        return shuffled;
    }

    getTotalWords() {
        return this.allWords.length;
    }

    getWordsSpoken() {
        return this.wordsSpoken;
    }

    getRemainingCount() {
        return this.remainingWords.length;
    }

    getCurrentWord() {
        return this.currentWord;
    }

    hasCurrentWord() {
        return this.currentWord !== null;
    }

    reset() {
        this.remainingWords = this.shuffle([...this.allWords]);
        this.wordsSpoken = 0;
        this.currentWord = null;
    }
}
