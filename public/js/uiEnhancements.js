// uiEnhancements.js

document.addEventListener("DOMContentLoaded", () => {
  const fullscreenButton = document.getElementById("fullscreen-btn");
  const body = document.body;
  const gameContainer = document.getElementById("game");

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
});
