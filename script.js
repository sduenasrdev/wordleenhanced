import { WORDS } from "./words.js";
import {
  registerUser,
  loginUser,
  logoutUser,
  getCurrentUser,
  isLoggedIn,
  saveGameStats,
  getUserAggregates,
  getGameHistory,
  migrateLocalStatsToSupabase,
  getGuessDistribution,
  getLeaderboard
} from "./supabase-client.js";
import {
  getRandomWord,
  isValidWord,
  getCurrentDifficulty,
  setDifficulty,
  prefetchWords
} from "./word-api.js";

const NUMBER_OF_GUESSES = 6;
let guessesRemaining = NUMBER_OF_GUESSES;
let currentGuess = [];
let nextLetter = 0;
let rightGuessString = '';
let currentGuessCount = 0;
let validWordList = WORDS; // Fallback word list
let hintUsed = false; // Track if hint has been used this game

console.log('Game initializing...');

function initBoard() {
  let board = document.getElementById("game-board");

  // Remove existing rows
  while (board.firstChild) {
    board.removeChild(board.firstChild);
  }

  // Add new rows
  for (let i = 0; i < NUMBER_OF_GUESSES; i++) {
    let row = document.createElement("div");
    row.className = "letter-row";

    for (let j = 0; j < 5; j++) {
      let box = document.createElement("div");
      box.className = "letter-box";
      row.appendChild(box);
    }

    board.appendChild(row);
  }
}

async function updateStats(win) {
  // Keep localStorage as backup
  const stats = JSON.parse(localStorage.getItem("wordleStats")) || {
    games: 0, wins: 0, losses: 0, streak: 0, maxStreak: 0
  };

  stats.games += 1;
  if (win) {
    stats.wins += 1;
    stats.streak += 1;
    if (stats.streak > stats.maxStreak) {
      stats.maxStreak = stats.streak;
    }
  } else {
    stats.losses += 1;
    stats.streak = 0;
  }

  localStorage.setItem("wordleStats", JSON.stringify(stats));

  // Save to Supabase if logged in
  if (isLoggedIn()) {
    try {
      await saveGameStats(rightGuessString, win, currentGuessCount);
    } catch (error) {
      console.error("Failed to save stats to Supabase:", error);
      toastr.warning("Stats saved locally only");
    }
  }
}


function shadeKeyBoard(letter, color) {
  for (const elem of document.getElementsByClassName("keyboard-button")) {
    if (elem.textContent === letter) {
      let oldColor = elem.style.backgroundColor;
      if (oldColor === "green") {
        return;
      }

      if (oldColor === "yellow" && color !== "green") {
        return;
      }

      elem.style.backgroundColor = color;
      // Force white text for colored keys
      if (color === "green" || color === "yellow" || color === "gray") {
        elem.style.color = "white";
      }
      break;
    }
  }
}

function deleteLetter() {
  let row = document.getElementsByClassName("letter-row")[6 - guessesRemaining];
  let box = row.children[nextLetter - 1];
  box.textContent = "";
  box.classList.remove("filled-box");
  currentGuess.pop();
  nextLetter -= 1;
}

