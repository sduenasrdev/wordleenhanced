// Word API Management for Wordle
import { WORDS } from "./words.js";

// Difficulty settings
const DIFFICULTY_SETTINGS = {
  easy: {
    label: 'Easy',
    description: 'Common everyday words',
    frequency: 'common' // Most frequent words
  },
  medium: {
    label: 'Medium',
    description: 'Moderately common words',
    frequency: 'moderate'
  },
  hard: {
    label: 'Hard',
    description: 'Rare and challenging words',
    frequency: 'rare'
  }
};

// Cache for API words to avoid repeated calls
let wordCache = {
  easy: [],
  medium: [],
  hard: [],
  lastFetch: null
};

/**
 * Fetch 5-letter words from Datamuse API
 * Datamuse API is free and doesn't require API key
 */
async function fetchWordsFromAPI(difficulty = 'medium') {
  try {
    // Check cache first (refresh every hour)
    const cacheAge = wordCache.lastFetch ? Date.now() - wordCache.lastFetch : Infinity;
    if (wordCache[difficulty].length > 0 && cacheAge < 3600000) {
      return wordCache[difficulty];
    }

    // Datamuse API endpoint for 5-letter words
    // sp = spelling pattern, md = metadata (frequency), max = limit results
    const response = await fetch('https://api.datamuse.com/words?sp=?????&md=f&max=1000');

    if (!response.ok) {
      throw new Error('API request failed');
    }

    const data = await response.json();

    if (!data || data.length === 0) {
      throw new Error('No words received from API');
    }

    // Filter and categorize words by frequency
    const wordsWithFreq = data
      .filter(word => {
        const w = word.word.toLowerCase();
        // Only valid 5-letter words, no hyphens, apostrophes, or proper nouns
        return w.length === 5 && /^[a-z]{5}$/.test(w);
      })
      .map(word => {
        // Extract frequency score if available
        let frequency = 0;

        // Check if tags exist and find frequency
        if (word.tags && Array.isArray(word.tags)) {
          const freqTag = word.tags.find(tag => tag.startsWith('f:'));
          if (freqTag) {
            frequency = parseFloat(freqTag.split(':')[1]);
          }
        }

        // If no frequency tag, use score (lower score = more common)
        if (frequency === 0 && word.score) {
          frequency = word.score;
        }

        return {
          word: word.word.toLowerCase(),
          frequency: frequency || Math.random() // Random if no frequency data
        };
      })
      .filter(w => w.word.length === 5) // Double check
      .sort((a, b) => b.frequency - a.frequency); // Sort by frequency (high to low)

    if (wordsWithFreq.length === 0) {
      throw new Error('No valid words received from API');
    }

    // Categorize by difficulty based on frequency
    const total = wordsWithFreq.length;
    wordCache.easy = wordsWithFreq.slice(0, Math.floor(total * 0.3)).map(w => w.word);
    wordCache.medium = wordsWithFreq.slice(Math.floor(total * 0.3), Math.floor(total * 0.7)).map(w => w.word);
    wordCache.hard = wordsWithFreq.slice(Math.floor(total * 0.7)).map(w => w.word);
    wordCache.lastFetch = Date.now();

    return wordCache[difficulty];
  } catch (error) {
    return null;
  }
}

/**
 * Get a random word based on difficulty
 */
export async function getRandomWord(difficulty = 'medium') {
  try {
    // Try to get word from API
    let words = await fetchWordsFromAPI(difficulty);

    // Fallback to local words.js if API fails
    if (!words || words.length === 0) {
      words = getFallbackWords(difficulty);
    }

    // Return random word
    const selectedWord = words[Math.floor(Math.random() * words.length)];
    console.log(`Answer: ${selectedWord}`);
    return selectedWord;
  } catch (error) {
    // Final fallback
    const fallbackWord = WORDS[Math.floor(Math.random() * WORDS.length)];
    console.log(`Answer: ${fallbackWord}`);
    return fallbackWord;
  }
}

/**
 * Check if a word is valid (exists in dictionary)
 * Uses the Free Dictionary API to verify
 */
export async function isValidWord(word) {
  // First check local word list for quick validation
  if (WORDS.includes(word.toLowerCase())) {
    return true;
  }

  // Check cache
  for (let difficulty in wordCache) {
    if (wordCache[difficulty].includes(word.toLowerCase())) {
      return true;
    }
  }

  // Verify with dictionary API as final check
  try {
    const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
    return response.ok;
  } catch (error) {
    console.error('Error validating word:', error);
    return false;
  }
}

/**
 * Get fallback words from words.js based on difficulty
 * Uses simple heuristics (word complexity/rarity)
 */
function getFallbackWords(difficulty) {
  // Common letters for easy words
  const commonLetters = 'etaoinshrdlu';

  const wordsWithScore = WORDS.map(word => {
    // Calculate "commonness" score
    let score = 0;
    for (let char of word) {
      if (commonLetters.includes(char)) {
        score++;
      }
    }
    return { word, score };
  });

  // Sort by score
  wordsWithScore.sort((a, b) => b.score - a.score);

  const total = wordsWithScore.length;

  if (difficulty === 'easy') {
    // Top 30% most common
    return wordsWithScore.slice(0, Math.floor(total * 0.3)).map(w => w.word);
  } else if (difficulty === 'medium') {
    // Middle 40%
    return wordsWithScore.slice(Math.floor(total * 0.3), Math.floor(total * 0.7)).map(w => w.word);
  } else {
    // Bottom 30% least common
    return wordsWithScore.slice(Math.floor(total * 0.7)).map(w => w.word);
  }
}

/**
 * Get current difficulty setting
 */
export function getCurrentDifficulty() {
  return localStorage.getItem('wordleDifficulty') || 'medium';
}

/**
 * Set difficulty setting
 */
export function setDifficulty(difficulty) {
  if (DIFFICULTY_SETTINGS[difficulty]) {
    localStorage.setItem('wordleDifficulty', difficulty);
    return true;
  }
  return false;
}

/**
 * Get difficulty settings for UI
 */
export function getDifficultySettings() {
  return DIFFICULTY_SETTINGS;
}

/**
 * Pre-fetch words for all difficulties (call on page load)
 */
export async function prefetchWords() {
  await fetchWordsFromAPI('easy');
  // Cache is already populated for all difficulties
  return true;
}
