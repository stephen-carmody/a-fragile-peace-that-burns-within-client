/**
 * Creates and manages a WebSocket connection using a Web Worker.
 * This allows WebSocket communication to run in a separate thread,
 * ensuring the main thread remains responsive.
 *
 * @param {string} url - The WebSocket server URL to connect to.
 * @param {object} messageHandler - An object containing message handlers.
 *                           Keys are message types, and values are handler functions.
 * @param {object} options - Configuration options for the WebSocket client.
 * @returns {object} - An object with the worker instance and a `send` method.
 */
export function createSocketManager(url, messageHandler = {}, options = {}) {
    const {} = options;

    // Retrieve the clientSecret from localStorage
    const clientSecret = localStorage.getItem("clientSecret");

    // Create a Web Worker to handle WebSocket communication in a separate thread
    const worker = new Worker(
        URL.createObjectURL(
            new Blob([
                `
                let socket;
                let intervalId;
                let outgoing = [];
                let lastSeen = Date.now();
                let reconnectAttempts = 0;
                const maxReconnectDelay = 30000;

                let keepAliveTimeout = 30000;
                let updateInterval = 5000;
                let messageDelimiter = ";";

                /**
                 * Sends batched messages to the server or a keep-alive message if idle.
                 */
                function sendMessages() {
                    const now = Date.now();
                    if (outgoing.length) {
                        // Send all queued messages as a single batch
                        socket.send(outgoing.join(messageDelimiter));
                        outgoing = []; // Clear the queue
                        lastSeen = now;
                    } else if (now - lastSeen > keepAliveTimeout * 0.5) {
                        // Send a keep-alive message if the connection is idle
                        socket.send(JSON.stringify({ type: "alive" }));
                        lastSeen = now;
                    }
                }

                /**
                 * Calculates the delay for the next reconnection attempt using exponential backoff.
                 * @returns {number} - The delay in milliseconds.
                 */
                function getReconnectDelay() {
                    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), maxReconnectDelay);
                    reconnectAttempts++;
                    return delay;
                }

                /**
                 * Establishes a WebSocket connection and sets up event listeners.
                 */
                function connect() {
                    socket = new WebSocket("${url}");

                    // Connection opened
                    socket.addEventListener("open", () => {
                        console.log("Connected to WebSocket server");
                        reconnectAttempts = 0; // Reset reconnection attempts on successful connection

                        // Send an "init" message with the clientSecret (passed from the main thread)
                        const initMessage = JSON.stringify({
                            type: "init",
                            clientSecret: ${clientSecret ? `"${clientSecret}"` : null},
                        });
                        console.log(initMessage);
                        socket.send(initMessage);

                        // Start the interval for sending messages
                        intervalId = setInterval(sendMessages, updateInterval);
                    });

                    // Message received from the server
                    socket.addEventListener("message", (event) => {
                        // Split combined messages using the delimiter
                        const messages = event.data.split(messageDelimiter);
                        messages.forEach((message) => {
                            try {
                                // Parse each message and forward to the main thread
                                const parsedMessage = JSON.parse(message);

                                // Adjust keepAliveTimeout and updateInterval if provided in init message
                                const { type } = parsedMessage;
                                if (type === "init") {
                                    const { clientId, keepAliveTimeout: newKeepAliveTimeout, updateInterval: newUpdateInterval } = parsedMessage;
                                    console.log("clientId " + clientId);
                                    if (newKeepAliveTimeout) {
                                        keepAliveTimeout = newKeepAliveTimeout;
                                        console.log("updated keepAliveTimeout to " + keepAliveTimeout);
                                    }
                                    if (newUpdateInterval) {
                                        updateInterval = newUpdateInterval;
                                        console.log("updated updateInterval to " + updateInterval);
                                        clearInterval(intervalId); // Stop the message interval
                                        // Start the interval for sending messages
                                        intervalId = setInterval(sendMessages, updateInterval);
                                    }
                                }

                                postMessage(parsedMessage);
                            } catch (error) {
                                console.error("Failed to parse message:", message, error);
                            }
                        });
                    });

                    // WebSocket error
                    socket.addEventListener("error", (error) => {
                        console.error("WebSocket error:", error);
                    });

                    // Connection closed
                    socket.addEventListener("close", () => {
                        console.log("Disconnected from WebSocket server");
                        clearInterval(intervalId); // Stop the message interval

                        // Reconnect after a delay using exponential backoff
                        const delay = getReconnectDelay();
                        console.log(\`Reconnecting in \${delay / 1000} seconds...\`);
                        setTimeout(connect, delay);
                    });
                }

                /**
                 * Processes messages received from the main thread.
                 * @param {MessageEvent} event - The message event.
                 */
                function handleMessageFromMainThread(event) {
                    try {
                        const message = JSON.stringify(event.data);

                        // Check if the message contains the delimiter
                        if (message.includes(messageDelimiter)) {
                            throw new Error("Message contains the reserved delimiter character");
                        }

                        // Add the message to the outgoing queue
                        outgoing.push(message);
                    } catch (error) {
                        console.error("Error processing message:", error);
                        postMessage({
                            type: "error",
                            message: "Error processing message",
                        });
                    }
                }

                // Listen for messages from the main thread
                self.onmessage = handleMessageFromMainThread;

                // Initialize the WebSocket connection
                connect();
            `,
            ])
        )
    );

    // Listen for messages from the worker
    worker.onmessage = (event) => {
        const { type, clientId, clientSecret } = event.data;

        // Handle "init" response from the server
        if (type === "init") {
            console.log(event.data);
            if (clientSecret) {
                // Retrieve the clientSecret from localStorage
                const storedClientSecret = localStorage.getItem("clientSecret");

                // If clientSecret has changed, save the new clientSecret
                if (storedClientSecret !== clientSecret) {
                    localStorage.setItem("clientSecret", clientSecret);
                    console.log("New secret saved to localStorage");
                }
            }
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
        close: () => worker.terminate(), // Terminate the worker when no longer needed
    };
}