function checkGuess() {
  let row = document.getElementsByClassName("letter-row")[6 - guessesRemaining];
  let guessString = "";
  let rightGuess = Array.from(rightGuessString);

  for (const val of currentGuess) {
    guessString += val;
  }

  if (guessString.length != 5) {
    toastr.error("Not enough letters!");
    return;
  }

  // Validate word using both local list and API
  const isValid = validWordList.includes(guessString) || WORDS.includes(guessString);
  if (!isValid) {
    toastr.error("Word is invalid!");
    return;
  }

  var letterColor = ["gray", "gray", "gray", "gray", "gray"];

  //check green
  for (let i = 0; i < 5; i++) {
    if (rightGuess[i] == currentGuess[i]) {
      letterColor[i] = "green";
      rightGuess[i] = "#";
    }
  }

  //check yellow
  //checking guess letters
  for (let i = 0; i < 5; i++) {
    if (letterColor[i] == "green") continue;

    //checking right letters
    for (let j = 0; j < 5; j++) {
      if (rightGuess[j] == currentGuess[i]) {
        letterColor[i] = "yellow";
        rightGuess[j] = "#";
      }
    }
  }

  for (let i = 0; i < 5; i++) {
    let box = row.children[i];
    let delay = 250 * i;
    setTimeout(() => {
      //flip box
      animateCSS(box, "flipInX");
      //shade box
      box.style.backgroundColor = letterColor[i];
      // Use CSS variable colors for consistency
      if (letterColor[i] === "yellow") {
        box.style.backgroundColor = getComputedStyle(document.documentElement).getPropertyValue('--keyboard-present').trim();
      } else if (letterColor[i] === "green") {
        box.style.backgroundColor = getComputedStyle(document.documentElement).getPropertyValue('--keyboard-correct').trim();
      } else if (letterColor[i] === "gray") {
        box.style.backgroundColor = getComputedStyle(document.documentElement).getPropertyValue('--keyboard-absent').trim();
      }
      box.style.color = "white"; // Ensure white text on colored backgrounds
      shadeKeyBoard(guessString.charAt(i) + "", letterColor[i]);
    }, delay);
  }

  if (guessString === rightGuessString) {
    currentGuessCount = 6 - guessesRemaining + 1;
    updateStats(true);
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });
    showResultDialog({
      icon: 'success',
      title: 'You got it right!',
      gifUrl: 'https://media.giphy.com/media/S43RIQ4OtWGKMTyU8q/giphy.gif'
    });
    guessesRemaining = 0;

    return;
  }
  else {
    guessesRemaining -= 1;
    currentGuess = [];
    nextLetter = 0;

    if (guessesRemaining === 0) {
      currentGuessCount = 6;
      updateStats(false);
      showResultDialog({
        icon: 'error',
        title: "You've run out of guesses.",
        gifUrl: 'https://media.giphy.com/media/3oz8xLd9DJq2l2VFtu/giphy.gif'
      });
    }
  } 
}

function insertLetter(pressedKey) {
  if (nextLetter === 5) {
    return;
  }
  pressedKey = pressedKey.toLowerCase();

  let row = document.getElementsByClassName("letter-row")[6 - guessesRemaining];
  let box = row.children[nextLetter];
  animateCSS(box, "pulse");
  box.textContent = pressedKey;
  box.classList.add("filled-box");
  currentGuess.push(pressedKey);
  nextLetter += 1;
}

const animateCSS = (element, animation, prefix = "animate__") =>
  // We create a Promise and return it
  new Promise((resolve, reject) => {
    const animationName = `${prefix}${animation}`;
    // const node = document.querySelector(element);
    const node = element;
    node.style.setProperty("--animate-duration", "0.3s");

    node.classList.add(`${prefix}animated`, animationName);

    // When the animation ends, we clean the classes and resolve the Promise
    function handleAnimationEnd(event) {
      event.stopPropagation();
      node.classList.remove(`${prefix}animated`, animationName);
      resolve("Animation ended");
    }

    node.addEventListener("animationend", handleAnimationEnd, { once: true });
  });

document.addEventListener("keyup", (e) => {
  // Don't capture keyboard if user is typing in an input field
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
    return;
  }

  if (guessesRemaining === 0) {
    return;
  }

  let pressedKey = String(e.key);
  if (pressedKey === "Backspace" && nextLetter !== 0) {
    deleteLetter();
    return;
  }

  if (pressedKey === "Enter") {
    checkGuess();
    return;
  }

  let found = pressedKey.match(/[a-z]/gi);
  if (!found || found.length > 1) {
    return;
  } else {
    insertLetter(pressedKey);
  }
});

document.getElementById("keyboard-cont").addEventListener("click", (e) => {
  const target = e.target;

  if (!target.classList.contains("keyboard-button")) {
    return;
  }
  let key = target.textContent;

  if (key === "Del") {
    key = "Backspace";
  }

  document.dispatchEvent(new KeyboardEvent("keyup", { key: key }));
});

document.getElementById("instructions-button").addEventListener("click", () => {
  Swal.fire({
    title: 'How To Play',
    html: '<p style="text-align: left;">Guess the Wordle in 6 tries.<br>1. Each guess must be a valid 5-letter word.<br>2. The color of the tiles will change to show how close your guess was to the word.<br>3. Green means the letter is in the corresponding slot<br>4. Yellow is the letter is in the word but not in the right slot<br><br>Enjoy!<br></p>',
    confirmButtonText: 'OK',
  });
});

