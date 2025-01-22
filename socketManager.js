/**
 * Creates and manages a WebSocket connection using a Web Worker.
 * This allows WebSocket communication to run in a separate thread,
 * ensuring the main thread remains responsive.
 *
 * @param {string} url - The WebSocket server URL to connect to.
 * @param {object} messageHandler - An object containing message handlers.
 *                           Keys are message types, and values are handler functions.
 * @param {object} options - Configuration options for the WebSocket client.
 * @param {number} [options.keepAliveTimeout=16000] - Timeout for sending keep-alive messages (in milliseconds).
 * @param {number} [options.messageInterval=2000] - Interval for batching and sending messages (in milliseconds).
 * @param {string} [options.messageDelimiter=";"] - Delimiter for combining messages.
 * @returns {object} - An object with the worker instance and a `send` method.
 */
export function createSocketManager(url, messageHandler = {}, options = {}) {
    // Destructure options with default values
    const {
        keepAliveTimeout = 16000,
        messageInterval = 2000,
        messageDelimiter = ";",
    } = options;

    // Retrieve the clientId from localStorage in the main thread
    const clientId = localStorage.getItem("clientId");

    // Create a Web Worker to handle WebSocket communication in a separate thread
    const worker = new Worker(
        URL.createObjectURL(
            new Blob([
                `
                // WebSocket and state variables
                let socket;          // WebSocket instance
                let intervalId;      // ID for the message interval
                let outgoing = [];   // Queue for outgoing messages
                let lastSeen = Date.now(); // Timestamp of the last message sent or received

                /**
                 * Sends batched messages to the server or a keep-alive message if idle.
                 */
                function sendMessages() {
                    const now = Date.now();
                    if (outgoing.length) {
                        // Send all queued messages as a single batch
                        socket.send(outgoing.join("${messageDelimiter}"));
                        outgoing = []; // Clear the queue
                        lastSeen = now;
                    } else if (now - lastSeen > ${keepAliveTimeout}) {
                        // Send a keep-alive message if the connection is idle
                        socket.send(JSON.stringify({type:"alive"}));
                        lastSeen = now;
                    }
                }

                /**
                 * Establishes a WebSocket connection and sets up event listeners.
                 */
                function connect() {
                    try {
                        socket = new WebSocket("${url}");
                    } catch (error) {
                        // If WebSocket initialization fails, post an error message and attempt to reconnect
                        console.error("WebSocket initialization failed:", error);
                        postMessage({
                            type: "error",
                            error: {
                                message: "WebSocket initialization failed",
                                raw: error instanceof Error ? error.message : String(error),
                            },
                        });
                        setTimeout(connect, ${messageInterval}); // Reconnect after a delay
                        return;
                    }

                    // Connection opened
                    socket.addEventListener("open", () => {
                        console.log("Connected to WebSocket server");

                        // Send an "init" message with the clientId (passed from the main thread)
                        const initMessage = JSON.stringify({
                            type: "init",
                            clientId: ${clientId ? `"${clientId}"` : null},
                        });
                        socket.send(initMessage);

                        // Start the interval for sending messages
                        intervalId = setInterval(sendMessages, ${messageInterval});
                    });

                    // Message received from the server
                    socket.addEventListener("message", (event) => {
                        // Split combined messages using the delimiter
                        const messages = event.data.split("${messageDelimiter}");
                        messages.forEach(message => {
                            try {
                                // Parse each message and forward to the main thread
                                const parsedMessage = JSON.parse(message);
                                postMessage(parsedMessage);
                            } catch (error) {
                                console.error("Failed to parse message:", message, error);
                                postMessage({
                                    type: "error",
                                    error: {
                                        message: "Failed to parse message",
                                        raw: message,
                                    },
                                });
                            }
                        });
                    });

                    // WebSocket error
                    socket.addEventListener("error", (error) => {
                        console.error("WebSocket error:", error);

                        // Prepare the error object to send to the main thread
                        const errorPayload = {
                            type: "error",
                            error: {
                                message: error instanceof Error ? error.message : String(error),
                                raw: error, // Include the raw error object for additional context
                            },
                        };

                        // Forward the error to the main thread
                        postMessage(errorPayload);
                    });

                    // Connection closed
                    socket.addEventListener("close", () => {
                        console.log("Disconnected from WebSocket server");
                        clearInterval(intervalId); // Stop the message interval
                        setTimeout(connect, ${messageInterval}); // Reconnect after a delay
                    });
                }

                // Listen for messages from the main thread
                self.onmessage = (event) => {
                    try {
                        const message = JSON.stringify(event.data);

                        // Check if the message contains the delimiter
                        if (message.includes("${messageDelimiter}")) {
                            throw new Error("Message contains the reserved delimiter character");
                        }

                        // Add the message to the outgoing queue
                        outgoing.push(message);
                    } catch (error) {
                        console.error("Error processing message:", error);
                        postMessage({
                            type: "error",
                            error: {
                                message: error instanceof Error ? error.message : String(error),
                                raw: error,
                            },
                        });
                    }
                };

                // Initialize the WebSocket connection
                connect();
            `,
            ])
        )
    );

    // Listen for messages from the worker
    worker.onmessage = (event) => {
        const { type, clientId: newClientId } = event.data;

        // Handle "init" response from the server
        if (type === "init" && newClientId) {
            // Save the new clientId to localStorage in the main thread
            localStorage.setItem("clientId", newClientId);
            console.log("Client ID saved to localStorage:", newClientId);
        }

        // Call the appropriate handler for the message type
        if (messageHandler[type]) {
            messageHandler[type](event.data);
        } else {
            console.error(`No handler for message type: "${type}"`);
        }
    };

    // Return the public API
    return {
        send: (message) => worker.postMessage(message), // Method to send messages to the worker
    };
}
