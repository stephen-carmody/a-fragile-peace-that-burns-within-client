import { createSocketManager } from "./socketManager.js";
import { createChatManager } from "./chatManager.js";

document.addEventListener("DOMContentLoaded", () => {
    // Create the chat manager
    const chatManager = createChatManager();

    // Initialize the chat manager with initial channels and height
    chatManager.init(["Event", "Local"], "restored"); // Updated initial channels

    // Define message handlers
    const messageHandler = {
        init: (data) => {
            // Leave the init handler blank as requested
        },
        message: (data) => {
            chatManager.addMessage(
                data.content,
                "received",
                data.channel || "Event"
            );
        },
        error: (data) => {
            chatManager.addMessage(
                `Error: ${data.message}`,
                "received",
                "Event"
            );
        },
        connected: (data) => {
            chatManager.addMessage(
                `Client ${data.clientId} connected`,
                "received",
                "Event"
            );
        },
        disconnected: (data) => {
            chatManager.addMessage(
                `Client ${data.clientId} disconnected`,
                "received",
                "Event"
            );
        },
        welcome: (data) => {
            // Clear the preserved state when a welcome message is received
            chatManager.clearState();
            chatManager.init(["Event", "Local"], "restored"); // Updated initial channels
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
