class ChatApp {
    constructor(wsUrl = "ws://localhost:8080") {
        // DOM elements
        this.messageContainer = document.getElementById("message-container");
        this.messageInput = document.getElementById("message-input");
        this.sendButton = document.getElementById("send-button");
        this.container = document.querySelector(".container");
        this.messagesPane = document.querySelector(".messages-pane");
        this.heightControlUp = document.getElementById(
            "height-control-up-button"
        );
        this.heightControlDown = document.getElementById(
            "height-control-down-button"
        );

        // State
        this.channels = ["Event", "Local"];
        this.currentChannel = "Event";
        this.messages = {};
        this.heightState = "restored";
        this.clientSecret = localStorage.getItem("clientSecret");
        this.socket = null;
        this.reconnectAttempts = 0;
        this.wsUrl = wsUrl;

        this.sendBuffer = [];
        this.keepAliveTimeout = 30000;

        // Initialize
        this.loadState();
        this.setupEventListeners();
        this.connectWebSocket();

        console.log("Starting maintenance interval...");
        setInterval(this.maintenance.bind(this), 2000);

        this.setChatHeight("restored");
    }

    loadState() {
        const savedState = JSON.parse(localStorage.getItem("chatState")) || {};
        this.messages = savedState.messages || {};
        this.channels = savedState.channels || this.channels;
        this.renderChannels();
        this.loadMessagesForChannel(this.currentChannel);
    }

    saveState() {
        localStorage.setItem(
            "chatState",
            JSON.stringify({
                channels: this.channels,
                messages: this.messages,
            })
        );
    }

    clearState() {
        localStorage.removeItem("chatState");
        this.messages = {};
        this.loadMessagesForChannel(this.currentChannel);
    }

    handleChatInput() {
        const text = this.messageInput.value.trim();
        this.sendMessage({
            type: "message",
            text,
            channel: this.currentChannel,
        });
        this.messageInput.value = "";
        this.addMessage(text, "sent", this.currentChannel);
    }

