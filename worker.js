// worker.js
let wsUrl = "ws://localhost:8080";
let clientSecret = "";
let socket = null;
let sendBuffer = [];
let reconnectAttempts = 0;
let keepAliveTimeout = 30000;
let lastSentTime = 0;

/**
 * Establishes a WebSocket connection to the server.
 */
function connect() {
    socket = new WebSocket(`${wsUrl}?secret=${clientSecret}`);

    socket.onopen = () => {
        reconnectAttempts = 0;
        //console.log("worker: WebSocket connected");
    };

    socket.onmessage = ({ data }) => {
        //console.log(`worker:received <- ${data}`);
        data.split("\n").forEach((msg) => {
            try {
                const parsed = JSON.parse(msg);
                if (parsed.type === "connected") {
                    if (parsed.clientSecret) {
                        clientSecret = parsed.clientSecret;
                    }
                    if (parsed.keepAliveTimeout) {
                        keepAliveTimeout = parsed.keepAliveTimeout;
                    }
                }
                postMessage(parsed);
            } catch (err) {
                console.error("worker: Failed to parse message:", msg, err);
            }
        });
    };

    socket.onclose = () => {
        const delay = Math.min(1000 * 2 ** reconnectAttempts++, 60000);
        postMessage({
            type: "offline",
            message: `Server offline. Reconnecting in ${delay / 1000}s...`,
        });
        setTimeout(connect, delay);
    };

    socket.onerror = (err) => {
        console.error("worker: WebSocket error:", err);
    };
}

/**
 * Adds a message to the send buffer.
 * @param {Object} message - The message to send.
 */
function sendMessage(message) {
    sendBuffer.push(JSON.stringify(message));
}

/**
 * Periodically sends buffered messages and maintains keep-alive.
 */
setInterval(() => {
    if (!sendBuffer.length && Date.now() - lastSentTime > keepAliveTimeout - 5000) {
        sendBuffer.push(JSON.stringify({ type: "ping" }));
    }
    if (sendBuffer.length && socket?.readyState === WebSocket.OPEN) {
        const message = sendBuffer.join("\n");
        socket.send(message);
        console.log(`worker:send -> ${message}`);
        sendBuffer = [];
        lastSentTime = Date.now();
    }
}, 2000);

self.onmessage = ({ data }) => {
    if (data.type === "connect") {
        wsUrl = data.url;
        clientSecret = data.clientSecret || "";
        connect();
    } else {
        sendMessage(data);
    }
};