document.getElementById("stats-button").addEventListener("click", async () => {
  if (!isLoggedIn()) {
    // Show local stats for guest users
    showLocalStatsModal();
    return;
  }

  // Show loading
  Swal.fire({
    title: 'Loading...',
    allowOutsideClick: false,
    didOpen: () => {
      Swal.showLoading();
    }
  });

  try {
    // Load both stats and leaderboard
    const [stats, distribution, history, leaderboard] = await Promise.all([
      getUserAggregates(),
      getGuessDistribution(),
      getGameHistory(5),
      getLeaderboard(10)
    ]);

    showStatsModal(stats, distribution, history, leaderboard);
  } catch (error) {
    console.error('Error loading stats:', error);
    Swal.fire({
      icon: 'error',
      title: 'Error',
      text: 'Failed to load stats. Please try again.'
    });
  }
});

function showStatsModal(stats, distribution, history, leaderboard) {
  const currentUsername = getCurrentUser().username;
  const winPercentage = stats.total_games > 0
    ? ((stats.total_wins / stats.total_games) * 100).toFixed(1)
    : 0;

  const avgGuesses = distribution.reduce((sum, count, idx) => sum + count * (idx + 1), 0) / (stats.total_wins || 1);

  // Create distribution chart
  const maxCount = Math.max(...distribution, 1);
  const distributionHTML = distribution.map((count, idx) => {
    const percentage = (count / maxCount) * 100;
    return `
      <div style="display: flex; align-items: center; margin: 5px 0;">
        <span style="width: 20px;">${idx + 1}</span>
        <div style="flex: 1; background: #ddd; margin: 0 10px; border-radius: 4px; height: 20px;">
          <div style="width: ${percentage}%; background: #6aaa64; height: 100%; border-radius: 4px; display: flex; align-items: center; justify-content: flex-end; padding-right: 5px; color: white; font-size: 12px;">
            ${count > 0 ? count : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');

  const historyHTML = history.length > 0
    ? history.map(game => {
      const date = new Date(game.game_date).toLocaleDateString();
      const result = game.won ? `✓ ${game.guesses_used} guesses` : '✗ Failed';
      const color = game.won ? 'green' : 'red';
      return `<div style="margin: 5px 0;"><strong>${game.word}</strong> - <span style="color: ${color};">${result}</span> (${date})</div>`;
    }).join('')
    : '<p>No game history yet</p>';

  // Create leaderboard HTML
  const leaderboardHTML = leaderboard.length > 0
    ? leaderboard.map((entry, index) => {
      const rank = index + 1;
      const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`;
      const isCurrentUser = entry.username === currentUsername;
      const highlightStyle = isCurrentUser ? 'background-color: #e8f5e9; font-weight: bold;' : '';

      return `
        <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px; border-bottom: 1px solid #eee; ${highlightStyle}">
          <div style="display: flex; align-items: center; gap: 10px; flex: 1;">
            <span style="font-size: 20px; width: 35px;">${medal}</span>
            <span style="flex: 1;">${entry.username}${isCurrentUser ? ' (You)' : ''}</span>
          </div>
          <div style="text-align: right;">
            <div style="font-weight: bold; color: #6aaa64;">${entry.win_rate.toFixed(1)}%</div>
            <div style="font-size: 11px; color: #666;">${entry.total_wins}/${entry.total_games} games</div>
          </div>
        </div>
      `;
    }).join('')
    : '<p style="text-align: center; color: #666; padding: 20px;">No players yet. Play at least 5 games to appear on the leaderboard!</p>';

  Swal.fire({
    title: 'Statistics',
    html: `
      <div class="stats-tabs">
        <button class="stats-tab active" onclick="switchStatsTab('my-stats')">My Stats</button>
        <button class="stats-tab" onclick="switchStatsTab('leaderboard')">Leaderboard</button>
      </div>

      <div id="my-stats-content" class="stats-content" style="text-align: left;">
        <h3>${currentUsername}'s Performance</h3>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin: 15px 0;">
          <div style="background: #f5f5f5; padding: 10px; border-radius: 8px; text-align: center;">
            <div style="font-size: 24px; font-weight: bold; color: #6aaa64;">${stats.total_games}</div>
            <div style="font-size: 12px; color: #666;">Games Played</div>
          </div>
          <div style="background: #f5f5f5; padding: 10px; border-radius: 8px; text-align: center;">
            <div style="font-size: 24px; font-weight: bold; color: #6aaa64;">${winPercentage}%</div>
            <div style="font-size: 12px; color: #666;">Win Rate</div>
          </div>
          <div style="background: #f5f5f5; padding: 10px; border-radius: 8px; text-align: center;">
            <div style="font-size: 24px; font-weight: bold; color: #6aaa64;">${stats.current_streak}</div>
            <div style="font-size: 12px; color: #666;">Current Streak</div>
          </div>
          <div style="background: #f5f5f5; padding: 10px; border-radius: 8px; text-align: center;">
            <div style="font-size: 24px; font-weight: bold; color: #6aaa64;">${stats.max_streak}</div>
            <div style="font-size: 12px; color: #666;">Max Streak</div>
          </div>
        </div>

        <h3>Guess Distribution</h3>
        ${distributionHTML}

        <h3 style="margin-top: 20px;">Recent Games</h3>
        ${historyHTML}
      </div>

      <div id="leaderboard-content" class="stats-content" style="display: none;">
        <h3 style="text-align: center; margin-bottom: 15px;">Top 10 Players</h3>
        <div style="max-height: 400px; overflow-y: auto;">
          ${leaderboardHTML}
        </div>
        <p style="font-size: 11px; color: #666; text-align: center; margin-top: 15px; font-style: italic;">
          Minimum 5 games required to appear on leaderboard
        </p>
      </div>
    `,
    width: '600px',
    showCloseButton: true,
    showConfirmButton: false
  });
}

