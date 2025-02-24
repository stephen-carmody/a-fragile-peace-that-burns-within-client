const keybindPopup = document.getElementById("keybindPopup");
const chatInput = document.getElementById("chatInput");
const messagesContainer = document.getElementById("messages");
const chatContainer = document.getElementById("chatContainer");
const sidebarButton = document.querySelector(".sidebar button");

let currentChannel = "global";
setChannel(currentChannel);

// Event Listeners
document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.key === "I") {
        toggleVisibility(keybindPopup);
        e.preventDefault();
    } else if (e.ctrlKey && e.key === "Enter") toggleChat();
});

chatInput.addEventListener("keydown", ({ key, ctrlKey }) => {
    if (!ctrlKey && key === "Enter") sendMessage();
});

document.getElementById("toggleChatBtn").addEventListener("click", () => toggleChat());

document.querySelectorAll(".channelBtn").forEach((btn) => {
    btn.addEventListener("click", () => setChannel(btn.dataset.channel));
});

function toggleVisibility(element) {
    element.style.display = element.style.display === "block" ? "none" : "block";
}

function toggleChat() {
    chatContainer.classList.toggle("hidden");
    sidebarButton.textContent = chatContainer.classList.contains("hidden") ? "❯❯" : "❮❮";
    chatInput[chatContainer.classList.contains("hidden") ? "blur" : "focus"]();
}

function sendMessage() {
    const message = chatInput.value.trim();
    if (!message) return;
    displayMessage(message, "sent", currentChannel);
    worker.postMessage({ type: "chat", content: message });
    chatInput.value = "";
}

function displayMessage(text, type, channel) {
    const newMessage = document.createElement("div");
    newMessage.textContent = text;
    newMessage.classList.add("message");
    newMessage.dataset.channel = channel;
    newMessage.dataset.direction = type === "sent" ? "sent" : "received";
    newMessage.style.display = channel === currentChannel ? "block" : "none";
    messagesContainer.appendChild(newMessage);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function setChannel(channel) {
    currentChannel = channel;
    filterMessages();
    if (chatContainer.classList.contains("hidden")) toggleChat();
    document.querySelectorAll(".channelBtn").forEach((btn) => {
        btn.style.textShadow =
            btn.dataset.channel === channel ? "0 0 0 #87CEEB" : "0 0 0 white";
    });
}

function filterMessages() {
    document.querySelectorAll(".message").forEach((msg) => {
        msg.style.display = msg.dataset.channel === currentChannel ? "block" : "none";
    });
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function debounce(fn, delay) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn(...args), delay);
    };
}

class ObjectExplorer {
    constructor() {
        this.objects = new Map();
        this.id_children = new Map();
        this.currentObject = null;

        // Cache DOM elements
        this.explorerElement = document.getElementById("objectExplorer");
        this.parentColumn = document.getElementById("parentColumn");
        this.currentColumn = document.getElementById("currentColumn");

        // Bind methods
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.processObject = this.processObject.bind(this);
        this.updateView = debounce(this.updateView.bind(this), 50);

        // Add keyboard event listener
        document.addEventListener("keydown", this.handleKeyDown);
    }

    setCurrentObject(obj) {
        this.currentObject = obj;
        this.updateView();
    }

    getParent(obj) {
        if (this.objects.has(obj.parent_id)) return this.objects.get(obj.parent_id);
    }

    formatObjectName(obj) {
        return `${obj.type} ${obj.name}`;
    }

    processObject(snapshot) {
        const parts = snapshot.o.split(";");
        let obj = this.objects.get(parts[1]);

        if (!obj) {
            obj = { id: parts[1] };
            this.objects.set(obj.id, obj);
            if (state.player_id && state.player_id === obj.id) {
                objectExplorer.setCurrentObject(obj);
            }
        }

        obj.type = parts[2];
        obj.name = parts[3];
        obj.quality = parseFloat(parts[4]);
        obj.damage = parseFloat(parts[5]);
        obj.weight = parseFloat(parts[6]);

        for (let i = 7; i < parts.length; i++) {
            const [key, value] = parts[i].split("=");
            obj[key] = isNaN(value) ? value : parseFloat(value);
        }

        if (parts[0] !== obj.parent_id) {
            if (this.id_children.has(obj.parent_id)) {
                const old_siblings = this.id_children.get(obj.parent_id);
                const index = old_siblings.indexOf(obj.id);
                if (index > -1) old_siblings.splice(index, 1);
            }
            obj.parent_id = parts[0];
            this.id_children.set(obj.parent_id, [
                ...(this.id_children.get(obj.parent_id) || []),
                obj.id,
            ]);
        }

        this.updateView();

        return obj;
    }

    getParentChain(obj) {
        const chain = [];
        let current = this.currentObject;
        while (current && chain.length < 2) {
            const parent = this.objects.get(current.parent_id);
            if (parent) {
                chain.unshift(parent);
                current = parent;
            } else {
                break;
            }
        }
        return chain;
    }

