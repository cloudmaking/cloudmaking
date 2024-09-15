// game_room_ui.js

document.addEventListener("DOMContentLoaded", () => {
  const fullscreenButton = document.getElementById("fullscreen-btn");
  const homeButton = document.getElementById("homeButton");
  const copyLinkButton = document.getElementById("copy-link-button");
  const body = document.body;
  const gameContainer = document.getElementById("game");

  // Fullscreen Toggle
  fullscreenButton.addEventListener("click", () => {
    if (!document.fullscreenElement) {
      body
        .requestFullscreen()
        .then(() => {
          body.classList.add("fullscreen-active");
          fullscreenButton.classList.add("is-fullscreen");
        })
        .catch((err) => {
          console.error(
            `Error attempting to enable fullscreen mode: ${err.message}`
          );
        });
    } else {
      document
        .exitFullscreen()
        .then(() => {
          body.classList.remove("fullscreen-active");
          fullscreenButton.classList.remove("is-fullscreen");
        })
        .catch((err) => {
          console.error(
            `Error attempting to exit fullscreen mode: ${err.message}`
          );
        });
    }
  });

  // Listen for fullscreen change to toggle classes
  document.addEventListener("fullscreenchange", () => {
    if (document.fullscreenElement) {
      body.classList.add("fullscreen-active");
      fullscreenButton.classList.add("is-fullscreen");
    } else {
      body.classList.remove("fullscreen-active");
      fullscreenButton.classList.remove("is-fullscreen");
    }
  });

  // Prevent default touch behaviors when in fullscreen
  document.addEventListener(
    "touchmove",
    (event) => {
      if (document.fullscreenElement) {
        event.preventDefault();
      }
    },
    { passive: false }
  );

  // Home Button Functionality
  homeButton.addEventListener("click", () => {
    window.location.href = "https://cloudmaking.co.uk";
  });

  // Copy Link Button Functionality
  copyLinkButton.addEventListener("click", () => {
    const roomLink = window.location.href;
    navigator.clipboard
      .writeText(roomLink)
      .then(() => {
        alert("Room link copied to clipboard!");
      })
      .catch((err) => {
        console.error("Failed to copy: ", err);
      });
  });
});
