// online_snake.js

function createRoom() {
  // Generate a unique room ID
  const roomId = "room_" + Math.random().toString(36).substr(2, 9);

  // Redirect to the game room page
  window.location.href = `/online_snake/room/${roomId}`;
}
