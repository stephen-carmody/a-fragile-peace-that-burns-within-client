// ../a-fragile-peace-that-burns-within-client/client.js
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
    el_explorer: document.getElementById("objectExplorer"),
    el_sibling_column: document.getElementById("siblingColumn"),
    el_focus_column: document.getElementById("focusColumn"),
    has_rendered_initial_view: false,
    focused_column: "sibling",
    id_focus_selected: null,
    player_id: null,
    focus_id: null,
    channel: "global",
};

setChannel(state.channel);

// Utility Functions
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

// Chat Functions
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
    return `${obj.type} ${obj.name}`;
}

function getParentChain(obj) {
    const chain = [obj];
    let current = obj;
    while (current && current.type !== "world" && chain.length < 3) {
        const parent = state.id_object.get(current.parent_id);
        if (parent) {
            chain.unshift(parent);
            current = parent;
        } else break;
    }
    return chain;
}

function createBreadcrumb(parentId) {
    if (!parentId) return " ";
    const parent = state.id_object.get(parentId);
    if (!parent) return " ";

    const chain = getParentChain(parent);
    if (chain.length === 0) return " ";

    let breadcrumb = "";
    if (chain.length > 2 && chain[0].parent_id) {
        breadcrumb += `<span class="breadcrumb-link" data-id="${chain[0].id}">...</span> / `;
    }
    chain.slice(-2).forEach(function (obj, i) {
        breadcrumb += `<span class="breadcrumb-link" data-id="${obj.id}">${formatObjectName(obj)}</span>`;
        if (i < 1 && chain.length > 1) breadcrumb += " / ";
    });
    return breadcrumb;
}

function renderColumn(container, itemIds, selectedId, isFocusColumn) {
    const headerEl = container.querySelector(".column-header");
    const contentEl = container.querySelector(".column-content");

    if (container.id === "siblingColumn") {
        headerEl.innerHTML = state.obj_current
            ? createBreadcrumb(state.obj_current.parent_id)
            : "";
        headerEl.querySelectorAll(".breadcrumb-link").forEach(function (link) {
            link.addEventListener("click", function () {
                setCurrentObject(state.id_object.get(link.dataset.id));
            });
        });
    }

    contentEl.innerHTML = "";
    itemIds.forEach(function (itemId) {
        const item = state.id_object.get(itemId);
        const itemEl = document.createElement("div");
        const isSelected = isFocusColumn
            ? itemId === selectedId
            : itemId === state.obj_current?.id;
        itemEl.className = `object-item${isSelected ? " selected" : ""}`;

        const damageBg = document.createElement("div");
        damageBg.className = "damage-background";
        damageBg.style.width = `${(item.damage || 0) * 100}%`;
        itemEl.appendChild(damageBg);

        const textEl = document.createElement("span");
        textEl.textContent = formatObjectName(item);

        const quality = item.quality || 0;
        if (quality < 0.1) {
            textEl.style.color = "black";
        } else if (quality < 0.2) {
            textEl.style.color = "gray";
        } else if (quality < 0.3) {
            textEl.style.color = "white";
        } else if (quality < 0.4) {
            textEl.style.color = "green";
        } else if (quality < 0.5) {
            textEl.style.color = "blue";
        } else if (quality < 0.6) {
            textEl.style.color = "orange";
        } else if (quality < 0.7) {
            textEl.style.color = "yellow";
        } else if (quality < 0.8) {
            textEl.style.color = "red";
        } else if (quality < 0.9) {
            textEl.style.color = "redviolet";
        } else {
            textEl.style.color = "purple";
        }

        itemEl.appendChild(textEl);

        itemEl.addEventListener("click", function () {
            setCurrentObject(item);
        });
        contentEl.appendChild(itemEl);
    });
}

