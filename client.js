// client.js
const keybindPopup = document.getElementById("keybindPopup");
const chatInput = document.getElementById("chatInput");
const messagesContainer = document.getElementById("messages");
const chatContainer = document.getElementById("chatContainer");
const sidebarButton = document.querySelector(".sidebar button");

// Client State Object
const state = {
    id_object: new Map(),
    id_children: new Map(),
    obj_current: null,
    obj_player_current: null,
    el_explorer: document.getElementById("objectExplorer"),
    el_sibling_column: document.getElementById("siblingColumn"),
    el_focus_column: document.getElementById("focusColumn"),
    el_player_sibling_column: document.getElementById("playerSiblingColumn"),
    el_player_focus_column: document.getElementById("playerFocusColumn"),
    player_id: null,
    focus_id: null,
    channel: "global",
};

setChannel(state.channel);

// Utility Functions (unchanged)
function toggleVisibility(element) {
    element.style.display = element.style.display === "block" ? "none" : "block";
}

function debounce(fn, delay) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(function () {
            fn(...args);
        }, delay);
    };
}

// Chat Functions (unchanged)
function toggleChat() {
    chatContainer.classList.toggle("hidden");
    sidebarButton.textContent = chatContainer.classList.contains("hidden") ? "❯❯" : "❮❮";
    chatInput[chatContainer.classList.contains("hidden") ? "blur" : "focus"]();
}

function sendMessage() {
    const message = chatInput.value.trim();
    if (!message) return;
    displayMessage(message, "sent", state.channel);
    worker.postMessage({ type: "chat", content: message });
    chatInput.value = "";
}

