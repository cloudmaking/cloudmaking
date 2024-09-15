// websocket.js

const WebSocket = require("ws");
const { v4: uuidv4 } = require("uuid");

// Adjustable variables
const GRID_SIZE = 30; // Grid size (30x30)
const GAME_TICK_INTERVAL = 100; // Game update interval in ms
const WINNING_SCORE = 10; // Winning score
const PLAYER_COLORS = ["#3a71e8", "#9de83a"]; // Player colors

function createWebSocketServer(server) {
  const wss = new WebSocket.Server({ server });
  const gameRooms = new Map(); // Map of roomId to GameRoom instances

  wss.on("connection", function connection(ws, req) {
    // Parse the roomId from the query parameters
    const urlParams = new URLSearchParams(req.url.replace("/?", ""));
    const roomId = urlParams.get("roomId");

    if (!roomId) {
      ws.send(JSON.stringify({ type: "error", message: "No roomId provided" }));
      ws.close();
      return;
    }

    let gameRoom = gameRooms.get(roomId);

    if (!gameRoom) {
      // Create a new game room if it doesn't exist
      gameRoom = new GameRoom(roomId);
      gameRooms.set(roomId, gameRoom);
    }

    gameRoom.addPlayer(ws);

    ws.on("message", function incoming(message) {
      const data = JSON.parse(message);
      gameRoom.handleMessage(ws, data);
    });

    ws.on("close", function close() {
      gameRoom.removePlayer(ws);
      // Remove the room if empty to free up resources
      if (gameRoom.isEmpty()) {
        gameRooms.delete(roomId);
      }
    });
  });
}

// GameRoom class to manage individual game rooms
class GameRoom {
  constructor(roomId) {
    this.roomId = roomId;
    this.players = new Map(); // Map of ws to player objects
    this.playerCount = 0;
    this.gameState = null; // Initialize when the game starts
    this.gameInterval = null;
  }

  addPlayer(ws) {
    if (this.playerCount >= 2) {
      ws.send(JSON.stringify({ type: "error", message: "Room is full" }));
      ws.close();
      return;
    }

    const playerId = uuidv4();
    const playerColor = PLAYER_COLORS[this.playerCount];

    const player = {
      ws,
      id: playerId,
      color: playerColor,
      direction: null,
      snake: [],
      score: 0,
    };

    this.players.set(ws, player);
    this.playerCount++;

    ws.send(JSON.stringify({ type: "init", playerId, color: playerColor }));
    this.broadcastPlayerList();

    if (this.playerCount === 2) {
      this.broadcast({
        type: "status",
        message: "Both players connected. Ready to start.",
      });
    } else {
      this.broadcast({
        type: "status",
        message: "Waiting for another player...",
      });
    }
  }

  removePlayer(ws) {
    if (this.players.has(ws)) {
      this.players.delete(ws);
      this.playerCount--;

      // Stop the game if it's running
      if (this.gameInterval) {
        clearInterval(this.gameInterval);
        this.gameInterval = null;
      }

      this.broadcast({
        type: "status",
        message: "A player has disconnected. Waiting for player...",
      });
      this.broadcastPlayerList();
    }
  }

  isEmpty() {
    return this.players.size === 0;
  }

  handleMessage(ws, data) {
    const player = this.players.get(ws);
    if (!player) return;

    switch (data.type) {
      case "startGame":
        if (this.playerCount === 2) {
          this.startGame();
        } else {
          ws.send(
            JSON.stringify({
              type: "error",
              message: "Cannot start game. Waiting for another player.",
            })
          );
        }
        break;

      case "changeDirection":
        if (this.gameInterval) {
          player.nextDirection = data.direction;
        }
        break;

      default:
        ws.send(
          JSON.stringify({ type: "error", message: "Unknown message type" })
        );
        break;
    }
  }

  broadcast(data) {
    const message = JSON.stringify(data);
    for (const player of this.players.values()) {
      player.ws.send(message);
    }
  }

  broadcastPlayerList() {
    const playerList = [];
    for (const player of this.players.values()) {
      playerList.push({ playerId: player.id, color: player.color });
    }
    this.broadcast({ type: "playerList", players: playerList });
  }

  initGameState() {
    // Initialize gameState with gridSize first
    this.gameState = {
      gridSize: GRID_SIZE,
      apple: null, // Will set after gridSize is defined
    };

    // Now we can safely call getRandomPosition()
    this.gameState.apple = this.getRandomPosition();

    // Initialize players' snakes
    let index = 0;
    for (const player of this.players.values()) {
      player.snake = [this.getStartingPosition(index)];
      player.direction = "right";
      player.nextDirection = "right";
      player.score = 0;
      index++;
    }
  }

