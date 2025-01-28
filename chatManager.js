export function createChatManager() {
    const channelList = document.getElementById("channel-list");
    const messageContainer = document.getElementById("message-container");
    const messageInput = document.getElementById("message-input");
    const sendButton = document.getElementById("send-button");
    const minimizeButton = document.getElementById("minimize-button");
    const restoreButton = document.getElementById("restore-button");
    const maximizeButton = document.getElementById("maximize-button");
    const container = document.querySelector(".container");
    const bottomPane = document.querySelector(".bottom-pane");

    let channels = []; // Channels will be loaded from localStorage or initialized later
    let currentChannel = null; // Current channel will be set after initialization
    let messages = {}; // Object to store messages by channel: { channelName: [messages] }

    // Initialize the chat manager
    function init(initialChannels = [], initialHeight = "restored") {
        // Load channels and messages from localStorage
        loadStateFromLocalStorage();

        // If no channels are loaded from localStorage, use the provided initialChannels
        if (channels.length === 0) {
            channels = [...initialChannels];
            currentChannel = channels[0] || null;
        }

        // Initialize the UI
        loadChannels();
        setChatHeight(initialHeight);

        // Add event listeners
        sendButton.addEventListener("click", sendMessage);
        messageInput.addEventListener("keypress", (e) => {
            if (e.key === "Enter") {
                sendMessage();
            }
        });

        minimizeButton.addEventListener("click", () =>
            setChatHeight("minimized")
        );
        restoreButton.addEventListener("click", () =>
            setChatHeight("restored")
        );
        maximizeButton.addEventListener("click", () =>
            setChatHeight("maximized")
        );
    }

    /**
     * Loads channels and messages from localStorage.
     */
    function loadStateFromLocalStorage() {
        const savedState = JSON.parse(localStorage.getItem("chatState")) || {};
        channels = savedState.channels || [];
        messages = savedState.messages || {};
        currentChannel = channels[0] || null;
    }

    /**
     * Saves channels and messages to localStorage.
     */
    function saveStateToLocalStorage() {
        const state = {
            channels,
            messages,
        };
        localStorage.setItem("chatState", JSON.stringify(state));
    }

    /**
     * Clears the preserved state in localStorage.
     */
    function clearStateFromLocalStorage() {
        localStorage.removeItem("chatState");
        channels = [];
        messages = {};
        currentChannel = null;
    }

    /**
     * Loads channels into the UI.
     */
    function loadChannels() {
        channelList.innerHTML = ""; // Clear existing channels
        channels.forEach((channel) => {
            addChannelToList(channel);
        });

        // Load messages for the current channel
        if (currentChannel) {
            loadMessagesForChannel(currentChannel);
        }
    }

    /**
     * Adds a channel to the UI and updates localStorage.
     * @param {string} channel - The channel name.
     */
    function addChannelToList(channel) {
        const li = document.createElement("li");
        li.textContent = channel;
        li.addEventListener("click", () => {
            // Remove 'selected' class from all channels
            document.querySelectorAll("#channel-list li").forEach((item) => {
                item.classList.remove("selected");
            });

            // Add 'selected' class to the clicked channel
            li.classList.add("selected");

            // Update the current channel and load messages
            currentChannel = channel;
            loadMessagesForChannel(channel);
        });

        // Highlight the default selected channel
        if (channel === currentChannel) {
            li.classList.add("selected");
        }

        channelList.appendChild(li);
    }

    /**
     * Loads messages for a specific channel into the UI.
     * @param {string} channel - The channel name.
     */
    function loadMessagesForChannel(channel) {
        messageContainer.innerHTML = ""; // Clear existing messages
        const channelMessages = messages[channel] || [];
        channelMessages.forEach((message) => {
            addMessageToUI(message.text, message.type, channel);
        });
        scrollToBottom();
    }

    /**
     * Sends a message and updates localStorage.
     */
    function sendMessage() {
        const messageText = messageInput.value.trim();
        if (messageText && currentChannel) {
            addMessage(messageText, "sent", currentChannel);
            messageInput.value = "";

            // Simulate receiving a response
            setTimeout(() => {
                addMessage(
                    "Thanks for your message!",
                    "received",
                    currentChannel
                );
            }, 1000);
        }
    }

    /**
     * Adds a message to the specified channel and updates localStorage.
     * @param {string} text - The message text.
     * @param {string} type - The message type ("sent" or "received").
     * @param {string} channel - The channel to add the message to.
     */
    function addMessage(text, type, channel) {
        if (!channel) {
            console.error("No channel selected.");
            return;
        }

        // Add the message to the messages object
        if (!messages[channel]) {
            messages[channel] = [];
        }
        messages[channel].push({ text, type });

        // Update the UI if the channel is currently selected
        if (channel === currentChannel) {
            addMessageToUI(text, type, channel);
        }

        // Save the updated state to localStorage
        saveStateToLocalStorage();
    }

    /**
     * Adds a message to the UI.
     * @param {string} text - The message text.
     * @param {string} type - The message type ("sent" or "received").
     * @param {string} channel - The channel to add the message to.
     */
    function addMessageToUI(text, type, channel) {
        const messageElement = document.createElement("div");
        messageElement.classList.add("message", type);
        messageElement.textContent = text;
        messageContainer.appendChild(messageElement);

        scrollToBottom();
    }

    /**
     * Scrolls the message container to the bottom.
     */
    function scrollToBottom() {
        messageContainer.scrollTop = messageContainer.scrollHeight;
    }

    /**
     * Sets the chat window height.
     * @param {string} mode - The height mode ("minimized", "restored", or "maximized").
     */
    function setChatHeight(mode) {
        switch (mode) {
            case "minimized":
                container.style.height = "50px";
                bottomPane.classList.add("hidden");
                break;
            case "restored":
                container.style.height = "30%";
                bottomPane.classList.remove("hidden");
                break;
            case "maximized":
                container.style.height = "100%";
                bottomPane.classList.remove("hidden");
                break;
        }
    }

    // Public API
    return {
        init,
        addChannel: (channel) => {
            if (!channels.includes(channel)) {
                channels.push(channel);
                addChannelToList(channel);
                saveStateToLocalStorage();
            }
        },
        removeChannel: (channel) => {
            const index = channels.indexOf(channel);
            if (index !== -1) {
                channels.splice(index, 1);
                delete messages[channel];
                loadChannels();
                saveStateToLocalStorage();
            }
        },
        addMessage,
        clearState: clearStateFromLocalStorage, // Expose clearState for use in main.js
    };
}