function displayMessage(text, type, channel = "global") {
    const newMessage = document.createElement("div");
    newMessage.textContent = text;
    newMessage.classList.add("message");
    newMessage.dataset.channel = channel;
    newMessage.dataset.direction = type === "sent" ? "sent" : "received";
    newMessage.style.display = channel === state.channel ? "block" : "none";
    messagesContainer.appendChild(newMessage);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function setChannel(channel) {
    state.channel = channel;
    filterMessages();
    if (chatContainer.classList.contains("hidden")) toggleChat();
    document.querySelectorAll(".channelBtn").forEach(function (btn) {
        btn.style.textShadow =
            btn.dataset.channel === state.channel ? "0 0 0 #87CEEB" : "0 0 0 white";
    });
}

function filterMessages() {
    document.querySelectorAll(".message").forEach(function (msg) {
        msg.style.display = msg.dataset.channel === state.channel ? "block" : "none";
    });
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Object Explorer Functions
function getParent(obj) {
    return state.id_object.get(obj.parent_id);
}

function formatObjectName(obj) {
    return `${obj.type} <span style="color:${getQualityColor(obj.quality)}">${obj.name}</span>`;
}

function getParentChain(obj, max = 3) {
    const chain = [];
    let current = obj;
    while (current && current.type !== "root" && chain.length < max) {
        chain.unshift(current);
        current = state.id_object.get(current.parent_id);
    }
    return chain;
}

function createBreadcrumb(endObject, max = 3) {
    if (!endObject) return " ";
    const chain = getParentChain(endObject, max);

    let breadcrumb = "";
    if (chain.length > 1 && chain[0].parent_id) {
        breadcrumb += `<span class="breadcrumb-link" data-id="${chain[0].id}">...</span> / `;
    }
    chain.slice(-1).forEach(function (obj) {
        breadcrumb += `<span class="breadcrumb-link" data-id="${obj.id}">${formatObjectName(obj)}</span> / `;
    });
    return breadcrumb;
}

function createObjectItem(obj, isSelected = false, onClickHandler) {
    const itemEl = document.createElement("div");
    itemEl.className = `object-item${isSelected ? " selected" : ""}`;

    const damageBg = document.createElement("div");
    damageBg.className = "damage-background";
    damageBg.style.width = `${(obj.damage || 0) * 100}%`;
    itemEl.appendChild(damageBg);

    const textEl = document.createElement("div");
    textEl.innerHTML = formatObjectName(obj);

    itemEl.appendChild(textEl);
    itemEl.addEventListener("click", () => onClickHandler(obj));

    return itemEl;
}

function getQualityColor(quality) {
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

    for (let i = 0; i < colorStops.length - 1; i++) {
        const current = colorStops[i];
        const next = colorStops[i + 1];
        if (quality >= current.quality && quality <= next.quality) {
            const t = (quality - current.quality) / (next.quality - current.quality);
            const h = Math.round(current.h + (next.h - current.h) * t);
            const s = Math.round(current.s + (next.s - current.s) * t);
            const l = Math.round(current.l + (next.l - current.l) * t);
            return hslToHex(h, s, l);
        }
    }
    return "";
}

function hslToHex(h, s, l) {
    s /= 100;
    l /= 100;
    let c = (1 - Math.abs(2 * l - 1)) * s;
    let x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    let m = l - c / 2;
    let r = 0,
        g = 0,
        b = 0;

    if (h >= 0 && h < 60) {
        r = c;
        g = x;
        b = 0;
    } else if (h < 120) {
        r = x;
        g = c;
        b = 0;
    } else if (h < 180) {
        r = 0;
        g = c;
        b = x;
    } else if (h < 240) {
        r = 0;
        g = x;
        b = c;
    } else if (h < 300) {
        r = x;
        g = 0;
        b = c;
    } else if (h < 360) {
        r = c;
        g = 0;
        b = x;
    }

    r = Math.round((r + m) * 255)
        .toString(16)
        .padStart(2, "0");
    g = Math.round((g + m) * 255)
        .toString(16)
        .padStart(2, "0");
    b = Math.round((b + m) * 255)
        .toString(16)
        .padStart(2, "0");
    return `#${r}${g}${b}`;
}

// Player Explorer Functions
function renderPlayerSiblingColumn(selectedId) {
    const headerEl = state.el_player_sibling_column.querySelector(".column-header");
    const contentEl = state.el_player_sibling_column.querySelector(".column-content");

    const parent = state.obj_player_current ? getParent(state.obj_player_current) : null;
    headerEl.innerHTML = parent
        ? createBreadcrumb(parent)
        : state.player_id
          ? formatObjectName(state.id_object.get(state.player_id))
          : " ";

    headerEl.querySelectorAll(".breadcrumb-link").forEach(function (link) {
        link.addEventListener("click", function () {
            setPlayerCurrentObject(state.id_object.get(link.dataset.id));
        });
    });

    contentEl.innerHTML = "";
    const parent_id = state.obj_player_current
        ? state.obj_player_current.parent_id
        : state.player_id;
    const siblings = parent_id
        ? state.id_children.get(parent_id) || []
        : state.player_id
          ? state.id_children.get(state.player_id) || []
          : [];

    siblings.forEach(function (itemId) {
        const item = state.id_object.get(itemId);
        const itemEl = createObjectItem(
            item,
            itemId === selectedId,
            setPlayerCurrentObject
        );
        contentEl.appendChild(itemEl);
    });
}

function renderPlayerFocusColumn() {
    const headerEl = state.el_player_focus_column.querySelector(".column-header");
    const contentEl = state.el_player_focus_column.querySelector(".column-content");

    headerEl.innerHTML = state.obj_player_current
        ? formatObjectName(state.obj_player_current)
        : " ";
    contentEl.innerHTML = "";

    const infoArea = document.createElement("div");
    infoArea.className = "object-info-area";

    if (state.obj_player_current) {
        infoArea.innerHTML = `
            <div class="object-property"><span>ID:</span> ${state.obj_player_current.id}</div>
            <div class="object-property"><span>Type:</span> ${state.obj_player_current.type}</div>
            <div class="object-property"><span>Quality:</span> ${state.obj_player_current.quality || 0}</div>
            <div class="object-property"><span>Damage:</span> ${state.obj_player_current.damage || 0}</div>
            <div class="object-property"><span>Weight:</span> ${state.obj_player_current.weight || 0}</div>
        `;
    }

    contentEl.appendChild(infoArea);

    const childrenArea = document.createElement("div");
    childrenArea.className = "children-area";
    contentEl.appendChild(childrenArea);

    if (state.obj_player_current) {
        const children = state.id_children.get(state.obj_player_current.id) || [];
        children.forEach(function (childId) {
            const child = state.id_object.get(childId);
            const childEl = createObjectItem(child, false, setPlayerCurrentObject);
            childrenArea.appendChild(childEl);
        });
    }
}

const updatePlayerView = debounce(function () {
    if (state.obj_player_current || state.player_id) {
        renderPlayerSiblingColumn(
            state.obj_player_current ? state.obj_player_current.id : null
        );
        renderPlayerFocusColumn();
    } else {
        state.el_player_sibling_column.querySelector(".column-header").innerHTML = " ";
        state.el_player_sibling_column.querySelector(".column-content").innerHTML = "";
        state.el_player_focus_column.querySelector(".column-header").innerHTML = " ";
        state.el_player_focus_column.querySelector(".column-content").innerHTML = "";
    }
}, 50);

function setPlayerCurrentObject(obj) {
    if (!obj || obj.id === state.player_current?.id) {
        updatePlayerView();
        return;
    }

    // Restrict obj_player_current to the player object (body) or its children
    const playerBody = state.id_object.get(state.player_id);
    if (!playerBody) return;

    let current = obj;
    let isAtOrBelowBody = false;
    while (current) {
        if (current.id === playerBody.id) {
            isAtOrBelowBody = true; // Object is the player body or a descendant
            break;
        }
        current = state.id_object.get(current.parent_id);
    }

    if (!isAtOrBelowBody) {
        console.log(
            `Cannot set obj_player_current to ${obj.id}: not at or below player body ${state.player_id}`
        );
        return;
    }

    console.log(`Setting obj_player_current: ${obj.id}`);
    state.obj_player_current = obj;
    updatePlayerView();
}

// Object Explorer Functions (continued)
function renderSiblingColumn(selectedId) {
    const headerEl = state.el_sibling_column.querySelector(".column-header");
    const contentEl = state.el_sibling_column.querySelector(".column-content");

    const parent = state.obj_current ? getParent(state.obj_current) : null;
    headerEl.innerHTML = parent ? createBreadcrumb(parent) : " ";

    headerEl.querySelectorAll(".breadcrumb-link").forEach(function (link) {
        link.addEventListener("click", function () {
            setCurrentObject(state.id_object.get(link.dataset.id));
        });
    });

    contentEl.innerHTML = "";
    const parent_id = state.obj_current ? state.obj_current.parent_id : null;
    const siblings = parent_id ? state.id_children.get(parent_id) || [] : [];

    siblings.forEach(function (itemId) {
        const item = state.id_object.get(itemId);
        const itemEl = createObjectItem(item, itemId === selectedId, setCurrentObject);
        contentEl.appendChild(itemEl);
    });
}

function renderFocusColumn() {
    const headerEl = state.el_focus_column.querySelector(".column-header");
    const contentEl = state.el_focus_column.querySelector(".column-content");

    headerEl.innerHTML = state.obj_current ? formatObjectName(state.obj_current) : " ";
    contentEl.innerHTML = "";

    const infoArea = document.createElement("div");
    infoArea.className = "object-info-area";

    if (state.obj_current) {
        infoArea.innerHTML = `
            <div class="object-property"><span>ID:</span> ${state.obj_current.id}</div>
            <div class="object-property"><span>Type:</span> ${state.obj_current.type}</div>
            <div class="object-property"><span>Quality:</span> ${state.obj_current.quality || 0}</div>
            <div class="object-property"><span>Damage:</span> ${state.obj_current.damage || 0}</div>
            <div class="object-property"><span>Weight:</span> ${state.obj_current.weight || 0}</div>
        `;
    }

    contentEl.appendChild(infoArea);

    const childrenArea = document.createElement("div");
    childrenArea.className = "children-area";
    contentEl.appendChild(childrenArea);

    if (state.obj_current) {
        const children = state.id_children.get(state.obj_current.id) || [];
        children.forEach(function (childId) {
            const child = state.id_object.get(childId);
            const childEl = createObjectItem(child, false, setCurrentObject);
            childrenArea.appendChild(childEl);
        });
    }
}

const updateView = debounce(function () {
    if (state.obj_current) {
        renderSiblingColumn(state.obj_current.id);
        renderFocusColumn();
    } else {
        state.el_sibling_column.querySelector(".column-header").innerHTML = " ";
        state.el_sibling_column.querySelector(".column-content").innerHTML = "";
        state.el_focus_column.querySelector(".column-header").innerHTML = " ";
        state.el_focus_column.querySelector(".column-content").innerHTML = "";
    }
    updatePlayerView();
}, 50);

function setCurrentObject(obj) {
    if (obj === state.obj_current) {
        updateView();
        return;
    }

    console.log(`Setting obj_current: ${obj?.id}`);
    state.obj_current = obj;
    updateView();
}

function isObjectVisible(objId, isPlayerExplorer = false) {
    const current = isPlayerExplorer ? state.obj_player_current : state.obj_current;
    if (!current) return false;

    const obj = state.id_object.get(objId);
    if (!obj) return false;

    if (objId === current.id) return true;
    if (obj.parent_id === current.id) return true;
    if (current.parent_id === objId) return true;
    if (state.id_children.get(current.id)?.includes(objId)) return true;

    const parent = getParent(current);
    if (parent && parent.parent_id === objId) return true;

    return false;
}

function processObject(snapshot) {
    const parts = snapshot.o.split(";");
    let obj = state.id_object.get(parts[1]) || { id: parts[1] };

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
        if (state.id_children.has(obj.parent_id)) {
            const oldSiblings = state.id_children.get(obj.parent_id);
            const index = oldSiblings.indexOf(obj.id);
            if (index > -1) oldSiblings.splice(index, 1);
        }
        obj.parent_id = parts[0];
        state.id_children.set(
            obj.parent_id,
            (state.id_children.get(obj.parent_id) || []).concat(obj.id)
        );
    }

    state.id_object.set(obj.id, obj);

    if (!state.obj_current && state.focus_id === obj.id) {
        setCurrentObject(obj);
    } else if (state.obj_current && isObjectVisible(obj.id, false)) {
        updateView();
    }

    if (state.player_id === obj.parent_id && !state.obj_player_current) {
        setPlayerCurrentObject(obj);
    } else if (state.obj_player_current && isObjectVisible(obj.id, true)) {
        updatePlayerView();
    }
}

function handleKeyDown(e) {
    if (e.target instanceof HTMLInputElement) return;

    // Handle objectExplorer navigation
    const parent_id = state.obj_current ? state.obj_current.parent_id : null;
    const siblings = parent_id ? state.id_children.get(parent_id) || [] : [];
    const currentSiblingIndex = state.obj_current
        ? siblings.indexOf(state.obj_current.id)
        : -1;

    let nextId;
    switch (e.key.toLowerCase()) {
        case "j":
        case "arrowdown":
            if (currentSiblingIndex < siblings.length - 1) {
                nextId = siblings[currentSiblingIndex + 1];
                setCurrentObject(state.id_object.get(nextId));
            }
            break;
        case "k":
        case "arrowup":
            if (currentSiblingIndex > 0) {
                nextId = siblings[currentSiblingIndex - 1];
                setCurrentObject(state.id_object.get(nextId));
            }
            break;
        case "l":
        case "arrowright":
            const children = state.obj_current
                ? state.id_children.get(state.obj_current.id) || []
                : [];
            if (children.length > 0) {
                nextId = children[0];
                setCurrentObject(state.id_object.get(nextId));
            }
            break;
        case "h":
        case "arrowleft":
            if (state.obj_current) {
                nextId = getParent(state.obj_current)?.id;
                if (nextId) setCurrentObject(state.id_object.get(nextId));
            }
            break;
    }

    if (nextId) e.preventDefault();
}

function toggleExplorer() {
    state.el_explorer.classList.toggle("hidden");
}

function resetClientState() {
    state.id_object.clear();
    state.id_children.clear();
    state.obj_current = null;
    state.obj_player_current = null;
    state.channel = "global";
    updateView();
}

document.addEventListener("keydown", function (e) {
    if (e.ctrlKey && e.key === "I") {
        toggleVisibility(keybindPopup);
        e.preventDefault();
    } else if (e.ctrlKey && e.key === "Enter") {
        toggleChat();
        e.preventDefault();
    }
});

chatInput.addEventListener("keydown", function (e) {
    if (!e.ctrlKey && e.key === "Enter") sendMessage();
});

document.getElementById("toggleChatBtn").addEventListener("click", toggleChat);

document.querySelectorAll(".channelBtn").forEach(function (btn) {
    btn.addEventListener("click", function () {
        setChannel(btn.dataset.channel);
    });
});

document.addEventListener("keydown", handleKeyDown);

// Initialize
const worker = new Worker("worker.js");

worker.onmessage = function ({ data }) {
    console.log("Received <-", data);
    if (data.type)
        return worker.dispatchEvent(new CustomEvent(data.type, { detail: data }));
    processObject(data);
};

worker.addEventListener("init", function (e) {
    const { clientId, clientSecret, keepAliveTimeout, isRejoin, player_id } = e.detail;
    if (clientSecret) localStorage.setItem("clientSecret", clientSecret);
    if (player_id) {
        state.player_id = player_id;
        state.focus_id = player_id;
        if (!state.obj_current && state.id_object.has(player_id)) {
            setCurrentObject(state.id_object.get(player_id));
        }
        if (!state.obj_player_current) {
            const player_children = state.id_children.get(player_id) || [];
            if (player_children.length)
                setPlayerCurrentObject(state.id_object.get(player_children[0]));
        }
    }
});

worker.addEventListener("offline", function (e) {
    const { message } = e.detail;
    displayMessage(message, "received", "global");
    resetClientState();
});

worker.addEventListener("chat", function (e) {
    const { content, channel } = e.detail;
    displayMessage(content, "received", channel);
});

displayMessage("Connecting to server...", "system", "global");
worker.postMessage({
    type: "connect",
    url: "ws://localhost:8080",
    clientSecret: localStorage.getItem("clientSecret"),
});
