// client.js

// === DOM Utilities ===================
const getElement = document.getElementById.bind(document);
const elements = {
    keybindPopup: getElement("keybindPopup"),
    chatInput: getElement("chatInput"),
    messagesContainer: getElement("messages"),
    chatContainer: getElement("chatContainer"),
    objectExplorer: getElement("objectExplorer"),
    siblingColumn: getElement("siblingColumn"),
    focusColumn: getElement("focusColumn"),
    playerSiblingColumn: getElement("playerSiblingColumn"),
    playerFocusColumn: getElement("playerFocusColumn"),
    toggleChatBtn: getElement("toggleChatBtn"),
    sidebarButton: document.querySelector(".sidebar button"),
};

// === State Management ===================
const state = {
    objectsById: new Map(), // All objects by ID
    childrenById: new Map(), // Children IDs by parent ID
    currentObject: null, // Current world object explorer focus
    currentPlayerObject: null, // Current player object explorer focus
    playerId: null, // This clients player object id
    focusId: null, // Object explorers focus id
    channel: "global",
};

// Initialize channel
setChatChannel(state.channel);

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

        // Return cached result if available
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

        // Cache the result
        cache.set(key, result);
        return result;
    };
})();

// === Chat Module ===================
function toggleChatVisibility() {
    const container = elements.chatContainer;
    container.classList.toggle("hidden");
    elements.sidebarButton.textContent = container.classList.contains("hidden") ? "❯❯" : "❮❮";
    elements.chatInput[container.classList.contains("hidden") ? "blur" : "focus"]();
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

function displayChatMessage(text, direction, channel = "global") {
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
    document.querySelectorAll(".channelBtn").forEach((btn) => {
        btn.style.textShadow =
            btn.dataset.channel === state.channel ? "0 0 0 #87CEEB" : "0 0 0 white";
    });
}

function filterChatMessages() {
    document.querySelectorAll(".message").forEach((msg) => {
        msg.style.display = msg.dataset.channel === state.channel ? "block" : "none";
    });
    elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
}

// === Explorer Utilities ===================
function getObjectParent(obj) {
    return state.objectsById.get(obj.parent_id);
}

function formatObjectLabel(obj) {
    return `${obj.type} <span style="color:${getQualityColor(obj.quality)}">${obj.name}</span>`;
}

function buildParentChain(obj, max = 3) {
    const chain = [];
    let current = obj;
    while (current && current.type !== "root" && chain.length < max) {
        chain.unshift(current);
        current = state.objectsById.get(current.parent_id);
    }
    return chain;
}

function generateBreadcrumb(obj, max = 3) {
    if (!obj) {
        return " ";
    }
    const chain = buildParentChain(obj, max);
    let breadcrumb = "";
    if (chain.length > 1 && chain[0].parent_id) {
        breadcrumb += `<span class="breadcrumb-link" data-id="${chain[0].id}">...</span> / `;
    }
    chain.slice(-1).forEach((obj) => {
        breadcrumb += `<span class="breadcrumb-link" data-id="${obj.id}">${formatObjectLabel(obj)}</span> / `;
    });
    return breadcrumb;
}

function createObjectElement(obj, isSelected = false, onClick) {
    const itemEl = document.createElement("div");
    itemEl.className = `object-item${isSelected ? " selected" : ""}`;

    const damageBg = document.createElement("div");
    damageBg.className = "damage-background";
    damageBg.style.width = `${(obj.damage || 0) * 100}%`;
    itemEl.appendChild(damageBg);

    const textEl = document.createElement("div");
    textEl.innerHTML = formatObjectLabel(obj);
    itemEl.appendChild(textEl);

    itemEl.addEventListener("click", () => onClick(obj));
    return itemEl;
}

const getQualityColor = ((cache = new Map()) => {
    const colorStops = [
        { quality: 0.0, h: 0, s: 0, l: 0 },
        { quality: 0.1, h: 0, s: 0, l: 50 },
        { quality: 0.2, h: 0, s: 0, l: 100 },
        { quality: 0.3, h: 120, s: 100, l: 50 },
        { quality: 0.4, h: 240, s: 100, l: 50 },
        { quality: 0.5, h: 60, s: 100, l: 50 },
        { quality: 0.7, h: 39, s: 100, l: 50 },
        { quality: 0.8, h: 0, s: 100, l: 50 },
        { quality: 1.0, h: 300, s: 100, l: 50 },
    ];

    return function memoizedGetQualityColor(quality) {
        // Return cached result if available
        if (cache.has(quality)) {
            return cache.get(quality);
        }

        for (let i = 0; i < colorStops.length - 1; i++) {
            const current = colorStops[i];
            const next = colorStops[i + 1];
            if (quality >= current.quality && quality <= next.quality) {
                const t = (quality - current.quality) / (next.quality - current.quality);
                const h = Math.round(current.h + (next.h - current.h) * t);
                const s = Math.round(current.s + (next.s - current.s) * t);
                const l = Math.round(current.l + (next.l - current.l) * t);
                const result = hslToHex(h, s, l);

                // Cache the result
                cache.set(quality, result);
                return result;
            }
        }

        // Cache and return default empty string for out-of-range values
        cache.set(quality, "");
        return "";
    };
})();

// === Object Explorer Module ===================
function renderSiblingList(selectedId, explorerType = "object") {
    const isPlayer = explorerType === "player";
    const stateKey = isPlayer ? "currentPlayerObject" : "currentObject";
    const columnEl = isPlayer ? elements.playerSiblingColumn : elements.siblingColumn;
    const headerEl = columnEl.querySelector(".column-header");
    const contentEl = columnEl.querySelector(".column-content");

    const currentObj = state[stateKey];
    const parent = currentObj ? getObjectParent(currentObj) : null;
    headerEl.innerHTML = parent
        ? generateBreadcrumb(parent)
        : isPlayer && state.playerId
          ? formatObjectLabel(state.objectsById.get(state.playerId))
          : " ";

    headerEl.querySelectorAll(".breadcrumb-link").forEach((link) => {
        link.addEventListener("click", () =>
            (isPlayer ? setPlayerCurrentObject : setCurrentObject)(
                state.objectsById.get(link.dataset.id)
            )
        );
    });

    contentEl.innerHTML = "";
    const parentId = currentObj ? currentObj.parent_id : isPlayer ? state.playerId : null;
    const siblings = parentId ? state.childrenById.get(parentId) || [] : [];

    siblings.forEach((itemId) => {
        const item = state.objectsById.get(itemId);
        const itemEl = createObjectElement(
            item,
            itemId === selectedId,
            isPlayer ? setPlayerCurrentObject : setCurrentObject
        );
        contentEl.appendChild(itemEl);
    });
}

function renderFocusDetails(explorerType = "object") {
    const isPlayer = explorerType === "player";
    const stateKey = isPlayer ? "currentPlayerObject" : "currentObject";
    const columnEl = isPlayer ? elements.playerFocusColumn : elements.focusColumn;
    const headerEl = columnEl.querySelector(".column-header");
    const contentEl = columnEl.querySelector(".column-content");

    const currentObj = state[stateKey];
    headerEl.innerHTML = currentObj ? formatObjectLabel(currentObj) : " ";
    contentEl.innerHTML = "";

    const infoArea = document.createElement("div");
    infoArea.className = "object-info-area";
    if (currentObj) {
        infoArea.innerHTML = `
            <div class="object-property"><span>ID:</span> ${currentObj.id}</div>
            <div class="object-property"><span>Type:</span> ${currentObj.type}</div>
            <div class="object-property"><span>Quality:</span> ${currentObj.quality || 0}</div>
            <div class="object-property"><span>Damage:</span> ${currentObj.damage || 0}</div>
            <div class="object-property"><span>Weight:</span> ${currentObj.weight || 0}</div>
        `;
    }
    contentEl.appendChild(infoArea);

    const childrenArea = document.createElement("div");
    childrenArea.className = "children-area";
    contentEl.appendChild(childrenArea);

    if (currentObj) {
        const children = state.childrenById.get(currentObj.id) || [];
        children.forEach((childId) => {
            const child = state.objectsById.get(childId);
            const childEl = createObjectElement(
                child,
                false,
                isPlayer ? setPlayerCurrentObject : setCurrentObject
            );
            childrenArea.appendChild(childEl);
        });
    }
}

const updateExplorerView = debounce(() => {
    if (state.currentObject) {
        renderSiblingList(state.currentObject.id, "object");
        renderFocusDetails("object");
    } else {
        clearColumn(elements.siblingColumn);
        clearColumn(elements.focusColumn);
    }
    if (state.currentPlayerObject || state.playerId) {
        renderSiblingList(state.currentPlayerObject?.id, "player");
        renderFocusDetails("player");
    } else {
        clearColumn(elements.playerSiblingColumn);
        clearColumn(elements.playerFocusColumn);
    }
}, 100);

function clearColumn(columnEl) {
    columnEl.querySelector(".column-header").innerHTML = " ";
    columnEl.querySelector(".column-content").innerHTML = "";
}

function setCurrentObject(obj) {
    if (obj === state.currentObject) {
        return updateExplorerView();
    }
    console.log(`Setting currentObject: ${obj?.id}`);
    state.currentObject = obj;
    updateExplorerView();
}

function setPlayerCurrentObject(obj) {
    if (!obj || obj.id === state.currentPlayerObject?.id) {
        return updateExplorerView();
    }

    const isDescendant = (target, ancestorId) => {
        for (let curr = target; curr; curr = state.objectsById.get(curr.parent_id)) {
            if (curr.id === ancestorId) {
                return true;
            }
        }
        return false;
    };

    if (state.playerId && isDescendant(obj, state.playerId)) {
        state.currentPlayerObject = obj;
        updateExplorerView();
    }
}

// === Event Handlers ===================
function handleNavigationKeyDown(e) {
    if (e.target instanceof HTMLInputElement) {
        return;
    }

    const current = state.currentObject;
    const siblings = state.childrenById.get(current?.parent_id) || [];
    const keyMap = {
        j: siblings[siblings.indexOf(current?.id) + 1],
        arrowdown: siblings[siblings.indexOf(current?.id) + 1],
        k: siblings[siblings.indexOf(current?.id) - 1],
        arrowup: siblings[siblings.indexOf(current?.id) - 1],
        l: (state.childrenById.get(current?.id) || [])[0],
        arrowright: (state.childrenById.get(current?.id) || [])[0],
        h: getObjectParent(current)?.id,
        arrowleft: getObjectParent(current)?.id,
    };

    const nextId = keyMap[e.key.toLowerCase()];
    if (nextId) {
        setCurrentObject(state.objectsById.get(nextId)), e.preventDefault();
    }
}

function toggleObjectExplorer() {
    elements.objectExplorer.classList.toggle("hidden");
}

function resetAppState() {
    state.objectsById.clear();
    state.childrenById.clear();
    state.currentObject = null;
    state.currentPlayerObject = null;
    state.channel = "global";
    updateExplorerView();
}

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
        name: parts[3],
        quality: parseFloat(parts[4]),
        damage: parseFloat(parts[5]),
        weight: parseFloat(parts[6]),
        ...Object.fromEntries(
            parts.slice(7).map((p) => {
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
    (!state.currentObject && state.focusId === obj.id && setCurrentObject(obj)) ||
        (state.currentObject && isObjectVisible(obj.id, false) && updateExplorerView());

    (state.playerId === obj.parent_id &&
        !state.currentPlayerObject &&
        setPlayerCurrentObject(obj)) ||
        (state.currentPlayerObject && isObjectVisible(obj.id, true) && updateExplorerView());
}

function isObjectVisible(objId, isPlayerExplorer = false) {
    const current = isPlayerExplorer ? state.currentPlayerObject : state.currentObject;
    if (!current || !state.objectsById.has(objId)) {
        return false;
    }

    return [
        current.id,
        state.objectsById.get(objId).parent_id,
        current.parent_id,
        ...(state.childrenById.get(current.id) || []),
        getObjectParent(current)?.parent_id,
    ].includes(objId);
}

// === Event Listeners ===================
document.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.key === "I") {
        toggleElementVisibility(elements.keybindPopup);
        e.preventDefault();
    } else if (e.ctrlKey && e.key === "Enter") {
        toggleChatVisibility();
        e.preventDefault();
    }
});