function showLocalStatsModal() {
  // Get local stats from localStorage
  const stats = JSON.parse(localStorage.getItem("wordleStats")) || {
    games: 0, wins: 0, losses: 0, streak: 0, maxStreak: 0
  };

  const winPercentage = stats.games > 0
    ? ((stats.wins / stats.games) * 100).toFixed(1)
    : 0;

  Swal.fire({
    title: 'Local Statistics',
    html: `
      <div style="text-align: left;">
        <div style="background-color: #f0f8f0; padding: 15px; border-radius: 8px; margin-bottom: 15px;">
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 15px; text-align: center;">
            <div>
              <div style="font-size: 28px; font-weight: bold; color: #6aaa64;">${stats.games}</div>
              <div style="font-size: 12px; color: #666;">Games Played</div>
            </div>
            <div>
              <div style="font-size: 28px; font-weight: bold; color: #6aaa64;">${winPercentage}%</div>
              <div style="font-size: 12px; color: #666;">Win Rate</div>
            </div>
            <div>
              <div style="font-size: 28px; font-weight: bold; color: #6aaa64;">${stats.streak}</div>
              <div style="font-size: 12px; color: #666;">Current Streak</div>
            </div>
            <div>
              <div style="font-size: 28px; font-weight: bold; color: #6aaa64;">${stats.maxStreak}</div>
              <div style="font-size: 12px; color: #666;">Max Streak</div>
            </div>
          </div>
        </div>

        <div style="background-color: #fff3cd; padding: 15px; border-radius: 8px; margin-bottom: 15px; border-left: 4px solid #ffc107;">
          <div style="font-size: 14px; color: #856404;">
            <strong>Playing as Guest</strong><br>
            Stats are saved locally on this device only. Login to sync your stats across devices and access the leaderboard!
          </div>
        </div>

        <div style="text-align: center; margin-top: 20px;">
          <button onclick="document.getElementById('signup-btn').click(); Swal.close();"
                  style="background-color: #6aaa64; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: bold; margin: 0 5px;">
            Sign Up
          </button>
          <button onclick="document.getElementById('login-btn').click(); Swal.close();"
                  style="background-color: #787c7e; color: white; border: none; padding: 10px 20px; border-radius: 6px; cursor: pointer; font-weight: bold; margin: 0 5px;">
            Login
          </button>
        </div>
      </div>
    `,
    width: '500px',
    showCloseButton: true,
    showConfirmButton: false
  });
}

// Tab switching function (global for onclick)
window.switchStatsTab = function(tabName) {
  // Update tab buttons
  document.querySelectorAll('.stats-tab').forEach(tab => {
    tab.classList.remove('active');
  });
  event.target.classList.add('active');

  // Update content
  if (tabName === 'my-stats') {
    document.getElementById('my-stats-content').style.display = 'block';
    document.getElementById('leaderboard-content').style.display = 'none';
  } else {
    document.getElementById('my-stats-content').style.display = 'none';
    document.getElementById('leaderboard-content').style.display = 'block';
  }
};


