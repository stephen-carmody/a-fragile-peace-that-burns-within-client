export function createChatManager() {
    const channelList = document.getElementById("channel-list");
    const messageContainer = document.getElementById("message-container");
    const messageInput = document.getElementById("message-input");
    const sendButton = document.getElementById("send-button");
    const heightControlUpButton = document.getElementById(
        "height-control-up-button"
    );
    const heightControlDownButton = document.getElementById(
        "height-control-down-button"
    );
    const container = document.querySelector(".container");
    const messagesPane = document.querySelector(".messages-pane");

    let channels = []; // Channels will be loaded from localStorage or initialized later
    let currentChannel = null; // Current channel will be set after initialization
    let messages = {}; // Object to store messages by channel: { channelName: [messages] }
    let currentHeightState = "restored"; // Track the current height state

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

        heightControlUpButton.addEventListener("click", () =>
            setChatHeight(
                currentHeightState === "minimized" ? "restored" : "maximized"
            )
        );
        heightControlDownButton.addEventListener("click", () =>
            setChatHeight(
                currentHeightState === "maximized" ? "restored" : "minimized"
            )
        );
    }

    /**
     * Sets the chat window height and updates the height control button.
     * @param {string} mode - The height mode ("minimized", "restored", or "maximized").
     */
    function setChatHeight(mode) {
        currentHeightState = mode;
        switch (mode) {
            case "minimized":
                container.style.height = "auto";
                messagesPane.style.display = "none";
                heightControlUpButton.style.display = "inline-block";
                heightControlDownButton.style.display = "none";
                break;
            case "restored":
                container.style.height = "30%";
                messagesPane.style.display = "flex";
                heightControlUpButton.style.display = "inline-block";
                heightControlDownButton.style.display = "inline-block";
                break;
            case "maximized":
                container.style.height = "98%";
                messagesPane.style.display = "flex";
                heightControlUpButton.style.display = "none";
                heightControlDownButton.style.display = "inline-block";
                break;
        }
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
        const dropdownList = document.getElementById("channel-dropdown-list");
        dropdownList.innerHTML = ""; // Clear existing channels
        channels.forEach((channel) => {
            addChannelToList(channel);
        });

        // Load messages for the current channel
        if (currentChannel) {
            loadMessagesForChannel(currentChannel);
            document.getElementById("selected-channel").textContent =
                currentChannel;
        }
    }

    /**
     * Adds a channel to the UI and updates localStorage.
     * @param {string} channel - The channel name.
     */
    function addChannelToList(channel) {
        const dropdownList = document.getElementById("channel-dropdown-list");
        const channelItem = document.createElement("div");
        channelItem.textContent = channel;
        channelItem.addEventListener("click", () => {
            // Update the selected channel
            currentChannel = channel;
            document.getElementById("selected-channel").textContent = channel;

            // Remove 'selected' class from all channels
            document
                .querySelectorAll("#channel-dropdown-list div")
                .forEach((item) => {
                    item.classList.remove("selected");
                });

            // Add 'selected' class to the clicked channel
            channelItem.classList.add("selected");

            // Load messages for the selected channel
            loadMessagesForChannel(channel);

            // Hide the dropdown
            dropdownList.classList.remove("show");
        });

        // Highlight the default selected channel
        if (channel === currentChannel) {
            channelItem.classList.add("selected");
        }

        dropdownList.appendChild(channelItem);
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
        if (!messageText || !currentChannel) return;

        addMessage(messageText, "sent", currentChannel);
        messageInput.value = "";

        // Simulate receiving a response
        setTimeout(() => {
            addMessage("Thanks for your message!", "received", currentChannel);
        }, 1000);
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

    // Add event listener to toggle the dropdown
    document
        .getElementById("channel-dropdown-button")
        .addEventListener("click", () => {
            const dropdownList = document.getElementById(
                "channel-dropdown-list"
            );
            dropdownList.classList.toggle("show");
        });

    // Close the dropdown when clicking outside
    window.addEventListener("click", (event) => {
        const dropdownButton = document.getElementById(
            "channel-dropdown-button"
        );
        const dropdownList = document.getElementById("channel-dropdown-list");
        if (
            !dropdownButton.contains(event.target) &&
            !dropdownList.contains(event.target)
        ) {
            dropdownList.classList.remove("show");
        }
    });

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
