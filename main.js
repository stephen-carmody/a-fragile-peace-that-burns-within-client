import { createSocketManager } from "./socketManager.js";
import { setupCanvas } from "./canvasManager.js";

// Set up the canvas
setupCanvas();

// Define message handlers
const messageHandler = {
    init: (data) => {
        console.log("Received init response from server:", data);
    },
    message: (data) => {
        console.log("Received message:", data);
    },
    error: (data) => {
        console.error("Error occurred:", data.message);
    },
    connected: (data) => {
        console.log("WebSocket connection established:", data);
    },
    disconnected: (data) => {
        console.log("Client disconnected:", data.clientId);
    },
};

// Create the WebSocket client
const socketManager = createSocketManager(
    "ws://localhost:8080",
    messageHandler
);

// Send a message
socketManager.send({ type: "message", content: "Hello, WebSocket!" });

// Handle page unload to clean up the worker
window.addEventListener("beforeunload", () => {
    socketManager.close();
});