document.getElementById("hint-button").addEventListener("click", () => {
  if (hintUsed) {
    toastr.warning("You've already used your hint!");
    return;
  }

  if (guessesRemaining === 0) {
    toastr.error("Game is over!");
    return;
  }

  // Get a random letter from the answer that hasn't been guessed yet
  const guessedLetters = new Set();

  // Collect all letters that have been guessed correctly (green tiles)
  const rows = document.getElementsByClassName("letter-row");
  for (let i = 0; i < (NUMBER_OF_GUESSES - guessesRemaining); i++) {
    const row = rows[i];
    for (let j = 0; j < 5; j++) {
      const box = row.children[j];
      const bgColor = box.style.backgroundColor;
      // Check if this letter was green (correct position)
      if (bgColor.includes('106, 170, 100') || bgColor === 'green' ||
          bgColor === getComputedStyle(document.documentElement).getPropertyValue('--keyboard-correct').trim()) {
        guessedLetters.add(j); // Track the position
      }
    }
  }

  // Find positions that haven't been revealed
  const unrevealedPositions = [];
  for (let i = 0; i < 5; i++) {
    if (!guessedLetters.has(i)) {
      unrevealedPositions.push(i);
    }
  }

  if (unrevealedPositions.length === 0) {
    toastr.info("All letters have been revealed!");
    return;
  }

  // Pick a random unrevealed position
  const randomPos = unrevealedPositions[Math.floor(Math.random() * unrevealedPositions.length)];
  const hintLetter = rightGuessString[randomPos].toUpperCase();

  // Show the hint
  Swal.fire({
    icon: 'info',
    title: 'Hint',
    html: `Position ${randomPos + 1} contains the letter: <strong>${hintLetter}</strong>`,
    confirmButtonText: 'Got it!'
  });

  // Mark hint as used
  hintUsed = true;
  const hintButton = document.getElementById('hint-button');
  hintButton.disabled = true;
  hintButton.style.opacity = '0.5';
  hintButton.textContent = '💡 Hint Used';

  toastr.info(`Hint: Position ${randomPos + 1} = ${hintLetter}`);
});

document.getElementById("give-up-button").addEventListener("click", () => {
  currentGuessCount = 6;
  updateStats(false);
  showResultDialog({
    icon: 'info',
    title: `You gave up!`,
    gifUrl: 'https://media.giphy.com/media/xTiTnHXbRoaZ1B1Mo8/giphy.gif'
  });
  guessesRemaining = 0;
});

