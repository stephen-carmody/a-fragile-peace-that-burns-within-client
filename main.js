class ChatApp {
    constructor(wsUrl = "ws://localhost:8080") {
        // DOM elements
        this.messageContainer = document.getElementById("message-container");
        this.channelsTabs = document.querySelector(".channels-tabs");
        this.popup = document.getElementById("message-popup");
        this.messageInput = document.getElementById("message-input");

        // State
        this.channels = ["Event", "Local"];
        this.currentChannel = "Event";
        this.messages = {};

        // Initialize
        this.renderChannels();
        this.loadMessagesForChannel(this.currentChannel);
        this.setupEventListeners();
    }

    renderChannels() {
        this.channelsTabs.innerHTML = "";
        this.channels.forEach((channel) => {
            const tab = document.createElement("div");
            tab.classList.add("tab");
            if (channel === this.currentChannel) {
                tab.classList.add("selected");
            }
            tab.textContent = channel;
            tab.addEventListener("click", () => {
                this.currentChannel = channel;
                this.renderChannels();
                this.loadMessagesForChannel(channel);
            });
            this.channelsTabs.appendChild(tab);
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
    }

    setupEventListeners() {
        // Handle Ctrl+Space to show popup
        document.addEventListener("keydown", (e) => {
            if (e.ctrlKey && e.code === "Space") {
                e.preventDefault();
                this.popup.style.display = "block";
                this.messageInput.focus();
            }
        });

        // Handle sending message
        this.messageInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter") {
                const text = this.messageInput.value.trim();
                if (text) {
                    this.addMessage(text, "sent", this.currentChannel);
                    this.messageInput.value = "";
                    this.popup.style.display = "none";
                }
            }
        });

        // Close popup when clicking outside
        document.addEventListener("click", (e) => {
            if (!this.popup.contains(e.target)) {
                this.popup.style.display = "none";
            }
        });
    }
}

// Initialize the chat app when the DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
    new ChatApp();
});