    setupEventListeners() {
        // Message sending
        this.sendButton.addEventListener("click", () => this.handleChatInput());
        this.messageInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter") this.handleChatInput();
        });

        // Height controls
        this.heightControlUp.addEventListener("click", () => {
            this.setChatHeight(
                this.heightState === "minimized" ? "restored" : "maximized"
            );
        });
        this.heightControlDown.addEventListener("click", () => {
            this.setChatHeight(
                this.heightState === "maximized" ? "restored" : "minimized"
            );
        });

        // Channel dropdown
        const dropdownButton = document.getElementById(
            "channel-dropdown-button"
        );
        const dropdownList = document.getElementById("channel-dropdown-list");

        dropdownButton.addEventListener("click", () => {
            dropdownList.classList.toggle("show");
        });

        // Close dropdown when clicking outside
        window.addEventListener("click", (event) => {
            if (
                !dropdownButton.contains(event.target) &&
                !dropdownList.contains(event.target)
            ) {
                dropdownList.classList.remove("show");
            }
        });

        // Cleanup on page unload
        window.addEventListener("beforeunload", () => {
            this.socket?.close();
        });
    }

    setChatHeight(mode) {
        this.heightState = mode;
        switch (mode) {
            case "minimized":
                this.container.style.height = "auto";
                this.messagesPane.style.display = "none";
                this.heightControlUp.style.display = "inline-block";
                this.heightControlDown.style.display = "none";
                break;
            case "restored":
                this.container.style.height = "30%";
                this.messagesPane.style.display = "flex";
                this.heightControlUp.style.display = "inline-block";
                this.heightControlDown.style.display = "inline-block";
                break;
            case "maximized":
                this.container.style.height = "98%";
                this.messagesPane.style.display = "flex";
                this.heightControlUp.style.display = "none";
                this.heightControlDown.style.display = "inline-block";
                break;
        }
    }

    connectWebSocket() {
        this.socket = new WebSocket(this.wsUrl);

        this.socket.onopen = () => {
            this.reconnectAttempts = 0;
            this.sendMessage({ type: "init", clientSecret: this.clientSecret });
        };

        this.socket.onmessage = (event) => {
            const messages = event.data.split(";");
            messages.forEach((msg) => {
                try {
                    const data = JSON.parse(msg);
                    this.handleServerMessage(data);
                } catch (error) {
                    console.error("Failed to parse message:", msg);
                }
            });
        };

        this.socket.onclose = () => {
            console.log("onclose");
            const delay = Math.min(
                1000 * Math.pow(2, this.reconnectAttempts++),
                30000
            );
            setTimeout(() => this.connectWebSocket(), delay);
        };
    }

    handleServerMessage(data) {
        console.log("Received <-", data);
        switch (data.type) {
            case "init":
                if (data.clientSecret) {
                    this.clientSecret = data.clientSecret;
                    localStorage.setItem("clientSecret", this.clientSecret);
                }
                if (data.keepAliveTimeout) {
                    this.keepAliveTimeout = data.keepAliveTimeout;
                }
                if (!data.rejoin) {
                    this.clearState();
                }
                break;
            case "message":
                this.addMessage(
                    data.content,
                    "received",
                    data.channel || "Event"
                );
                break;
            case "error":
                this.addMessage(`Error: ${data.message}`, "received", "Event");
                break;
            case "connected":
                this.addMessage(
                    `Client ${data.clientId} connected`,
                    "received",
                    "Event"
                );
                break;
            case "disconnected":
                this.addMessage(
                    `Client ${data.clientId} disconnected`,
                    "received",
                    "Event"
                );
                break;
            case "welcome":
                this.clearState();
                this.addMessage(data.message, "received", "Event");
                break;
            default:
                console.log(`Unhandled message type "${data.type}"`);
                break;
        }
    }

    sendMessage(message) {
        this.sendBuffer.push(JSON.stringify(message));
    }

    addMessage(text, type, channel) {
        if (!this.messages[channel]) {
            this.messages[channel] = [];
        }
        this.messages[channel].push({ text, type });

        if (channel === this.currentChannel) {
            const messageElement = document.createElement("div");
            messageElement.classList.add("message", type);
            messageElement.textContent = text;
            this.messageContainer.appendChild(messageElement);
            this.messageContainer.scrollTop =
                this.messageContainer.scrollHeight;
        }

        this.saveState();
    }

    renderChannels() {
        const dropdownList = document.getElementById("channel-dropdown-list");
        dropdownList.innerHTML = "";

        this.channels.forEach((channel) => {
            const channelItem = document.createElement("div");
            channelItem.textContent = channel;
            if (channel === this.currentChannel) {
                channelItem.classList.add("selected");
            }

            channelItem.addEventListener("click", () => {
                this.currentChannel = channel;
                document.getElementById("selected-channel").textContent =
                    channel;
                document
                    .querySelectorAll("#channel-dropdown-list div")
                    .forEach((item) => item.classList.remove("selected"));
                channelItem.classList.add("selected");
                this.loadMessagesForChannel(channel);
                dropdownList.classList.remove("show");
            });

            dropdownList.appendChild(channelItem);
        });
    }

    loadMessagesForChannel(channel) {
        this.messageContainer.innerHTML = "";
        const channelMessages = this.messages[channel] || [];
        channelMessages.forEach((message) => {
            const messageElement = document.createElement("div");
            messageElement.classList.add("message", message.type);
            messageElement.textContent = message.text;
            this.messageContainer.appendChild(messageElement);
        });
        this.messageContainer.scrollTop = this.messageContainer.scrollHeight;
    }

    addChannel(channel) {
        if (!this.channels.includes(channel)) {
            this.channels.push(channel);
            this.renderChannels();
            this.saveState();
        }
    }

    removeChannel(channel) {
        const index = this.channels.indexOf(channel);
        if (index !== -1) {
            this.channels.splice(index, 1);
            delete this.messages[channel];
            this.renderChannels();
            this.saveState();
        }
    }

    maintenance() {
        // Send heartbeat/ping if needed
        if (
            !this.sendBuffer.length &&
            Date.now() - (this.lastSentTime || 0) > this.keepAliveTimeout * 0.8
        ) {
            this.sendBuffer.push(JSON.stringify({ type: "ping" }));
        }

        // Flush buffered messages
        if (this.sendBuffer.length) {
            new Promise((resolve, reject) => {
                if (this.socket.readyState !== WebSocket.OPEN) {
                    reject(new Error("WebSocket not connected"));
                    return;
                }
                try {
                    const bufferedMessages = this.sendBuffer;
                    this.sendBuffer = [];
                    const sendMessages = bufferedMessages.join(";");
                    console.log("Sending server -> ", sendMessages);
                    this.socket.send(sendMessages);
                    this.lastSentTime = Date.now();
                    resolve();
                } catch (error) {
                    reject(error);
                }
            });
        }
    }
}

// Initialize the chat app when the DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
    new ChatApp();
});
