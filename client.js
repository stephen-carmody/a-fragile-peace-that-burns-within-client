// client.js

// === DOM Utilities ===================
const getElement = document.getElementById.bind(document);
const elements = {
    keybindPopup: getElement("keybindPopup"),
    chatInput: getElement("chatInput"),
    messagesContainer: getElement("messages"),
    chatContainer: getElement("chatContainer"),
    chatContent: getElement("chatContent"),
    toggleChatBtn: getElement("toggleChatBtn"),
};

// === State Management ===================
const state = {
    objectsById: new Map(),
    childrenById: new Map(),
    channel: "event",
    playerId: null,
    objectTypes: new Map(),
};

const COLORSTOPS = {
    QUALITY: [
        { value: 0.0, h: 0, s: 0, l: 0 },
        { value: 0.1, h: 0, s: 0, l: 50 },
        { value: 0.2, h: 0, s: 0, l: 100 },
        { value: 0.3, h: 120, s: 100, l: 50 },
        { value: 0.4, h: 240, s: 100, l: 50 },
        { value: 0.5, h: 60, s: 100, l: 50 },
        { value: 0.7, h: 39, s: 100, l: 50 },
        { value: 0.8, h: 0, s: 100, l: 50 },
        { value: 1.0, h: 300, s: 100, l: 50 },
    ],
    DAMAGE: [
        { value: 0.0, h: 120, s: 100, l: 50 }, // Green
        { value: 0.1, h: 108, s: 100, l: 50 },
        { value: 0.2, h: 96, s: 100, l: 50 },
        { value: 0.3, h: 84, s: 100, l: 50 },
        { value: 0.4, h: 72, s: 100, l: 50 },
        { value: 0.5, h: 60, s: 100, l: 50 }, // Yellow-green
        { value: 0.6, h: 48, s: 100, l: 50 },
        { value: 0.7, h: 36, s: 100, l: 50 },
        { value: 0.8, h: 24, s: 100, l: 50 },
        { value: 0.9, h: 12, s: 100, l: 50 },
        { value: 1.0, h: 0, s: 100, l: 50 }, // Red
    ],
};

// === GameObjectExplorer Class ===================
class GameObjectExplorer {
    constructor(containerId, rootId = null, breadcrumbDepth = 0) {
        this.container = document.getElementById(containerId);
        this.currentObject = null;
        this.rootId = rootId;
        this.breadcrumbDepth = breadcrumbDepth;

        this.initUI();
        this.updateView = debounce(this.render.bind(this), 100);
    }

    initUI() {
        this.container.innerHTML = `
            <div class="explorer-content object-explorer">
                ${this.breadcrumbDepth > 0 ? '<div class="breadcrumb-area"></div>' : ""}
                <div class="explorer-columns">
                    <div class="explorer-column sibling-column">
                        <div class="column-content"></div>
                    </div>
                    <div class="explorer-column focus-column">
                        <div class="column-content"></div>
                    </div>
                </div>
            </div>
        `;

        this.breadcrumbArea = this.container.querySelector(".breadcrumb-area");
        this.siblingColumn = this.container.querySelector(".sibling-column");
        this.focusColumn = this.container.querySelector(".focus-column");
    }

    setRootId(id) {
        this.rootId = id;
        if (!this.currentObject && id) {
            // Set to first child of root instead of root itself
            const children = state.childrenById.get(id) || [];
            if (children.length > 0) {
                this.setCurrentObject(state.objectsById.get(children[0]));
            }
        }
    }

    getObjectParent(obj) {
        return state.objectsById.get(obj?.parent_id);
    }

    formatObjectLabel(obj) {
        return `${this.formatObjectType(obj)} ${this.formatObjectDamage(obj)} ${obj.name}`;
    }

    formatObjectType(obj) {
        const glyph = state.objectTypes.get(obj.type)?.glyph || "⍰";
        return `<span class="object-type" style="color:${this.getColorGradient(obj.quality, COLORSTOPS.QUALITY)}">${glyph}</span>`;
    }

    formatObjectDamage(obj) {
        let glyph = "⣿";
        if (obj.damage > 0.1) {
            glyph = "⣷";
        }
        if (obj.damage > 0.2) {
            glyph = "⣧";
        }
        if (obj.damage > 0.3) {
            glyph = "⣦";
        }
        if (obj.damage > 0.5) {
            glyph = "⣤";
        }
        if (obj.damage > 0.7) {
            glyph = "⣠";
        }
        if (obj.damage > 0.8) {
            glyph = "⣀";
        }
        if (obj.damage > 0.9) {
            glyph = "⢀";
        }
        if (obj.damage > 0.9) {
            glyph = "&nbsp;";
        }

        return `<span class="object-damage" style="color:${this.getColorGradient(obj.damage, COLORSTOPS.DAMAGE)}">${glyph}</span>`;
    }

