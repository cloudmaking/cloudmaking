const WebSocket = require("ws");

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
              gamestate: data.gameState,
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

        case "cast_game_state":
          rooms[currentRoom].gamestate = data.gameState;
          broadcastGameState(currentRoom);
          break;
      }
    });

    ws.on("close", () => {
      if (currentRoom && rooms[currentRoom]) {
        rooms[currentRoom].clients = rooms[currentRoom].clients.filter(
          (client) => client !== ws
        );
        if (ws.playerId === rooms[currentRoom].gamestate.player1.id) {
          rooms[currentRoom].gamestate.player1.id =
            rooms[currentRoom].gamestate.player2.id;
          rooms[currentRoom].gamestate.player2.id = null;
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
    if (rooms[room].interval) return; // Don't start another loop if one is already running
    rooms[room].interval = setInterval(() => {
      // Update game logic here
      broadcastGameState(room);
    }, updateInterval);
  }

  function stopGameLoop(room) {
    if (rooms[room].interval) {
      clearInterval(rooms[room].interval);
      rooms[room].interval = null;
    }
  }
}

module.exports = createWebSocketServer;
