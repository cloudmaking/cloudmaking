//websocket handler
//const socket = new WebSocket(`ws://localhost:8080`);
const socket = new WebSocket(
  `wss://${window.location.hostname}:${window.location.port}`
);

//variables
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const size = 20; // The size of each cell by pixels
const playerColors = ["#3a71e8", "#9de83a"]; // Colors for each player
const rows = 30;
const cols = 30;

let currentPlayerId; // Generate a unique ID for the client
let roomId = getRoomId();

let p1score = document
  .getElementById("player1-score")
  .querySelector(".score-text").textContent;
let p2score = document
  .getElementById("player2-score")
  .querySelector(".score-text").textContent;

let statusBar = document.getElementById("status").textContent;

let gamestate = {
  player1: {
    id: null,
    location: { x: 1, y: 1 },
    direction: { x: 1, y: 0 },
    score: 0,
  },
  player2: {
    id: null,
    location: { x: cols - 2, y: rows - 2 },
    direction: { x: -1, y: 0 },
    score: 0,
  },
  apple: {
    x: Math.floor(Math.random() * cols),
    y: Math.floor(Math.random() * rows),
  },
  gameRunning: false,
  statusBarText: "Waiting for player 2...",
  startButtonText: "Start Game",
};

socket.addEventListener("open", () => {
  console.log("Connected to server");
  socket.send(
    JSON.stringify({ type: "new_player", roomId: roomId, gameState: gamestate })
  );
});

socket.addEventListener("message", (event) => {
  const data = JSON.parse(event.data);
  //console.log("Message from server:", data);

  switch (data.type) {
    case "update_game_state":
      const oldGamestate = { ...gamestate };
      gamestate = data.gameState;
      updatePlayersList();
      updateStatusBar();
      UpdateStartButton();
      updateScores();
      renderGameState();
      break;

    case "game_full":
      // create a modal that tells the player the game is full
      alert("Game is full");
      // redirect the player to the home page
      window.location.href = "/";
      break;

    case "player_id":
      currentPlayerId = data.playerId;
      console.log("Player ID:", currentPlayerId);
      break;

    case "player_left":
      gamestate = data.gameState;
      updatePlayersList();
      resetGame();

      break;

    case "scheduled_update":
      gamestate = data.gameState;
      updateScores();
      renderGameState();
      break;

    // Handle other message types as needed
  }
});

socket.addEventListener("close", () => {
  console.log("Disconnected from server");
  // If player1 left, make player2 the new player1
});

// helper funtions
function handleScheduledUpdate() {
  sendMessage({ type: "request_update", roomId: roomId });
}

// Call this function at regular intervals, e.g., every 1000 ms
setInterval(handleScheduledUpdate, 1000);

function sendMessage(message) {
  //console.log("Sending message:", message); // Debug log
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(message));
  } else {
    console.error("Cannot send message, WebSocket is not open");
  }
}

function getRoomId() {
  const url = window.location.href;
  return url.substring(url.lastIndexOf("/") + 1);
}

function updateStatusBar() {
  const status = document.getElementById("status");
  status.textContent = gamestate.statusBarText;
}

function updateScores() {
  const player1Score = document
    .getElementById("player1-score")
    .querySelector(".score-text");
  const player2Score = document
    .getElementById("player2-score")
    .querySelector(".score-text");
  player1Score.textContent = gamestate.player1.score;
  player2Score.textContent = gamestate.player2.score;
}

function generateAppleLocation() {
  return {
    x: Math.floor(Math.random() * cols),
    y: Math.floor(Math.random() * rows),
  };
}

// if the currentplayerid is on teh same location as teh apple increase the score and generate a new apple
function checkAppleCollision() {
  if (currentPlayerId === gamestate.player1.id) {
    if (
      gamestate.player1.location.x === gamestate.apple.x &&
      gamestate.player1.location.y === gamestate.apple.y
    ) {
      gamestate.player1.score++;
      gamestate.apple = generateAppleLocation();
      sendMessage({ type: "cast_game_state", gameState: gamestate });
    }
  } else if (currentPlayerId === gamestate.player2.id) {
    if (
      gamestate.player2.location.x === gamestate.apple.x &&
      gamestate.player2.location.y === gamestate.apple.y
    ) {
      gamestate.player2.score++;
      gamestate.apple = generateAppleLocation();
      sendMessage({ type: "cast_game_state", gameState: gamestate });
    }
  }
}

function updatePlayersList() {
  const playerList = document.getElementById("player-list");
  playerList.innerHTML = "";
  if (gamestate.player1.id) {
    const player1 = document.createElement("li");
    player1.textContent = "Player 1: " + gamestate.player1.id;
    if (gamestate.player1.id === currentPlayerId) {
      player1.style.color = "red";
    }
    playerList.appendChild(player1);
  }
  if (gamestate.player2.id) {
    const player2 = document.createElement("li");
    player2.textContent = "Player 2: " + gamestate.player2.id;
    if (gamestate.player2.id === currentPlayerId) {
      player2.style.color = "red";
    }
    playerList.appendChild(player2);
  }
}

function UpdateStartButton() {
  const startButton = document.getElementById("start-btn");
  startButton.textContent = gamestate.startButtonText;
}

function renderGameState() {
  // Clear the canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw the players
  ctx.fillStyle = playerColors[0];
  ctx.fillRect(
    gamestate.player1.location.x * size,
    gamestate.player1.location.y * size,
    size,
    size
  );

  ctx.fillStyle = playerColors[1];
  ctx.fillRect(
    gamestate.player2.location.x * size,
    gamestate.player2.location.y * size,
    size,
    size
  );

  // Draw the apple
  ctx.fillStyle = "red";
  ctx.fillRect(gamestate.apple.x * size, gamestate.apple.y * size, size, size);
}