    buildParentChain(obj, max = 3) {
        const chain = [];
        let current = obj;
        while (current && chain.length < max) {
            chain.unshift(current);
            if (this.rootId && current.id === this.rootId) {
                break;
            }
            current = this.getObjectParent(current);
        }
        return chain;
    }

    generateBreadcrumb(obj) {
        if (!obj || this.breadcrumbDepth === 0) {
            return "";
        }

        // Get chain with length of breadcrumbDepth + 1
        const chain = this.buildParentChain(obj, this.breadcrumbDepth + 1);
        if (chain.length === 0) {
            return "";
        }

        let breadcrumb = "";

        // If chain length equals breadcrumbDepth + 1, first item becomes "..."
        if (chain.length === this.breadcrumbDepth + 1) {
            breadcrumb += `<span class="breadcrumb-link" data-id="${chain[0].id}">...</span> / `;
            chain.shift(); // Remove the first item
        }

        chain.forEach((obj, index) => {
            const isWorldRoot = !obj.parent_id;
            const isRootBoundary = this.rootId && obj.id === this.rootId;
            if (isWorldRoot || isRootBoundary) {
                breadcrumb += `${this.formatObjectLabel(obj)}${index < chain.length - 1 ? " / " : ""}`;
            } else {
                breadcrumb += `<span class="breadcrumb-link" data-id="${obj.id}">${this.formatObjectLabel(obj)}</span>${index < chain.length - 1 ? " / " : ""}`;
            }
        });

        return breadcrumb;
    }

    createObjectElement(obj, isSelected = false) {
        const itemEl = document.createElement("div");
        itemEl.className = `object-item${isSelected ? " selected" : ""}`;

        const textEl = document.createElement("div");
        textEl.innerHTML = this.formatObjectLabel(obj);
        itemEl.appendChild(textEl);

        itemEl.addEventListener("click", () => this.setCurrentObject(obj));
        return itemEl;
    }

    getColorGradient = ((cache = new Map()) => {
        return (value, colorStops) => {
            if (cache.has(value)) {
                return cache.get(value);
            }
            for (let i = 0; i < colorStops.length - 1; i++) {
                const current = colorStops[i];
                const next = colorStops[i + 1];
                if (value >= current.value && value <= next.value) {
                    const t = (value - current.value) / (next.value - current.value);
                    const h = Math.round(current.h + (next.h - current.h) * t);
                    const s = Math.round(current.s + (next.s - current.s) * t);
                    const l = Math.round(current.l + (next.l - current.l) * t);
                    const result = hslToHex(h, s, l);
                    cache.set(value, result);
                    return result;
                }
            }
            cache.set(value, "");
            return "";
        };
    })();

    renderSiblingList() {
        const contentEl = this.siblingColumn.querySelector(".column-content");
        const parent = this.currentObject ? this.getObjectParent(this.currentObject) : null;

        contentEl.innerHTML = "";
        const parentId = this.currentObject ? this.currentObject.parent_id : this.rootId;
        const siblings = parentId ? state.childrenById.get(parentId) || [] : [];

        if (parent && parentId !== this.rootId) {
            const parentEl = this.createObjectElement(parent, false);
            contentEl.appendChild(parentEl);
        }

        siblings.forEach((itemId) => {
            const item = state.objectsById.get(itemId);
            const itemEl = this.createObjectElement(item, itemId === this.currentObject?.id);
            contentEl.appendChild(itemEl);
        });
    }

