// Function to create and manage a WebSocket connection
export function createWebSocketClient(url, handler = {}) {
    const SERVER_DISCONNECT_TIMEOUT = 20000;
    const worker = new Worker(
        URL.createObjectURL(
            new Blob([
                `
    // List of pending outgoing messages
    let outgoing = [];

    let lastseen = Date.now();

    // Create a WebSocket connection to the server
    const socket = new WebSocket("${url}");

    // Connection opened
    socket.addEventListener("open", () => {
        console.log("Connected to the WebSocket server");
        socket.send("Hello Server!"); // Send a message to the server
        setInterval(() => {
            const now = Date.now();
            let messages = [];
            if (outgoing.length) {
                messages = outgoing;
                outgoing = [];
                ws.send(messages.join(";"));
                lastseen = now;
            }
            if (now - lastseen > ${SERVER_DISCONNECT_TIMEOUT} * 0.8) {
                ws.send('alive');
                lastseen = now;
            }
}, 2000);
    });

    // Listen for messages from the server
    socket.addEventListener("message", (messages) => {
        console.log("Message from server:", messages.data.toString());
        for (let message of messages.data.split(";")) {
            postMessage(JSON.parse(message));
        }
    });

    // Handle errors
    socket.addEventListener("error", (error) => {
        console.error("WebSocket error:", error);
    });

    // Connection closed
    socket.addEventListener("close", () => {
        console.log("Disconnected from the WebSocket server");
    });


`,
            ])
        )
    );
    worker.onmessage = (message) => {
        message = message.data;
        if (!handler.hasOwnProperty(message.type)) {
            return console.error(
                `"${message.type}" message received, but no handler found.`
            );
        }
        handler[message.type](message);
    };

    // Return the socket instance for further use
    return {
        worker,
        send: (message) => worker.postMessage(message),
    };
}
