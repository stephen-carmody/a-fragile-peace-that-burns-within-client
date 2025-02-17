const keybindPopup = document.getElementById("keybindPopup");
const chatInput = document.getElementById("chatInput");
const messagesContainer = document.getElementById("messages");
const chatContainer = document.getElementById("chatContainer");

let currentChannel = "global";
setChannel(currentChannel);

document.addEventListener("keydown", (event) => {
    if (event.ctrlKey && event.key === "/") {
        keybindPopup.style.display =
            keybindPopup.style.display === "none" ? "block" : "none";
    }
    if (event.ctrlKey && event.key === "Enter") {
        toggleChat();
    }
});

chatInput.addEventListener("keydown", (event) => {
    if (event.ctrlKey) return;
    if (event.key === "Enter") {
        const message = chatInput.value.trim();
        displayMessage(message, "sent", currentChannel);
        worker.postMessage({ type: "message", content: message });
        chatInput.value = "";
    }
});

function toggleChat() {
    const button = document.querySelector(".sidebar button");
    chatContainer.classList.toggle("hidden");
    if (chatContainer.classList.contains("hidden")) {
        chatInput.blur();
        button.textContent = "❯❯";
    } else {
        chatInput.focus();
        button.textContent = "❮❮";
    }
}

function displayMessage(text, type, channel) {
    const newMessage = document.createElement("div");
    newMessage.textContent = text;
    newMessage.classList.add("message");
    newMessage.dataset.channel = channel;
    newMessage.style.background = type === "sent" ? "#007bff" : "#ddd";
    newMessage.style.color = type === "sent" ? "white" : "black";
    newMessage.style.display = channel === currentChannel ? "block" : "none";
    messagesContainer.appendChild(newMessage);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function setChannel(channel) {
    currentChannel = channel;
    filterMessages();
    if (chatContainer.classList.contains("hidden")) {
        toggleChat();
    }
    document.querySelectorAll(".channelBtn").forEach((btn) => {
        console.log(
            btn.dataset.channel,
            channel,
            btn.dataset.channel === channel
        );
        btn.style.textShadow =
            btn.dataset.channel === channel ? "0 0 0 #87CEEB" : "0 0 0 white";
    });
}

function filterMessages() {
    document.querySelectorAll(".message").forEach((msg) => {
        msg.style.display =
            msg.dataset.channel === currentChannel ? "block" : "none";
    });
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

const worker = new Worker(
    URL.createObjectURL(
        new Blob([
            `
                        let wsUrl = "localhost:8080";
                        let clientSecret;
                        let socket = null;
                        let sendBuffer = [];
                        let reconnectAttempts = 0;
                        let keepAliveTimeout = 30000;
                        let lastSentTime = 0;

                        setInterval(maintenance, 2000);

                        function connect() {
                            socket = new WebSocket(wsUrl);

                            socket.onopen = () => {
                                reconnectAttempts = 0;
                                sendMessage({ type: "init", clientSecret });
                            };

                            socket.onmessage = (event) => {
                                const messages = event.data.split("\\n");
                                messages.forEach((msg) => {
                                    try {
                                        const data = JSON.parse(msg);
                                        if (data.type === "init" && data.clientSecret) {
                                            clientSecret = data.clientSecret;
                                        }
                                        postMessage(data);
                                    } catch (error) {
                                        console.error("Failed to parse message:", msg);
                                    }
                                });
                            };

                            socket.onclose = () => {
                                let delay = 1000 * Math.pow(2, reconnectAttempts++);
                                delay = Math.min(delay, 30000);
                                let delaySecs = Math.round(delay / 1000);

                                postMessage({
                                    type: "message",
                                    content: "WebSocket closed. Reconnecting " + delaySecs + "s..."
                                });
                                setTimeout(() => connect(), delay);
                            };
                        }

                        function sendMessage(message) {
                            sendBuffer.push(JSON.stringify(message));
                        }

                        function maintenance() {
                            if (!sendBuffer.length && Date.now() - lastSentTime > keepAliveTimeout * 0.8) {
                                sendBuffer.push(JSON.stringify({ type: "ping" }));
                            }

                            if (sendBuffer.length) {
                                if (socket.readyState !== WebSocket.OPEN) return;
                                try {
                                    const bufferedMessages = sendBuffer.join("\\n");
                                    sendBuffer = [];
                                    socket.send(bufferedMessages);
                                    lastSentTime = Date.now();
                                    console.log("Sent ->", bufferedMessages);
                                } catch (error) {
                                    console.error("WebSocket send error:", error);
                                }
                            }
                        }

                        self.onmessage = function(event) {
                            if (event.data.type === "connect") {
                                wsUrl = event.data.url;
                                clientSecret = event.data.clientSecret;
                                connect();
                            } else {
                                sendMessage(event.data);
                            }
                        };

                    `,
        ])
    )
);

worker.onmessage = (event) => {
    const data = event.data;
    console.log("Received <-", data);
    if (data.type === "init") {
        if (data.clientSecret)
            localStorage.setItem("clientSecret", data.clientSecret);
    } else if (data.type === "message") {
        displayMessage(data.content, "received", data.channel);
    }
};

worker.postMessage({
    type: "connect",
    url: "ws://localhost:8080",
    clientSecret: localStorage.getItem("clientSecret"),
});