    renderFocusDetails() {
        const contentEl = this.focusColumn.querySelector(".column-content");

        contentEl.innerHTML = "";

        const glyph = state.objectTypes.get(this.currentObject.type)?.glyph || "⍰";
        const glyphBackground = document.createElement("div");
        glyphBackground.className = "object-focus-background";
        glyphBackground.textContent = glyph;
        contentEl.appendChild(glyphBackground);

        const infoArea = document.createElement("div");
        infoArea.className = "object-info-area";
        if (this.currentObject) {
            infoArea.innerHTML = `
                <div class="object-property"><span>ID:</span> ${this.currentObject.id}</div>
                <div class="object-property"><span>Type:</span> ${this.currentObject.type}</div>
                <div class="object-property"><span>Quality:</span> ${this.currentObject.quality || 0}</div>
                <div class="object-property"><span>Damage:</span> ${this.currentObject.damage || 0}</div>
                <div class="object-property"><span>Weight:</span> ${this.currentObject.weight || 0}</div>
            `;
        }
        contentEl.appendChild(infoArea);

        const childrenArea = document.createElement("div");
        childrenArea.className = "children-area";
        contentEl.appendChild(childrenArea);

        if (this.currentObject) {
            const children = state.childrenById.get(this.currentObject.id) || [];
            children.forEach((childId) => {
                const child = state.objectsById.get(childId);
                const childEl = this.createObjectElement(child, false);
                childrenArea.appendChild(childEl);
            });
        }
    }

    render() {
        if (!this.currentObject && !this.rootId) {
            this.clear();
        } else {
            if (this.breadcrumbDepth > 0 && this.breadcrumbArea) {
                this.breadcrumbArea.innerHTML = this.generateBreadcrumb(this.currentObject);
                this.breadcrumbArea.querySelectorAll(".breadcrumb-link").forEach((link) => {
                    link.addEventListener("click", () =>
                        this.setCurrentObject(state.objectsById.get(link.dataset.id))
                    );
                });
            }
            this.renderSiblingList();
            this.renderFocusDetails();
        }
    }

    clear() {
        if (this.breadcrumbArea) {
            this.breadcrumbArea.innerHTML = "";
        }
        this.siblingColumn.querySelector(".column-content").innerHTML = "";
        this.focusColumn.querySelector(".column-content").innerHTML = "";
    }

    isDescendant(target, ancestorId) {
        for (let curr = target; curr; curr = state.objectsById.get(curr.parent_id)) {
            if (curr.id === ancestorId) {
                return true;
            }
        }
        return false;
    }

    setCurrentObject(obj) {
        if (!obj || obj === this.currentObject) {
            this.updateView();
            return;
        }

        // Prevent setting currentObject to rootId or anything outside the root boundary
        if (this.rootId) {
            if (obj.id === this.rootId || !this.isDescendant(obj, this.rootId)) {
                return;
            }
        }

        this.currentObject = obj;
        this.updateView();
    }

    handleNavigationKeyDown(e) {
        if (e.target instanceof HTMLInputElement) {
            return;
        }

        const siblings = state.childrenById.get(this.currentObject?.parent_id) || [];
        const keyMap = {
            j: siblings[siblings.indexOf(this.currentObject?.id) + 1],
            arrowdown: siblings[siblings.indexOf(this.currentObject?.id) + 1],
            k: siblings[siblings.indexOf(this.currentObject?.id) - 1],
            arrowup: siblings[siblings.indexOf(this.currentObject?.id) - 1],
            l: (state.childrenById.get(this.currentObject?.id) || [])[0],
            arrowright: (state.childrenById.get(this.currentObject?.id) || [])[0],
            h: this.getObjectParent(this.currentObject)?.id,
            arrowleft: this.getObjectParent(this.currentObject)?.id,
        };

        const nextId = keyMap[e.key.toLowerCase()];
        if (nextId) {
            this.setCurrentObject(state.objectsById.get(nextId));
            e.preventDefault();
        }
    }
}

// === Utility Functions ===================
function toggleElementVisibility(element) {
    element.style.display = element.style.display === "block" ? "none" : "block";
}

function debounce(fn, delay) {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn(...args), delay);
    };
}

const hslToHex = ((cache = new Map()) => {
    return function memoizedHslToHex(h, s, l) {
        const key = `${h},${s},${l}`;
        if (cache.has(key)) {
            return cache.get(key);
        }
        s /= 100;
        l /= 100;
        const a = s * Math.min(l, 1 - l);
        const f = (n) => {
            const k = (n + h / 30) % 12;
            const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
            return Math.round(255 * color)
                .toString(16)
                .padStart(2, "0");
        };
        const result = `#${f(0)}${f(8)}${f(4)}`;
        cache.set(key, result);
        return result;
    };
})();

// === Chat Module ===================
function toggleChatVisibility() {
    const chatContent = elements.chatContent;
    const isHidden = chatContent.classList.contains("hidden");

    if (isHidden) {
        // Show chat: slide up
        chatContent.classList.remove("hidden");
        elements.toggleChatBtn.textContent = "﹀";
        elements.chatInput.focus();
    } else {
        // Hide chat: slide down
        chatContent.classList.add("hidden");
        elements.toggleChatBtn.textContent = "︿";
        elements.chatInput.blur();
    }
}