function showResultDialog({ icon, title, gifUrl }) {
  fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${rightGuessString}`)
    .then(res => res.json())
    .then(data => {
      const definition = data[0]?.meanings[0]?.definitions[0]?.definition || "No definition found.";

      Swal.fire({
        icon: icon,
        title: title,
        html: `
          <p>The word was: <strong>${rightGuessString}</strong></p>
          <p><em>Definition:</em> ${definition}</p>
          <img src="${gifUrl}" style="width: 100%; height: auto;" alt="GIF">
        `,
        confirmButtonText: 'Play Again',
      }).then(() => initializeGame());
    })
    .catch(err => {
      Swal.fire({
        icon: icon,
        title: title,
        html: `
          <p>The word was: <strong>${rightGuessString}</strong></p>
          <p><em>Definition:</em> (Could not fetch definition)</p>
          <img src="${gifUrl}" style="width: 100%; height: auto;" alt="GIF">
        `,
        confirmButtonText: 'Play Again',
      }).then(() => initializeGame());
    });
}

// Auth Modal Logic
let isRegistering = true;

function showAuthModal() {
  const modal = document.getElementById('auth-modal');
  const title = document.getElementById('auth-title');
  const description = document.getElementById('auth-description');
  const submitBtn = document.getElementById('auth-submit-btn');
  const toggleText = document.getElementById('auth-toggle-text');
  const toggleLink = document.getElementById('auth-toggle-link');

  if (isRegistering) {
    title.textContent = 'Welcome to Wordle!';
    description.textContent = 'Create a username to track your stats';
    submitBtn.textContent = 'Sign Up';
    toggleText.innerHTML = 'Already have an account? <a id="auth-toggle-link">Login</a>';
  } else {
    title.textContent = 'Welcome Back!';
    description.textContent = 'Enter your username to continue';
    submitBtn.textContent = 'Login';
    toggleText.innerHTML = "Don't have an account? <a id=\"auth-toggle-link\">Sign Up</a>";
  }

  // Reattach event listener after innerHTML change
  document.getElementById('auth-toggle-link').addEventListener('click', toggleAuthMode);

  modal.style.display = 'block';
  // Don't add 'auth-required' class anymore - game should remain playable
  document.getElementById('username-input').focus();
}

function hideAuthModal() {
  document.getElementById('auth-modal').style.display = 'none';
  document.getElementById('auth-error').style.display = 'none';
  document.getElementById('username-input').value = '';
}

function showAuthError(message) {
  const errorDiv = document.getElementById('auth-error');
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
}

function toggleAuthMode() {
  isRegistering = !isRegistering;
  showAuthModal();
  document.getElementById('auth-error').style.display = 'none';
}

async function handleAuthSubmit() {
  const username = document.getElementById('username-input').value.trim();

  if (!username) {
    showAuthError('Please enter a username');
    return;
  }

  if (username.length < 3) {
    showAuthError('Username must be at least 3 characters');
    return;
  }

  const submitBtn = document.getElementById('auth-submit-btn');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Please wait...';

  let result;
  if (isRegistering) {
    result = await registerUser(username);
  } else {
    result = await loginUser(username);
  }

  if (result.success) {
    hideAuthModal();
    updateUserDisplay();

    // Migrate localStorage stats if this is first time logging in
    const migrated = localStorage.getItem('statsMigrated');
    if (!migrated) {
      const migrationResult = await migrateLocalStatsToSupabase();
      if (migrationResult.success) {
        toastr.success('Your local stats have been saved!');
      }
    }

    toastr.success(`Welcome ${username}!`);
  } else {
    showAuthError(result.error);
    submitBtn.disabled = false;
    submitBtn.textContent = isRegistering ? 'Sign Up' : 'Login';
  }
}

function updateUserDisplay() {
  const user = getCurrentUser();
  const loggedInDiv = document.getElementById('user-logged-in');
  const loggedOutDiv = document.getElementById('user-logged-out');

  if (user) {
    document.getElementById('username-display').textContent = user.username;
    loggedInDiv.style.display = 'flex';
    loggedOutDiv.style.display = 'none';
  } else {
    loggedInDiv.style.display = 'none';
    loggedOutDiv.style.display = 'flex';
  }
}

// Event Listeners for Auth
document.getElementById('auth-submit-btn').addEventListener('click', handleAuthSubmit);
document.getElementById('auth-toggle-link').addEventListener('click', toggleAuthMode);
document.getElementById('username-input').addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    handleAuthSubmit();
  }
});

// Event listeners for header login/signup buttons
document.getElementById('login-btn').addEventListener('click', () => {
  isRegistering = false;
  showAuthModal();
});

document.getElementById('signup-btn').addEventListener('click', () => {
  isRegistering = true;
  showAuthModal();
});

// Event listener for "Play as Guest" button
document.getElementById('auth-skip-btn').addEventListener('click', () => {
  hideAuthModal();
  toastr.info('Playing as guest - stats will only be saved locally');
});

document.getElementById('logout-btn').addEventListener('click', () => {
  Swal.fire({
    title: 'Logout?',
    text: 'Are you sure you want to logout?',
    icon: 'question',
    showCancelButton: true,
    confirmButtonText: 'Yes, logout',
    cancelButtonText: 'Cancel'
  }).then((result) => {
    if (result.isConfirmed) {
      logoutUser();
      updateUserDisplay();
      toastr.info('Logged out successfully');
      location.reload();
    }
  });
});

// Initialize game with new word
async function initializeGame() {
  const difficulty = getCurrentDifficulty();

  try {
    rightGuessString = await getRandomWord(difficulty);
  } catch (error) {
    rightGuessString = WORDS[Math.floor(Math.random() * WORDS.length)];
  }

  // Reset game state
  guessesRemaining = NUMBER_OF_GUESSES;
  currentGuess = [];
  nextLetter = 0;
  currentGuessCount = 0;
  hintUsed = false; // Reset hint for new game

  // Reset keyboard colors
  document.querySelectorAll('.keyboard-button').forEach(btn => {
    btn.style.backgroundColor = '';
    btn.style.color = '';
  });

  // Reset hint button
  const hintButton = document.getElementById('hint-button');
  if (hintButton) {
    hintButton.disabled = false;
    hintButton.style.opacity = '1';
    hintButton.textContent = '💡 Hint';
  }

  // Reinitialize board
  initBoard();
}

// Theme Management
function loadTheme() {
  const savedTheme = localStorage.getItem('wordleTheme') || 'dark';
  const themeToggle = document.getElementById('theme-toggle');

  if (savedTheme === 'dark') {
    document.body.classList.add('dark-mode');
    if (themeToggle) themeToggle.checked = true;
  } else {
    document.body.classList.remove('dark-mode');
    if (themeToggle) themeToggle.checked = false;
  }
}

// Difficulty Management
function loadDifficulty() {
  const savedDifficulty = getCurrentDifficulty();
  const difficultyRadio = document.getElementById(`diff-${savedDifficulty}`);
  if (difficultyRadio) {
    difficultyRadio.checked = true;
  }
}

function saveDifficultySelection() {
  const selectedDifficulty = document.querySelector('input[name="difficulty"]:checked')?.value;
  if (selectedDifficulty) {
    setDifficulty(selectedDifficulty);
    toastr.success(`Difficulty set to ${selectedDifficulty}. Start a new game!`);
  }
}

function toggleTheme() {
  const isDark = document.body.classList.toggle('dark-mode');
  localStorage.setItem('wordleTheme', isDark ? 'dark' : 'light');

  // Update toggle state
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) themeToggle.checked = isDark;
}

// Settings Modal
document.getElementById('settings-button').addEventListener('click', () => {
  loadDifficulty(); // Load current difficulty setting
  document.getElementById('settings-modal').style.display = 'block';
});

document.getElementById('close-settings-btn').addEventListener('click', () => {
  saveDifficultySelection(); // Save on close
  document.getElementById('settings-modal').style.display = 'none';
});

document.getElementById('theme-toggle').addEventListener('change', toggleTheme);

// Difficulty radio button listeners
document.querySelectorAll('input[name="difficulty"]').forEach(radio => {
  radio.addEventListener('change', () => {
    saveDifficultySelection();
  });
});

// Close settings modal when clicking outside
document.getElementById('settings-modal').addEventListener('click', (e) => {
  if (e.target.id === 'settings-modal') {
    saveDifficultySelection();
    document.getElementById('settings-modal').style.display = 'none';
  }
});

// Christmas Banner Check
function checkBirthdayBanner() {
  // Get current date in EST timezone
  const estDate = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
  const date = new Date(estDate);

  const month = date.getMonth() + 1; // getMonth() is 0-indexed
  const day = date.getDate();

  // Check if it's December 27th
  if (month === 12 && day === 27) {
    // Check if banner was already dismissed today
    const dismissedDate = localStorage.getItem('christmasBannerDismissed');
    const today = `${date.getFullYear()}-12-27`;

    if (dismissedDate !== today) {
      // Show the banner
      document.getElementById('birthday-banner').style.display = 'flex';
    }
  }
}

// Close Christmas banner
document.getElementById('close-birthday').addEventListener('click', () => {
  const estDate = new Date().toLocaleString("en-US", { timeZone: "America/New_York" });
  const date = new Date(estDate);
  const today = `${date.getFullYear()}-12-25`;

  // Mark as dismissed for today
  localStorage.setItem('christmasBannerDismissed', today);

  // Hide banner with animation
  const banner = document.getElementById('birthday-banner');
  banner.style.animation = 'fadeOut 0.3s';
  setTimeout(() => {
    banner.style.display = 'none';
  }, 300);
});

// Initialize
async function init() {
  loadTheme();
  loadDifficulty();

  // Check and show birthday banner if applicable
  checkBirthdayBanner();

  // Pre-fetch words in background
  prefetchWords().catch(err => console.warn('Pre-fetch failed:', err));

  // Initialize game with word
  await initializeGame();

  // Update user display based on login status (but don't block the game)
  updateUserDisplay();
}

// Start the app
init();