    createBreadcrumb(parent_id) {
        if (!parent_id) return "&nbsp";

        const parent = this.objects.get(parent_id);

        if (!parent) return "&nbsp";

        const chain = this.getParentChain(parent);
        let breadcrumb = "";

        if (chain.length > 0) {
            if (chain[0].parent_id) {
                breadcrumb +=
                    '<span class="breadcrumb-link" data-id="' +
                    chain[0].parent_id +
                    '">...</span> / ';
            }

            chain.forEach((obj, index) => {
                breadcrumb +=
                    '<span class="breadcrumb-link" data-id="' +
                    obj.id +
                    '">' +
                    this.formatObjectName(obj) +
                    "</span>";
                if (index < chain.length - 1) {
                    breadcrumb += " / ";
                }
            });
        }

        return breadcrumb;
    }

    handleKeyDown(e) {
        if (event.target instanceof HTMLInputElement) return false;

        const siblings = this.id_children.get(this.currentObject?.parent_id) || [];
        const currentIndex = this.currentObject
            ? siblings.findIndex((siblingId) => siblingId === this.currentObject.id)
            : -1;

        switch (e.key.toLowerCase()) {
            case "j":
            case "arrowdown":
                if (siblings.length > 0) {
                    const nextIndex =
                        currentIndex < siblings.length - 1
                            ? currentIndex + 1
                            : currentIndex;
                    const nextSibling = this.objects.get(siblings[nextIndex]);
                    if (nextSibling) this.currentObject = nextSibling;
                }
                break;
            case "k":
            case "arrowup":
                if (siblings.length > 0) {
                    const prevIndex = currentIndex > 0 ? currentIndex - 1 : 0;
                    const prevSibling = this.objects.get(siblings[prevIndex]);
                    if (prevSibling) this.currentObject = prevSibling;
                }
                break;
            case "l":
            case "arrowright":
                if (this.currentObject) {
                    const children = this.id_children.get(this.currentObject.id) || [];
                    if (children.length > 0) {
                        const firstChild = this.objects.get(children[0]);
                        if (firstChild) this.currentObject = firstChild;
                    }
                }
                break;
            case "h":
            case "arrowleft":
                const parent = this.getParent(this.currentObject);
                if (parent) this.currentObject = parent;
                break;
            default:
                return;
        }

        this.updateView();
        e.preventDefault();
    }

    renderColumn(container, itemIds, selectedId, isCurrentColumn = false) {
        const headerEl = container.querySelector(".column-header");
        const contentEl = container.querySelector(".column-content");

        // Update header
        if (container.id === "parentColumn") {
            headerEl.innerHTML = this.currentObject
                ? this.createBreadcrumb(this.currentObject.parent_id)
                : "";

            // Add click handlers for breadcrumb links
            headerEl.querySelectorAll(".breadcrumb-link").forEach((link) => {
                link.addEventListener("click", () => {
                    const targetId = link.dataset.id;
                    const targetObj = this.objects.get(targetId);
                    if (targetObj) {
                        this.currentObject = targetObj;
                        this.updateView();
                    }
                });
            });
        }

        // Update content
        contentEl.innerHTML = "";
        itemIds.forEach((itemId) => {
            const item = this.objects.get(itemId);
            const itemEl = document.createElement("div");
            itemEl.className = `object-item${itemId === selectedId ? " selected" : ""}`;
            itemEl.textContent = this.formatObjectName(item);

            itemEl.addEventListener("click", () => {
                this.currentObject = item;
                this.updateView();
            });

            contentEl.appendChild(itemEl);
        });
    }

    updateView() {
        // Update parent column
        this.renderColumn(
            this.parentColumn,
            this.currentObject
                ? this.id_children.get(this.currentObject.parent_id) || [
                      this.currentObject.id,
                  ]
                : [],
            this.currentObject?.id
        );

        // Update current column
        this.renderColumn(
            this.currentColumn,
            this.id_children.get(this.currentObject?.id) || [],
            null
        );
    }

    toggle() {
        this.explorerElement.classList.toggle("hidden");
    }
}

const state = {
    player_id: null,
};

// Initialize the explorer
const objectExplorer = new ObjectExplorer();

const worker = new Worker("worker.js");

worker.onmessage = ({ data }) => {
    console.log("Received <-", data);
    if (data.type)
        return worker.dispatchEvent(new CustomEvent(data.type, { detail: data }));
    objectExplorer.processObject(data);
};

worker.addEventListener("init", (e) => {
    const { clientId, clientSecret, keepAliveTimeout, isRejoin, player_id } = e.detail;
    if (clientSecret) localStorage.setItem("clientSecret", clientSecret);

    if (player_id) {
        state.player_id = player_id;
        const player = objectExplorer.objects.get(state.player_id);
        if (player) {
            const parent = objectExplorer.getParent(player);
            if (parent) objectExplorer.setCurrentObject(parent);
        }
    }
});

worker.addEventListener("chat", (e) => {
    const { content, channel } = e.detail;
    displayMessage(content, "received", channel);
});

displayMessage("Connecting to server...", "system", "global");

worker.postMessage({
    type: "connect",
    url: "ws://localhost:8080",
    clientSecret: localStorage.getItem("clientSecret"),
});