function sendChatMessage() {
    const message = elements.chatInput.value.trim();
    if (!message) {
        return;
    }
    displayChatMessage(message, "sent", state.channel);
    worker.postMessage({ type: "chat", content: message });
    elements.chatInput.value = "";
}

function createChannelTab(channel) {
    const tabsContainer = document.querySelector(".chat-tabs");
    const existingTab = tabsContainer.querySelector(`.tab-btn[data-channel="${channel}"]`);
    if (existingTab) {
        return; // Tab already exists
    }

    const tabBtn = document.createElement("button");
    tabBtn.className = "tab-btn";
    tabBtn.dataset.channel = channel;
    tabBtn.textContent = channel.charAt(0).toUpperCase() + channel.slice(1); // Capitalize first letter
    tabBtn.addEventListener("click", () => setChatChannel(channel));
    tabsContainer.insertBefore(tabBtn, elements.toggleChatBtn);
}

function displayChatMessage(text, direction = "received", channel = "event") {
    // Create tab if channel doesn't exist
    createChannelTab(channel);

    const el = document.createElement("div");
    el.textContent = text;
    el.classList.add("message");
    el.dataset.channel = channel;
    el.dataset.direction = direction;
    el.style.display = channel === state.channel ? "block" : "none";
    elements.messagesContainer.appendChild(el);
    elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
}

function setChatChannel(channel) {
    state.channel = channel;
    filterChatMessages();
    if (elements.chatContainer.classList.contains("hidden")) {
        toggleChatVisibility();
    }
    document.querySelectorAll(".tab-btn").forEach((btn) => {
        console.log(`${btn.dataset.channel} === ${state.channel}`);
        btn.classList.toggle("active", btn.dataset.channel === state.channel);
    });
}

function filterChatMessages() {
    document.querySelectorAll(".message").forEach((msg) => {
        msg.style.display = msg.dataset.channel === state.channel ? "block" : "none";
    });
    elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
}

// === Explorer Instances ===================
const worldExplorer = new GameObjectExplorer("worldExplorerContainer", null, 3);
const playerExplorer = new GameObjectExplorer("playerExplorerContainer", null, 2);

// === Worker Communication ===================
const worker = new Worker("worker.js");

worker.onmessage = ({ data }) => {
    console.log("Received <-", data);
    if (data.type) {
        worker.dispatchEvent(new CustomEvent(data.type, { detail: data }));
    } else {
        processObjectUpdate(data);
    }
};

function processObjectUpdate(snapshot) {
    const parts = snapshot.o.split(";");
    const obj = Object.assign(state.objectsById.get(parts[1]) || { id: parts[1] }, {
        type: parts[2],
        ...Object.fromEntries(
            parts.slice(3).map((p) => {
                const [k, v] = p.split("=");
                return [k, isNaN(v) ? v : parseFloat(v)];
            })
        ),
    });

    if (parts[0] !== obj.parent_id) {
        state.childrenById
            .get(obj.parent_id)
            ?.splice(state.childrenById.get(obj.parent_id)?.indexOf(obj.id), 1);
        obj.parent_id = parts[0];
        state.childrenById.set(
            obj.parent_id,
            (state.childrenById.get(obj.parent_id) || []).concat(obj.id)
        );
    }

    state.objectsById.set(obj.id, obj);

    // Update objectTypes if object is a type and skip explorer checks
    console.log(`obj.type = "${obj.type}"`);
    if (obj.type === "type") {
        state.objectTypes.set(obj.name, obj);
        console.log(`objectTypes["${obj.name}"] = `, obj);
        return;
    }

    // Update explorers if object is visible
    if (obj.type === "world") {
        worldExplorer.setRootId(obj.id);
    }
    if (!worldExplorer.currentObject) {
        worldExplorer.setCurrentObject(obj);
    } else if (isObjectVisible(obj, worldExplorer)) {
        worldExplorer.updateView();
    }

    if (state.playerId === obj.parent_id && !playerExplorer.currentObject) {
        playerExplorer.setCurrentObject(obj);
    } else if (isObjectVisible(obj, playerExplorer)) {
        playerExplorer.updateView();
    }
}

