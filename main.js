import { createSocketManager } from "./socketManager.js";
import { setupCanvas } from "./canvasManager.js";

// Set up the canvas
setupCanvas();

// Define message handlers
const messageHandler = {
    init: (data) => {
        console.log("Received init response from server:", data);
        if (data.clientId) {
            console.log("Client ID saved to localStorage:", data.clientId);
        }
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
};

// Create the WebSocket client
const socketManager = createSocketManager(
    "ws://localhost:8080",
    messageHandler,
    {
        keepAliveTimeout: 16000,
        messageInterval: 2000,
        messageDelimiter: ";",
    }
);

// Send a message
socketManager.send({ type: "message", content: "Hello, WebSocket!" });
