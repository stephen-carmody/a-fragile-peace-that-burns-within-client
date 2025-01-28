import { createSocketManager } from "./socketManager.js";
import { createChatManager } from "./chatManager.js";

document.addEventListener("DOMContentLoaded", () => {
    // Create the chat manager
    const chatManager = createChatManager();

    // Initialize the chat manager with initial channels and height
    chatManager.init(["System"], "restored");

    // Define message handlers
    const messageHandler = {
        init: (data) => {
            // Leave the init handler blank as requested
        },
        message: (data) => {
            chatManager.addMessage(
                data.content,
                "received",
                data.channel || "System"
            );
        },
        error: (data) => {
            chatManager.addMessage(
                `Error: ${data.message}`,
                "received",
                "System"
            );
        },
        connected: (data) => {
            chatManager.addMessage(
                `Client ${data.clientId} connected`,
                "received",
                "System"
            );
        },
        disconnected: (data) => {
            chatManager.addMessage(
                `Client ${data.clientId} disconnected`,
                "received",
                "System"
            );
        },
        welcome: (data) => {
            // Clear the preserved state when a welcome message is received
            chatManager.clearState();
            chatManager.init(["System"], "restored"); // Reinitialize with default state
            chatManager.addMessage(data.message, "received", "System");
        },
    };

    // Create the WebSocket client
    const socketManager = createSocketManager(
        "ws://localhost:8080",
        messageHandler
    );

    // Handle page unload to clean up the worker
    window.addEventListener("beforeunload", () => {
        socketManager.close();
    });
});