function removeObject(objectId) {
    const obj = state.objectsById.get(objectId);
    if (!obj) {
        return;
    }

    // Recursively remove all descendants first
    const children = state.childrenById.get(objectId) || [];
    const childrenToRemove = [...children];
    childrenToRemove.forEach((childId) => {
        removeObject(childId);
    });

    // Remove from parent's children array
    const parentId = obj.parent_id;
    if (parentId && state.childrenById.has(parentId)) {
        const siblings = state.childrenById.get(parentId);
        const index = siblings.indexOf(objectId);
        if (index !== -1) {
            siblings.splice(index, 1);
        }
        if (siblings.length === 0) {
            state.childrenById.delete(parentId);
        }
    }

    // Remove from objects map
    state.objectsById.delete(objectId);

    // Remove from children map (should be empty by now due to recursive removal)
    state.childrenById.delete(objectId);

    // Update explorers if the removed object was visible
    if (worldExplorer.currentObject?.id === objectId) {
        const parent = state.objectsById.get(obj.parent_id);
        const siblings = state.childrenById.get(obj.parent_id) || [];
        worldExplorer.setCurrentObject(siblings[0] ? state.objectsById.get(siblings[0]) : parent);
    } else if (isObjectVisible(obj, worldExplorer)) {
        worldExplorer.updateView();
    }

    if (playerExplorer.currentObject?.id === objectId) {
        const parent = state.objectsById.get(obj.parent_id);
        const siblings = state.childrenById.get(obj.parent_id) || [];
        playerExplorer.setCurrentObject(siblings[0] ? state.objectsById.get(siblings[0]) : parent);
    } else if (isObjectVisible(obj, playerExplorer)) {
        playerExplorer.updateView();
    }
}

function isObjectVisible(obj, explorer) {
    const current = explorer.currentObject;
    if (!current) {
        return false;
    }

    return (
        obj.id === current.id || obj.parent_id === current.id || obj.parent_id === current.parent_id
    );
}

// === Event Listeners ===================
document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.key === "I") {
        toggleElementVisibility(elements.keybindPopup);
        e.preventDefault();
    } else if (e.ctrlKey && e.key === "Enter") {
        toggleChatVisibility();
        e.preventDefault();
    } else {
        if (document.activeElement === elements.chatInput) {
            return;
        }
        worldExplorer.handleNavigationKeyDown(e);
        playerExplorer.handleNavigationKeyDown(e);
    }
});

elements.chatInput.addEventListener("keydown", (e) => {
    if (!e.ctrlKey && e.key === "Enter") {
        sendChatMessage();
    }
});

elements.toggleChatBtn.addEventListener("click", toggleChatVisibility);

document.querySelectorAll(".tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => setChatChannel(btn.dataset.channel));
});

worker.addEventListener("connected", ({ detail }) => {
    const { clientId, clientSecret, playerId, welcomeMessage } = detail;
    if (clientSecret) {
        localStorage.setItem("clientSecret", clientSecret);
    }
    if (playerId) {
        state.playerId = playerId;
        playerExplorer.setRootId(playerId);
        if (!worldExplorer.currentObject && state.objectsById.has(playerId)) {
            // Set to a child of playerId if available
            const children = state.childrenById.get(playerId) || [];
            if (children.length > 0) {
                worldExplorer.setCurrentObject(state.objectsById.get(children[0]));
            } else {
                worldExplorer.setCurrentObject(state.objectsById.get(playerId));
            }
        }
    }
    displayChatMessage("Connected.");
    displayChatMessage(welcomeMessage);
});

worker.addEventListener("offline", ({ detail }) => {
    displayChatMessage(detail.message);
    worldExplorer.clear();
    playerExplorer.clear();
});

worker.addEventListener("chat", ({ detail }) => {
    displayChatMessage(detail.content, "received", detail.channel);
});

worker.addEventListener("disconnected", ({ detail }) => {
    const { id } = detail;

    // Get the disconnected player object before removal
    const disconnectedPlayer = state.objectsById.get(id);
    if (!disconnectedPlayer) {
        return;
    }

    // Add message to chat
    displayChatMessage(`${disconnectedPlayer.name} disconnected.`);

    // Remove from game state including all descendants
    removeObject(id);
});

// === Initialization ===================
displayChatMessage("Connecting to server...");
setChatChannel(state.channel);

worker.postMessage({
    type: "connect",
    url: "ws://localhost:8080",
    clientSecret: localStorage.getItem("clientSecret"),
});
