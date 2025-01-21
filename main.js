import { createSocketManager } from "./socketManager.js";

const canvas = document.querySelector("canvas");
const ctx = canvas.getContext("2d");

function resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    ctx.scale(dpr, dpr); // Scale the context to match the device pixel ratio
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas(); // Initial resize

// Define message handlers
const handler = {
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
        console.error("Error occurred:", data.error);
    },
};

// Create the WebSocket client
const socketManager = createSocketManager("ws://localhost:8080", handler, {
    keepAliveTimeout: 16000,
    messageInterval: 2000,
    messageDelimiter: ";",
});

// Send a message
socketManager.send({ type: "message", content: "Hello, WebSocket!" });
