export function createSocketManager(url, messageHandler = {}, options = {}) {
    const DEBUG = true;

    // Get initial clientSecret from localStorage
    let clientSecret = localStorage.getItem("clientSecret");

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
                
                // Instead of hardcoding clientSecret, we'll receive it via messages
                let clientSecret = null;
                let keepAliveTimeout = 30000;
                let updateInterval = 5000;
                let messageDelimiter = ";";
                
                // Add handler for control messages from main thread
                self.onmessage = function(event) {
                    if (event.data.type === 'control') {
                        switch(event.data.action) {
                            case 'connect':
                                clientSecret = event.data.clientSecret;
                                connect();
                                break;
                            case 'updateSecret':
                                clientSecret = event.data.clientSecret;
                                break;
                            case 'message':
                                handleMessageFromMainThread(event.data.message);
                                break;
                        }
                    } else {
                        handleMessageFromMainThread(event.data);
                    }
                };

                function sendMessages() {
                    const now = Date.now();
                    if (outgoing.length) {
                        const batch = outgoing.join(messageDelimiter);
                        ${DEBUG ? 'console.log("[SOCKET] Sending messages to server:", batch);' : ""}
                        socket.send(batch);
                        outgoing = [];
                        lastSeen = now;
                    } else if (now - lastSeen > keepAliveTimeout * 0.5) {
                        const keepAliveMessage = JSON.stringify({ type: "alive" });
                        ${DEBUG ? 'console.log("[SOCKET] Sending keep-alive message:", keepAliveMessage);' : ""}
                        socket.send(keepAliveMessage);
                        lastSeen = now;
                    }
                }

                function getReconnectDelay() {
                    const delay = Math.min(1000 * Math.pow(2, reconnectAttempts), maxReconnectDelay);
                    reconnectAttempts++;
                    return delay;
                }

                function connect() {
                    socket = new WebSocket("${url}");
                    
                    socket.addEventListener("open", () => {
                        ${DEBUG ? 'console.log("[SOCKET] Connected to WebSocket server");' : ""}
                        reconnectAttempts = 0;
                        
                        const initMessage = JSON.stringify({
                            type: "init",
                            clientSecret: clientSecret
                        });
                        ${DEBUG ? 'console.log("[SOCKET] Sending init message:", initMessage);' : ""}
                        socket.send(initMessage);
                        
                        intervalId = setInterval(sendMessages, updateInterval);
                    });

                    socket.addEventListener("message", (event) => {
                        ${DEBUG ? 'console.log("[SOCKET] Received message from server:", event.data);' : ""}
                        const messages = event.data.split(messageDelimiter);
                        messages.forEach((message) => {
                            try {
                                const parsedMessage = JSON.parse(message);
                                const { type } = parsedMessage;
                                
                                // Forward all messages to main thread
                                postMessage(parsedMessage);
                                
                                if (type === "init") {
                                    // Let main thread handle clientSecret updates
                                    const { keepAliveTimeout: newKeepAliveTimeout, updateInterval: newUpdateInterval } = parsedMessage;
                                    if (newKeepAliveTimeout) {
                                        keepAliveTimeout = newKeepAliveTimeout;
                                    }
                                    if (newUpdateInterval) {
                                        updateInterval = newUpdateInterval;
                                        clearInterval(intervalId);
                                        intervalId = setInterval(sendMessages, updateInterval);
                                    }
                                }
                            } catch (error) {
                                console.error("[SOCKET] Failed to parse message:", message, error);
                            }
                        });
                    });

                    socket.addEventListener("error", (error) => {
                        console.error("[SOCKET] WebSocket error:", error);
                    });

                    socket.addEventListener("close", () => {
                        ${DEBUG ? 'console.log("[SOCKET] Disconnected from WebSocket server");' : ""}
                        clearInterval(intervalId);
                        const delay = getReconnectDelay();
                        ${DEBUG ? "console.log(`[SOCKET] Reconnecting in ${delay / 1000} seconds...`);" : ""}
                        setTimeout(connect, delay);
                    });
                }

                function handleMessageFromMainThread(message) {
                    try {
                        const messageStr = JSON.stringify(message);
                        ${DEBUG ? 'console.log("[SOCKET] Received message from main thread:", messageStr);' : ""}
                        
                        if (messageStr.includes(messageDelimiter)) {
                            throw new Error("Message contains the reserved delimiter character");
                        }
                        
                        outgoing.push(messageStr);
                    } catch (error) {
                        console.error("[SOCKET] Error processing message:", error);
                        postMessage({
                            type: "error",
                            message: "Error processing message"
                        });
                    }
                }
            `,
            ])
        )
    );

    // Handle messages from the worker
    worker.onmessage = (event) => {
        const { type, clientId, clientSecret: newClientSecret } = event.data;

        // Handle init response from server
        if (type === "init" && newClientSecret) {
            if (clientSecret !== newClientSecret) {
                if (DEBUG)
                    console.log(
                        `[SOCKET] Updating client secret from ${clientSecret} to ${newClientSecret}`
                    );
                clientSecret = newClientSecret;
                localStorage.setItem("clientSecret", clientSecret);

                // Update the worker's clientSecret
                worker.postMessage({
                    type: "control",
                    action: "updateSecret",
                    clientSecret,
                });
            }
        }

        // Call the appropriate message handler
        if (messageHandler[type]) {
            messageHandler[type](event.data);
        } else {
            console.error(`[SOCKET] No handler for message type: "${type}"`);
        }
    };

    // Tell the worker the localStorage secret and start the connection
    worker.postMessage({
        type: "control",
        action: "connect",
        clientSecret,
    });

    return {
        send: (message) => {
            if (DEBUG)
                console.log("[SOCKET] Sending message to worker:", message);
            worker.postMessage({
                type: "control",
                action: "message",
                message,
            });
        },
        close: () => {
            if (DEBUG) console.log("[SOCKET] Terminating worker");
            worker.terminate();
        },
    };
}
