export function createChat(wsUrl = "ws://localhost:8080") {
    const channelList = document.getElementById("channel-list");
    const messageContainer = document.getElementById("message-container");
    const messageInput = document.getElementById("message-input");
    const sendButton = document.getElementById("send-button");
    const container = document.querySelector(".container");
    const messagesPane = document.querySelector(".messages-pane");

    let channels = ["Event", "Local"];
    let currentChannel = "Event";
    let messages = {};
    let socket;
    let clientSecret = localStorage.getItem("clientSecret");

    function handleMessage(data) {
        if (data.type === "init" && data.clientSecret) {
            clientSecret = data.clientSecret;
            localStorage.setItem("clientSecret", clientSecret);
        } else if (data.type === "message") {
            addMessage(data.content, "received", data.channel || "Event");
        } else if (data.type === "error") {
            addMessage(`Error: ${data.message}`, "received", "Event");
        } else if (data.type === "connected") {
            addMessage(
                `Client ${data.clientId} connected`,
                "received",
                "Event"
            );
        } else if (data.type === "disconnected") {
            addMessage(
                `Client ${data.clientId} disconnected`,
                "received",
                "Event"
            );
        } else if (data.type === "welcome") {
            localStorage.removeItem("chatState");
            messages = {};
            addMessage(data.message, "received", "Event");
        }
    }

    function connectWebSocket() {
        socket = new WebSocket(wsUrl);

        socket.onopen = () => {
            socket.send(JSON.stringify({ type: "init", clientSecret }));
        };

        socket.onmessage = (event) => {
            const messages = event.data.split(";");
            messages.forEach((msg) => {
                try {
                    handleMessage(JSON.parse(msg));
                } catch (error) {
                    console.error("Failed to parse message:", msg);
                }
            });
        };

        socket.onclose = () => {
            setTimeout(connectWebSocket, 1000);
        };
    }

    function addMessage(text, type, channel) {
        if (!messages[channel]) messages[channel] = [];
        messages[channel].push({ text, type });

        if (channel === currentChannel) {
            const messageElement = document.createElement("div");
            messageElement.classList.add("message", type);
            messageElement.textContent = text;
            messageContainer.appendChild(messageElement);
            messageContainer.scrollTop = messageContainer.scrollHeight;
        }

        localStorage.setItem(
            "chatState",
            JSON.stringify({ channels, messages })
        );
    }

    function sendMessage() {
        const text = messageInput.value.trim();
        if (!text) return;

        addMessage(text, "sent", currentChannel);
        socket.send(
            JSON.stringify({
                type: "message",
                content: text,
                channel: currentChannel,
            })
        );
        messageInput.value = "";
    }

    function init() {
        const savedState = JSON.parse(localStorage.getItem("chatState")) || {};
        channels = savedState.channels || channels;
        messages = savedState.messages || messages;

        sendButton.addEventListener("click", sendMessage);
        messageInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter") sendMessage();
        });

        connectWebSocket();

        window.addEventListener("beforeunload", () => {
            socket.close();
        });
    }

    return {
        init,
        addMessage,
        addChannel: (channel) => {
            if (!channels.includes(channel)) {
                channels.push(channel);
                localStorage.setItem(
                    "chatState",
                    JSON.stringify({ channels, messages })
                );
            }
        },
    };
}
