import { WORDS } from "./words.js";


const NUMBER_OF_GUESSES = 6;
let guessesRemaining = NUMBER_OF_GUESSES;
let currentGuess = [];
let nextLetter = 0;
let rightGuessString = WORDS[Math.floor(Math.random() * WORDS.length)];

console.log(rightGuessString);

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

  if (!WORDS.includes(guessString)) {
    toastr.error("Word not in list!");
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
      shadeKeyBoard(guessString.charAt(i) + "", letterColor[i]);
    }, delay);
  }

  if (guessString === rightGuessString) {
    
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 }
    });

    Swal.fire({
      title: 'You got it right!',
      text: 'Refresh the page to try again',
      html: `<img src="https://media.giphy.com/media/S43RIQ4OtWGKMTyU8q/giphy.gif" style="width: 90%; height: auto;" alt="Error GIF">`,
      confirmButtonText: 'OK',
    }).then((result) => {
      if (result.isConfirmed){
        location.reload();
      }
    });
    guessesRemaining = 0;
    return;
  }
  else {
    guessesRemaining -= 1;
    currentGuess = [];
    nextLetter = 0;
  
    if (guessesRemaining === 0) {
      Swal.fire({
        icon: 'error',
        title: `You've run out of guesses. The right word was: "${rightGuessString}"`,
        html: `<img src="https://media.giphy.com/media/3oz8xLd9DJq2l2VFtu/giphy.gif" style=100%; height: auto;" alt="Error GIF">`,
        confirmButtonText: 'OK',
      }).then((result) => {
        if (result.isConfirmed) {
          location.reload();
        }
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

document.getElementById("give-up-button").addEventListener("click", () => {
  Swal.fire({
    title: 'Are you sure you want to give up?',
    html: `<img src="https://media.giphy.com/media/w9t0aFMjahdxpKKvzN/giphy.gif" style="width: 80%; height: auto;" alt="Really GIF">`,
    showCancelButton: true,
    confirmButtonColor: '#3085d6',
    cancelButtonColor: '#d33',
    confirmButtonText: 'Yes, give up!',
    cancelButtonText: 'No, keep playing'
  }).then((result) => {
    if (result.isConfirmed) {
      Swal.fire({
        title: `You gave up! The right word was: "${rightGuessString}".`,
        html: `<img src="https://media.giphy.com/media/xTiTnHXbRoaZ1B1Mo8/giphy.gif" style="width: 80%; height: auto;" alt="Really GIF">`,
        confirmButtonText: 'OK'
      }).then(() => {
        location.reload();
      });
      guessesRemaining = 0;
      initBoard();
    }
  });
});


initBoard();
