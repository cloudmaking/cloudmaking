const WebSocket = require("ws");

const cols = 30;
const rows = 30;

function createWebSocketServer(server) {
  const wss = new WebSocket.Server({ server });
  let rooms = {};
  let updateInterval = 100; // Interval in milliseconds

  wss.on("connection", (ws) => {
    let currentRoom = null;

    ws.on("message", (message) => {
      let data = JSON.parse(message);
      if (!data.type) {
        console.error("Received message without type:", data);
        return;
      }
      switch (data.type) {
        case "new_player":
          currentRoom = data.roomId;
          if (!rooms[currentRoom]) {
            rooms[currentRoom] = {
              clients: [],
              gamestate: {
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
                apple: generateAppleLocation(), // Initialize apple location
                gameRunning: false,
                statusBarText: "Waiting for player 2...",
                startButtonText: "Start Game",
              },
              interval: null,
            };
          }
          if (rooms[currentRoom].gamestate.player1.id === null) {
            ws.playerId = generatePlayerId();
            rooms[currentRoom].gamestate.player1.id = ws.playerId;
            rooms[currentRoom].gamestate.statusBarText =
              "Waiting for player 2...";
            console.log("Player 1 connected to room:", currentRoom);
            ws.send(
              JSON.stringify({ type: "player_id", playerId: ws.playerId })
            );
          } else if (rooms[currentRoom].gamestate.player2.id === null) {
            ws.playerId = generatePlayerId();
            rooms[currentRoom].gamestate.player2.id = ws.playerId;
            rooms[currentRoom].gamestate.statusBarText = "Press start to begin";
            console.log("Player 2 connected to room:", currentRoom);
            ws.send(
              JSON.stringify({ type: "player_id", playerId: ws.playerId })
            );
            startGameLoop(currentRoom);
          } else {
            ws.playerId = null;
            ws.send(JSON.stringify({ type: "game_full" }));
            ws.close();
          }
          rooms[currentRoom].clients.push(ws);
          broadcastGameState(currentRoom);
          break;

        case "scheduled_update":
          gamestate = data.gameState;
          updateScores(); // Update scores if needed
          renderGameState(); // Redraw the canvas
          break;

        case "cast_game_state":
          rooms[currentRoom].gamestate = data.gameState;
          broadcastGameState(currentRoom);
          break;

        case "update_direction":
          if (currentRoom && rooms[currentRoom]) {
            const gameState = rooms[currentRoom].gamestate;
            const player =
              ws.playerId === gameState.player1.id
                ? gameState.player1
                : gameState.player2;
            console.log(
              `Before update: Player ${ws.playerId} direction: ${player.direction.x}, ${player.direction.y}`
            );

            player.direction = data.direction;

            console.log(
              `After update: Player ${ws.playerId} direction: ${player.direction.x}, ${player.direction.y}`
            );
            broadcastGameState(currentRoom);
          }
          break;
      }
    });

    ws.on("close", () => {
      if (currentRoom && rooms[currentRoom]) {
        rooms[currentRoom].clients = rooms[currentRoom].clients.filter(
          (client) => client !== ws
        );
        if (ws.playerId === rooms[currentRoom].gamestate.player1.id) {
          rooms[currentRoom].gamestate.player1.id = null;
          console.log("Player 1 left in room:", currentRoom);
          castPlayerLeft(currentRoom);
        } else if (ws.playerId === rooms[currentRoom].gamestate.player2.id) {
          rooms[currentRoom].gamestate.player2.id = null;
          console.log("Player 2 left in room:", currentRoom);
          castPlayerLeft(currentRoom);
        }
        if (rooms[currentRoom].clients.length === 0) {
          stopGameLoop(currentRoom);
        }
      }
    });
  });

  function castPlayerLeft(room) {
    const message = JSON.stringify({
      type: "player_left",
      gameState: rooms[room].gamestate,
    });

    rooms[room].clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  function broadcastGameState(room) {
    const message = JSON.stringify({
      type: "update_game_state",
      gameState: rooms[room].gamestate,
    });

    rooms[room].clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    });
  }

  function generatePlayerId() {
    let playerId;
    do {
      playerId = "player_" + Math.random().toString(36).substr(2, 9);
    } while (
      Object.values(rooms).some(
        (room) =>
          room.gamestate.player1.id === playerId ||
          room.gamestate.player2.id === playerId
      )
    );
    return playerId;
  }

  function startGameLoop(room) {
    if (rooms[room].interval) return;

    console.log(`Starting game loop for room ${room}`);
    rooms[room].interval = setInterval(() => {
      const gameState = rooms[room].gamestate;

      if (gameState.gameRunning) {
        console.log(`Game loop running: ${JSON.stringify(gameState)}`);
        moveSnake(gameState.player1, gameState);
        moveSnake(gameState.player2, gameState);
        checkAppleCollision(gameState);
        broadcastGameState(room);
      }
    }, updateInterval);
  }

  function moveSnake(player, gameState) {
    const newLocation = {
      x: player.location.x + player.direction.x,
      y: player.location.y + player.direction.y,
    };

    // Ensure the new location is within bounds
    newLocation.x = Math.max(0, Math.min(cols - 1, newLocation.x));
    newLocation.y = Math.max(0, Math.min(rows - 1, newLocation.y));

    console.log(
      `Attempting to move player ${player.id} to ${newLocation.x}, ${newLocation.y}`
    );

    if (!isOccupied(newLocation, gameState)) {
      console.log(`Moved player ${player.id} to new location.`);
      player.location = newLocation; // Actually update the location
    } else {
      console.log(`Player ${player.id} move blocked by occupation.`);
    }
  }

  function isOccupied(location, gameState) {
    return (
      (location.x === gameState.player1.location.x &&
        location.y === gameState.player1.location.y) ||
      (location.x === gameState.player2.location.x &&
        location.y === gameState.player2.location.y)
    );
  }

  function checkAppleCollision(gameState) {
    const players = [gameState.player1, gameState.player2];
    players.forEach((player) => {
      if (
        player.location.x === gameState.apple.x &&
        player.location.y === gameState.apple.y
      ) {
        player.score++;
        gameState.apple = generateAppleLocation(gameState);
      }
    });
  }

  function generateAppleLocation(gameState) {
    let newLocation;
    do {
      newLocation = {
        x: Math.floor(Math.random() * cols),
        y: Math.floor(Math.random() * rows),
      };
    } while (isOccupied(newLocation, gameState));
    return newLocation;
  }
}

module.exports = createWebSocketServer;
