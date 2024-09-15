// gameSetup.js

(() => {
  const canvas = document.getElementById("gameCanvas");
  const context = canvas.getContext("2d");
  const statusElement = document.getElementById("status");
  const playerListElement = document.getElementById("player-list");
  const startButton = document.getElementById("start-btn");
  const resetButton = document.getElementById("reset-btn");
  const player1ScoreElement = document
    .getElementById("player1-score")
    .querySelector(".score-text");
  const player2ScoreElement = document
    .getElementById("player2-score")
    .querySelector(".score-text");

  const roomId = getRoomIdFromURL();
  let ws;
  let playerId;
  let playerColor;
  let gameStarted = false;
  let gameOver = false;

  let gridSize = 30;
  let cellSize = canvas.width / gridSize;

  // Initialize WebSocket connection
  function initWebSocket() {
    ws = new WebSocket(`${getWebSocketURL()}?roomId=${roomId}`);

    ws.onopen = () => {
      console.log("Connected to server");
    };

    ws.onmessage = (message) => {
      const data = JSON.parse(message.data);
      handleServerMessage(data);
    };

    ws.onclose = () => {
      console.log("Disconnected from server");
      if (!gameOver) {
        alert("Connection lost. Please refresh the page.");
      }
    };
  }

  // Handle messages received from the server
  function handleServerMessage(data) {
    switch (data.type) {
      case "init":
        playerId = data.playerId;
        playerColor = data.color;
        console.log(`Player ID: ${playerId}, Color: ${playerColor}`);
        break;

      case "status":
        updateStatus(data.message);
        break;

      case "playerList":
        updatePlayerList(data.players);
        break;

      case "gameStarted":
        gameStarted = true;
        gameOver = false;
        startButton.disabled = true;
        resetButton.disabled = false;
        updateStatus("Game Started!");
        clearCanvas();
        break;

      case "gameState":
        renderGameState(data);
        break;

      case "gameOver":
        gameStarted = false;
        gameOver = true;
        startButton.disabled = false;
        resetButton.disabled = false;
        updateStatus(`Game Over: ${data.message}`);
        break;

      case "gameReset":
        handleGameReset();
        break;

      case "collision":
        updateStatus(data.message);
        break;

      case "error":
        alert(`Error: ${data.message}`);
        break;

      default:
        console.error("Unknown message type:", data.type);
        break;
    }
  }

  // Send a message to the server
  function sendMessage(type, payload = {}) {
    const message = { type, ...payload };
    ws.send(JSON.stringify(message));
  }

  // Capture user input for direction changes
  function initInputHandlers() {
    // Keyboard controls
    document.addEventListener("keydown", (event) => {
      const direction = getDirectionFromKey(event.key);
      if (direction && gameStarted) {
        event.preventDefault(); // Prevent default scrolling behavior
        sendMessage("changeDirection", { direction });
      }
    });

    // Touch controls for mobile devices
    let touchStartX = null;
    let touchStartY = null;
    let lastDirection = null;
    let lastDirectionChange = 0;
    const directionChangeCooldown = 100; // in ms

    canvas.addEventListener(
      "touchstart",
      (event) => {
        if (!gameStarted) return;
        const touch = event.touches[0];
        touchStartX = touch.clientX;
        touchStartY = touch.clientY;
        lastDirection = null; // Reset last direction on new touch
      },
      { passive: true }
    );

    canvas.addEventListener(
      "touchmove",
      (event) => {
        if (!gameStarted) return;
        if (touchStartX === null || touchStartY === null) return;

        const touch = event.touches[0];
        const deltaX = touch.clientX - touchStartX;
        const deltaY = touch.clientY - touchStartY;

        const swipeThreshold = 10; // Lower threshold for responsiveness

        const now = Date.now();
        if (now - lastDirectionChange < directionChangeCooldown) return;

        let direction = null;

        if (
          Math.abs(deltaX) > Math.abs(deltaY) &&
          Math.abs(deltaX) > swipeThreshold
        ) {
          direction = deltaX > 0 ? "right" : "left";
        } else if (
          Math.abs(deltaY) > Math.abs(deltaX) &&
          Math.abs(deltaY) > swipeThreshold
        ) {
          direction = deltaY > 0 ? "down" : "up";
        }

        if (direction && direction !== lastDirection) {
          // Prevent reversing direction directly
          if (isValidDirectionChange(lastDirection, direction)) {
            sendMessage("changeDirection", { direction });
            lastDirectionChange = now;
            lastDirection = direction;

            // Update touchStart positions to the current touch point for continuous detection
            touchStartX = touch.clientX;
            touchStartY = touch.clientY;
          }
        }
      },
      { passive: false }
    );

    canvas.addEventListener(
      "touchend",
      (event) => {
        if (!gameStarted) return;
        touchStartX = null;
        touchStartY = null;
        lastDirection = null;
      },
      { passive: false }
    );
  }

  // Helper function to validate direction changes
  function isValidDirectionChange(currentDirection, newDirection) {
    const opposites = {
      up: "down",
      down: "up",
      left: "right",
      right: "left",
    };
    if (!currentDirection) return true; // Allow any direction if no previous direction
    return opposites[currentDirection] !== newDirection;
  }

  // Start game button handler
  startButton.addEventListener("click", () => {
    sendMessage("startGame");
  });

  // Reset game button handler
  resetButton.addEventListener("click", () => {
    sendMessage("resetGame");
  });

  // Update the status message
  function updateStatus(message) {
    statusElement.textContent = message;
  }

  // Update the player list UI
  function updatePlayerList(players) {
    playerListElement.innerHTML = "";
    players.forEach((player) => {
      const li = document.createElement("li");
      const shortId = player.playerId.substring(0, 4); // Get first 4 characters
      li.textContent = `Player ${shortId}`;
      li.style.color = player.color;
      playerListElement.appendChild(li);
    });

    if (players.length === 2) {
      startButton.disabled = false;
    } else {
      startButton.disabled = true;
    }
  }

  // Handle game reset
  function handleGameReset() {
    gameStarted = false;
    gameOver = false;
    startButton.disabled = false;
    resetButton.disabled = true;
    updateStatus("Game has been reset. Ready to start a new game.");
    clearCanvas();
    resetScores();
  }

  // Reset scores function
  function resetScores() {
    player1ScoreElement.textContent = "0";
    player2ScoreElement.textContent = "0";
  }

  // Render the game state
  function renderGameState(gameState) {
    clearCanvas();

    // Draw the apple
    drawCell(gameState.apple.x, gameState.apple.y, "red");

    // Draw the snakes
    gameState.snakes.forEach((snakeData) => {
      snakeData.snake.forEach((segment) => {
        const color = snakeData.color;
        drawCell(segment.x, segment.y, color);
      });

      // Update the scores
      updateScore(snakeData.playerId, snakeData.score);
    });
  }

  // Update the player's score
  function updateScore(playerIdToUpdate, score) {
    if (playerIdToUpdate === playerId) {
      player1ScoreElement.textContent = score;
    } else {
      player2ScoreElement.textContent = score;
    }
  }

  // Draw a cell on the canvas
  function drawCell(x, y, color) {
    context.fillStyle = color;
    context.fillRect(x * cellSize, y * cellSize, cellSize, cellSize);
  }

  // Clear the canvas
  function clearCanvas() {
    context.clearRect(0, 0, canvas.width, canvas.height);
  }

  // Get the roomId from the URL
  function getRoomIdFromURL() {
    const urlParts = window.location.pathname.split("/");
    return urlParts[urlParts.length - 1];
  }

  // Construct the WebSocket URL
  function getWebSocketURL() {
    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    return `${protocol}://${window.location.host}`;
  }

  // Map keyboard keys to directions
  function getDirectionFromKey(key) {
    switch (key) {
      case "ArrowUp":
      case "w":
      case "W":
        return "up";
      case "ArrowDown":
      case "s":
      case "S":
        return "down";
      case "ArrowLeft":
      case "a":
      case "A":
        return "left";
      case "ArrowRight":
      case "d":
      case "D":
        return "right";
      default:
        return null;
    }
  }

  // Initialize everything
  function init() {
    initWebSocket();
    initInputHandlers();
    updateStatus("Connecting to server...");
    startButton.disabled = true;
    resetButton.disabled = true; // Ensure it's disabled on load
  }

  // Start the initialization
  init();
})();
