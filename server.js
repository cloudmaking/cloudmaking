const express = require("express");
const http = require("http");
const path = require("path");

const createWebSocketServer = require("./snake_websocket");

const app = express();
const server = http.createServer(app);

// Initialize WebSocket server on the existing HTTP server
createWebSocketServer(server);

// Set up EJS as the view engine and specify the views directory
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// Serve static files from the 'public' directory
app.use(express.static("public"));

// Define routes for various pages
app.get("/", (req, res) => {
  res.render("index"); // Ensure this renders your index.ejs file
});

app.get("/online_snake", (req, res) => {
  res.render("online_snake");
});

app.get("/online_snake/room/:roomId", (req, res) => {
  const { roomId } = req.params;
  res.render("game_room", { roomId });
});

// Set the server to listen on the specified port
const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server listening on port ${PORT}...`);
});