elements.chatInput.addEventListener("keydown", (e) => {
    if (!e.ctrlKey && e.key === "Enter") {
        sendChatMessage();
    }
});

elements.toggleChatBtn.addEventListener("click", toggleChatVisibility);

document.querySelectorAll(".channelBtn").forEach((btn) => {
    btn.addEventListener("click", () => setChatChannel(btn.dataset.channel));
});

document.addEventListener("keydown", handleNavigationKeyDown);

worker.addEventListener("init", ({ detail }) => {
    const { clientId, clientSecret, player_id } = detail;
    if (clientSecret) {
        localStorage.setItem("clientSecret", clientSecret);
    }
    if (player_id) {
        state.playerId = player_id;
        state.focusId = player_id;
        if (!state.currentObject && state.objectsById.has(player_id)) {
            setCurrentObject(state.objectsById.get(player_id));
        }
        if (!state.currentPlayerObject) {
            const playerChildren = state.childrenById.get(player_id) || [];
            if (playerChildren.length) {
                setPlayerCurrentObject(state.objectsById.get(playerChildren[0]));
            }
        }
    }
});

worker.addEventListener("offline", ({ detail }) => {
    displayChatMessage(detail.message, "received", "global");
    resetAppState();
});

worker.addEventListener("chat", ({ detail }) => {
    displayChatMessage(detail.content, "received", detail.channel);
});

// === Initialization ===================
displayChatMessage("Connecting to server...", "system", "global");
worker.postMessage({
    type: "connect",
    url: "ws://localhost:8080",
    clientSecret: localStorage.getItem("clientSecret"),
});