const updateView = debounce(function () {
    renderColumn(
        state.el_sibling_column,
        state.obj_current
            ? state.id_children.get(state.obj_current.parent_id) || [state.obj_current.id]
            : [],
        state.obj_current?.id,
        false
    );
    renderColumn(
        state.el_focus_column,
        state.id_children.get(state.obj_current?.id) || [],
        state.focused_column === "focus" ? state.id_focus_selected : null,
        true
    );
}, 50);

function setCurrentObject(obj) {
    if (obj === state.obj_current) {
        updateView();
        return;
    }

    console.log(`Setting obj_current: ${obj?.id}`);
    state.obj_current = obj;
    state.focused_column = "sibling";
    state.id_focus_selected = null;
    updateView();
}

function isObjectVisible(objId) {
    if (!state.obj_current) return false;

    const obj = state.id_object.get(objId);
    if (!obj) return false;

    if (objId === state.obj_current.id) return true;
    if (obj.parent_id === state.obj_current.id) return true;
    if (state.obj_current.parent_id === objId) return true;
    if (state.id_children.get(state.obj_current.parent_id)?.includes(objId)) return true;

    const parent = getParent(state.obj_current);
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
    } else if (state.obj_current && isObjectVisible(obj.id)) {
        updateView();
    }

    return obj;
}

function handleKeyDown(e) {
    if (e.target instanceof HTMLInputElement) return;

    const siblings = state.id_children.get(state.obj_current?.parent_id) || [];
    const children = state.id_children.get(state.obj_current?.id) || [];
    const currentSiblingIndex = state.obj_current
        ? siblings.indexOf(state.obj_current.id)
        : -1;
    const currentFocusIndex = state.id_focus_selected
        ? children.indexOf(state.id_focus_selected)
        : -1;

    let nextId;
    switch (e.key.toLowerCase()) {
        case "j":
        case "arrowdown":
            if (
                state.focused_column === "sibling" &&
                currentSiblingIndex < siblings.length - 1
            ) {
                nextId = siblings[currentSiblingIndex + 1];
                setCurrentObject(state.id_object.get(nextId));
            } else if (
                state.focused_column === "focus" &&
                currentFocusIndex < children.length - 1
            ) {
                state.id_focus_selected = children[currentFocusIndex + 1];
                updateView();
            }
            break;
        case "k":
        case "arrowup":
            if (state.focused_column === "sibling" && currentSiblingIndex > 0) {
                nextId = siblings[currentSiblingIndex - 1];
                setCurrentObject(state.id_object.get(nextId));
            } else if (state.focused_column === "focus" && currentFocusIndex > 0) {
                state.id_focus_selected = children[currentFocusIndex - 1];
                updateView();
            }
            break;
        case "l":
        case "arrowright":
            if (state.focused_column === "sibling" && children.length > 0) {
                state.focused_column = "focus";
                state.id_focus_selected = children[0];
                updateView();
            } else if (state.focused_column === "focus" && state.id_focus_selected) {
                setCurrentObject(state.id_object.get(state.id_focus_selected));
            }
            break;
        case "h":
        case "arrowleft":
            if (state.focused_column === "focus") {
                state.focused_column = "sibling";
                state.id_focus_selected = null;
                updateView();
            } else if (state.obj_current) {
                nextId = getParent(state.obj_current)?.id;
                if (nextId) setCurrentObject(state.id_object.get(nextId));
            }
            break;
        case "enter":
            if (!e.ctrlKey) {
                if (state.focused_column === "sibling" && state.obj_current) {
                    setCurrentObject(state.obj_current);
                } else if (state.focused_column === "focus" && state.id_focus_selected) {
                    setCurrentObject(state.id_object.get(state.id_focus_selected));
                }
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
    state.focused_column = "sibling";
    state.id_focus_selected = null;
    state.channel = "global";
    updateView();
}

// Event Listeners
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
        state.focus_id = player_id;
        if (!state.obj_current && state.id_object.has(player_id)) {
            setCurrentObject(state.id_object.get(player_id));
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