// make a function that handles arrow key inputs and swipe inputs
document.addEventListener("keydown", (event) => {
  if (!gamestate.gameRunning) return;

  const key = event.key;
  let direction;
  switch (key) {
    case "ArrowUp":
      direction = { x: 0, y: -1 };
      break;
    case "ArrowDown":
      direction = { x: 0, y: 1 };
      break;
    case "ArrowLeft":
      direction = { x: -1, y: 0 };
      break;
    case "ArrowRight":
      direction = { x: 1, y: 0 };
      break;
    default:
      return;
  }
  moveHelper(direction);
});

canvas.addEventListener("touchstart", handleTouchStart, false);
canvas.addEventListener("touchmove", handleTouchMove, false);
document.addEventListener("touchmove", preventDefault, { passive: false });

// let xDown = null;
// let yDown = null;

function handleTouchStart(event) {
  const firstTouch = event.touches[0];
  xDown = firstTouch.clientX;
  yDown = firstTouch.clientY;
}

function handleTouchMove(event) {
  if (!xDown || !yDown) {
    return;
  }

  if (!gamestate.gameRunning) return;

  const xUp = event.touches[0].clientX;
  const yUp = event.touches[0].clientY;

  const xDiff = xDown - xUp;
  const yDiff = yDown - yUp;

  if (Math.abs(xDiff) > Math.abs(yDiff)) {
    if (xDiff > 0) {
      // Swipe left
      const direction = { x: -1, y: 0 };
      moveHelper(direction);
    } else {
      // Swipe right
      const direction = { x: 1, y: 0 };
      moveHelper(direction);
    }
  } else {
    if (yDiff > 0) {
      // Swipe up
      const direction = { x: 0, y: -1 };
      moveHelper(direction);
    } else {
      // Swipe down
      const direction = { x: 0, y: 1 };
      moveHelper(direction);
    }
  }

  // Reset values
  xDown = null;
  yDown = null;
}

function moveHelper(direction) {
  if (currentPlayerId === gamestate.player1.id) {
    const newLocation = {
      x: gamestate.player1.location.x + direction.x,
      y: gamestate.player1.location.y + direction.y,
    };
    if (isValidMove(newLocation) && !isOccupied(newLocation)) {
      gamestate.player1.direction = direction;
      gamestate.player1.location = newLocation;
    }
  } else if (currentPlayerId === gamestate.player2.id) {
    const newLocation = {
      x: gamestate.player2.location.x + direction.x,
      y: gamestate.player2.location.y + direction.y,
    };
    if (isValidMove(newLocation) && !isOccupied(newLocation)) {
      gamestate.player2.direction = direction;
      gamestate.player2.location = newLocation;
    }
  }
  sendMessage({ type: "cast_game_state", gameState: gamestate });
}

function isValidMove(location) {
  if (
    location.x < 0 ||
    location.x >= cols ||
    location.y < 0 ||
    location.y >= rows
  ) {
    return false;
  }
  return true;
}

function isOccupied(location) {
  if (
    location.x === gamestate.player1.location.x &&
    location.y === gamestate.player1.location.y
  ) {
    return true;
  }
  if (
    location.x === gamestate.player2.location.x &&
    location.y === gamestate.player2.location.y
  ) {
    return true;
  }
  return false;
}

function preventDefault(e) {
  if (e.touches.length > 1) {
    return;
  }
  if (e.target === canvas) {
    e.preventDefault();
  }
}

// START BUTTON
document.getElementById("start-btn").addEventListener("click", () => {
  if (!gamestate.gameRunning) {
    if (gamestate.player1.id && gamestate.player2.id) {
      startGame();
    } else {
      console.log("Waiting for both players to connect...");
    }
  } else {
    pauseGame();
  }
});

function startGame() {
  gamestate.gameRunning = true;
  gamestate.statusBarText =
    "Game is running... use arrow keys or swipe to move";
  // update the button text too
  gamestate.startButtonText = "Pause Game";
  const startButton = document.getElementById("start-btn");
  startButton.textContent = gamestate.startButtonText;
  sendMessage({ type: "cast_game_state", gameState: gamestate });
}

function pauseGame() {
  gamestate.gameRunning = false;
  gamestate.statusBarText = "Game is paused...";
  gamestate.startButtonText = "Resume Game";
  sendMessage({ type: "cast_game_state", gameState: gamestate });
}

// RESET BUTTON
document.getElementById("reset-btn").addEventListener("click", () => {
  resetGame();
});

function resetGame() {
  gamestate.player1.location = { x: 1, y: 1 };
  gamestate.player1.direction = { x: 1, y: 0 };
  gamestate.player1.score = 0;
  gamestate.player2.location = { x: cols - 2, y: rows - 2 };
  gamestate.player2.direction = { x: -1, y: 0 };
  gamestate.player2.score = 0;
  gamestate.apple = generateAppleLocation();
  gamestate.gameRunning = false;
  if (gamestate.player1.id && gamestate.player2.id) {
    gamestate.statusBarText = "Game reset, press Start Game to begin";
  } else {
    gamestate.statusBarText = "Waiting for player 2...";
  }
  gamestate.startButtonText = "Start Game";
  sendMessage({ type: "cast_game_state", gameState: gamestate });
}

// Game loop
function gameLoop() {
  if (gamestate.gameRunning) {
    checkAppleCollision();
  }
  requestAnimationFrame(gameLoop);
}

// Start the game
// initialiseGame('Waiting for more players to join...');
renderGameState();
requestAnimationFrame(gameLoop);