  startGame() {
    // Initialize game state
    this.initGameState();

    // Notify players that the game has started
    this.broadcast({ type: "gameStarted" });

    // Start the game loop
    this.gameInterval = setInterval(
      () => this.updateGameState(),
      GAME_TICK_INTERVAL
    );
  }

  updateGameState() {
    try {
      const gridSize = this.gameState.gridSize;

      // Create a grid to track occupied positions
      const occupiedPositions = new Map();
      for (const player of this.players.values()) {
        for (const segment of player.snake) {
          occupiedPositions.set(`${segment.x},${segment.y}`, true);
        }
      }

      for (const player of this.players.values()) {
        // Update direction
        if (player.nextDirection) {
          if (
            this.isValidDirectionChange(player.direction, player.nextDirection)
          ) {
            player.direction = player.nextDirection;
          }
          player.nextDirection = null;
        }

        // Calculate new head position
        const currentHead = player.snake[0];
        const newHead = { ...currentHead };

        switch (player.direction) {
          case "up":
            newHead.y = (newHead.y - 1 + gridSize) % gridSize;
            break;
          case "down":
            newHead.y = (newHead.y + 1) % gridSize;
            break;
          case "left":
            newHead.x = (newHead.x - 1 + gridSize) % gridSize;
            break;
          case "right":
            newHead.x = (newHead.x + 1) % gridSize;
            break;
        }

        // Check if new head position is occupied
        const newHeadKey = `${newHead.x},${newHead.y}`;
        if (occupiedPositions.has(newHeadKey)) {
          // Blocking mechanic: Do not move the snake
          // Optionally, you can set player.direction = null to stop the snake
          continue;
        } else {
          // Move the snake
          player.snake.unshift(newHead);
          occupiedPositions.set(newHeadKey, true);

          // Check for apple consumption
          if (
            newHead.x === this.gameState.apple.x &&
            newHead.y === this.gameState.apple.y
          ) {
            // Increase score
            player.score += 1;

            // Place a new apple
            this.gameState.apple = this.getRandomPosition();

            // Check for win condition
            if (player.score >= WINNING_SCORE) {
              this.endGame(`Player ${player.id} wins!`);
              return;
            }
          } else {
            // Remove the tail segment
            const tail = player.snake.pop();
            occupiedPositions.delete(`${tail.x},${tail.y}`);
          }
        }
      }

      // Send updated game state to clients
      this.sendGameState();
    } catch (err) {
      console.error("Error in updateGameState:", err);
      clearInterval(this.gameInterval);
      this.gameInterval = null;
      this.broadcast({
        type: "error",
        message: "A server error occurred. Please restart the game.",
      });
    }
  }

  isValidDirectionChange(currentDirection, nextDirection) {
    const opposites = {
      up: "down",
      down: "up",
      left: "right",
      right: "left",
    };
    return opposites[currentDirection] !== nextDirection;
  }

  sendGameState() {
    const snakes = [];
    for (const player of this.players.values()) {
      snakes.push({
        playerId: player.id,
        color: player.color,
        snake: player.snake,
        score: player.score,
      });
    }

    const gameStateMessage = {
      type: "gameState",
      apple: this.gameState.apple,
      snakes,
    };

    this.broadcast(gameStateMessage);
  }

  endGame(message) {
    clearInterval(this.gameInterval);
    this.gameInterval = null;
    this.broadcast({ type: "gameOver", message });
  }

  getRandomPosition() {
    const gridSize = this.gameState.gridSize;
    let position;
    let attempts = 0;
    do {
      position = {
        x: Math.floor(Math.random() * gridSize),
        y: Math.floor(Math.random() * gridSize),
      };
      attempts++;
    } while (this.isPositionOccupied(position) && attempts < 100);

    return position;
  }

  isPositionOccupied(position) {
    for (const player of this.players.values()) {
      for (const segment of player.snake) {
        if (position.x === segment.x && position.y === segment.y) {
          return true;
        }
      }
    }
    return false;
  }

  getStartingPosition(index) {
    const gridSize = this.gameState.gridSize;
    if (index === 0) {
      return { x: Math.floor(gridSize / 4), y: Math.floor(gridSize / 2) };
    } else {
      return { x: Math.floor((3 * gridSize) / 4), y: Math.floor(gridSize / 2) };
    }
  }
}

module.exports = createWebSocketServer;
