// client.js

// DOM Utilities
const $ = (id) => document.getElementById(id);

function createElement(tag, options = {}) {
    // Create the element
    const element = document.createElement(tag);

    // Set className (accepts string or array)
    if (options.className) {
        if (Array.isArray(options.className)) {
            element.classList.add(...options.className);
        } else {
            element.className = options.className;
        }
    }

    // Set ID
    if (options.id) {
        element.id = options.id;
    }

    // Set text content (priority to text over html)
    if (options.text) {
        element.textContent = options.text;
    } else if (options.html) {
        element.innerHTML = options.html;
    }

    // Set attributes
    if (options.attributes) {
        Object.entries(options.attributes).forEach(([key, value]) => {
            element.setAttribute(key, value);
        });
    }

    // Set inline styles
    if (options.styles) {
        Object.assign(element.style, options.styles);
    }

    // Add event listeners
    if (options.events) {
        Object.entries(options.events).forEach(([event, handler]) => {
            element.addEventListener(event, handler);
        });
    }

    // Append children (accepts single element or array)
    if (options.children) {
        const children = Array.isArray(options.children) ? options.children : [options.children];
        children.forEach((child) => {
            if (child instanceof HTMLElement) {
                element.appendChild(child);
            }
        });
    }

    return element;
}

const elements = Object.freeze({
    keybindPopup: $("keybindPopup"),
    chatInput: $("chatInput"),
    messagesContainer: $("messagesContainer"),
    chatContainer: $("chatContainer"),
    chatContent: $("chatContent"),
    toggleChatBtn: $("toggleChatBtn"),
});

// State Management
const state = {
    objectsById: new Map(),
    childrenById: new Map(),
    channel: "event",
    playerId: null,
    objectTypes: new Map(),
};

const COLORSTOPS = Object.freeze({
    QUALITY: [
        { value: 0.0, h: 0, s: 0, l: 0 },
        { value: 0.1, h: 0, s: 10, l: 60 },
        // ... rest of QUALITY stops
        { value: 1.0, h: 300, s: 60, l: 60 },
    ],
    DAMAGE: [
        { value: 0.0, h: 90, s: 70, l: 40 },
        // ... rest of DAMAGE stops
        { value: 1.0, h: 0, s: 70, l: 40 },
    ],
});

const DAMAGE_DESCRIPTORS = [
    "Pristine",
    "Faded",
    "Tarnished",
    "Scuffed",
    "Worn",
    "Pitted",
    "Battered",
    "Weathered",
    "Marred",
    "Cracked",
    "Splintered",
    "Warped",
    "Gnarled",
    "Corroded",
    "Fractured",
    "Ravaged",
    "Mangled",
    "Crumbling",
    "Broken",
    "Ruined",
    "Destroyed",
];

// GameObjectExplorer Class
class GameObjectExplorer {
    #container;
    #currentObject = null;
    #rootId = null;
    #breadcrumbDepth;
    updateView;

    constructor(containerId, rootId = null, breadcrumbDepth = 0) {
        this.#container = $(containerId);
        this.#rootId = rootId;
        this.#breadcrumbDepth = breadcrumbDepth;
        this.#initUI();
        this.updateView = debounce(this.#render.bind(this), 100);
    }

    #initUI() {
        this.#container.innerHTML = `
      <div class="explorer-content object-explorer">
        ${this.#breadcrumbDepth > 0 ? '<div class="breadcrumb-area"></div>' : ""}
        <div class="explorer-columns">
          <div class="explorer-column sibling-column"><div class="column-content"></div></div>
          <div class="explorer-column focus-column"><div class="column-content"></div></div>
        </div>
      </div>
    `;
        Object.assign(this, {
            breadcrumbArea: this.#container.querySelector(".breadcrumb-area"),
            siblingColumn: this.#container.querySelector(".sibling-column"),
            focusColumn: this.#container.querySelector(".focus-column"),
        });
    }

    setRootId(id) {
        this.#rootId = id;
        if (!this.#currentObject && id) {
            const firstChild = state.childrenById.get(id)?.[0];
            if (firstChild) {
                this.setCurrentObject(state.objectsById.get(firstChild));
            }
        }
    }

    #getParent(obj) {
        return state.objectsById.get(obj?.parent_id);
    }

    #getDamageDescription(obj) {
        return DAMAGE_DESCRIPTORS[Math.floor(obj.damage * 20)];
    }

    #formatObject(obj) {
        const typeGlyph = state.objectTypes.get(obj.type)?.glyph ?? "⍰";
        const qualityColor = getColorGradient(obj.quality, "QUALITY");
        const typeName = obj.type[0].toUpperCase() + obj.type.substring(1).toLowerCase();
        let name = typeName;
        if (obj.name) {
            name += ` "${obj.name}"`;
        }

        if (obj.damage) {
            const damageColor = getColorGradient(obj.damage, "DAMAGE");
            name = `<span style="color:${damageColor}">${this.#getDamageDescription(obj)}</span> ${name}`;
        }

        return `
      <span class="object-type" style="color:${qualityColor}">${typeGlyph}</span>
      <span class="object-name">${name}</span>
    `;
    }

    #buildParentChain(obj, max) {
        return Array.from({ length: max })
            .map(() => (obj = obj?.id === this.#rootId ? null : this.#getParent(obj)))
            .filter(Boolean)
            .reverse()
            .slice(-max);
    }

    #generateBreadcrumb(obj) {
        if (!obj || !this.#breadcrumbDepth) {
            return "";
        }

        const chain = this.#buildParentChain(obj, this.#breadcrumbDepth + 1);
        if (!chain.length) {
            return "";
        }

        const items = chain.length > this.#breadcrumbDepth ? ["...", ...chain.slice(1)] : chain;

        return items
            .map((item, i) => {
                const isRoot = !item.parent_id || item.id === this.#rootId;
                const label = typeof item === "string" ? item : this.#formatObject(item);
                return isRoot || (i === 0 && item === "...")
                    ? label
                    : `<span class="breadcrumb-link" data-id="${item.id}">${label}</span>`;
            })
            .join(" / ");
    }

    #createObjectElement(obj, isSelected = false) {
        const el = document.createElement("div");
        el.className = `object-item${isSelected ? " selected" : ""}`;
        el.innerHTML = `<div>${this.#formatObject(obj)}</div>`;
        el.addEventListener("click", () => this.setCurrentObject(obj));
        return el;
    }

    #createObjectInfoProperty(obj) {
        const paragraphs = [
            createElement("p", {
                html: `A ${obj.type}${obj.name ? " named " + obj.name : ""}`,
            }),
            createElement("p", {
                html: `The ${obj.type} is in ${this.#getDamageDescription(obj)} condition (${Math.floor((obj.damage / 1.0) * 100)}%)`,
            }),
        ];
        return paragraphs;
    }

    #renderSiblings() {
        const parentId = this.#currentObject?.parent_id ?? this.#rootId;
        const siblings = state.childrenById.get(parentId) ?? [];

        this.siblingColumn
            .querySelector(".column-content")
            .replaceChildren(
                ...siblings
                    .map((id) => state.objectsById.get(id))
                    .map((obj) =>
                        this.#createObjectElement(obj, obj.id === this.#currentObject?.id)
                    )
            );
    }

    #renderFocus() {
        if (!this.#currentObject) {
            return;
        }

        const content = this.focusColumn.querySelector(".column-content");
        const glyph = state.objectTypes.get(this.#currentObject.type)?.glyph ?? "⍰";
        let infoArea;
        let childrenArea;

        content.replaceChildren(
            Object.assign(document.createElement("div"), {
                className: "object-focus-background",
                textContent: glyph,
            }),
            (infoArea = Object.assign(document.createElement("div"), {
                className: "object-info-area",
            })),
            (childrenArea = Object.assign(document.createElement("div"), {
                className: "children-area",
            }))
        );
        infoArea.replaceChildren(this.#createObjectInfoProperty(this.#currentObject));
        childrenArea.replaceChildren(
            ...(state.childrenById.get(this.#currentObject.id) ?? []).map((id) =>
                this.#createObjectElement(state.objectsById.get(id))
            )
        );
    }

    #render() {
        if (!this.#currentObject && !this.#rootId) {
            this.clear();
            return;
        }

        if (this.breadcrumbArea) {
            this.breadcrumbArea.innerHTML = this.#generateBreadcrumb(this.#currentObject);
            this.breadcrumbArea
                .querySelectorAll(".breadcrumb-link")
                .forEach((link) =>
                    link.addEventListener("click", () =>
                        this.setCurrentObject(state.objectsById.get(link.dataset.id))
                    )
                );
        }

        this.#renderSiblings();
        this.#renderFocus();
    }

    clear() {
        this.breadcrumbArea?.replaceChildren();
        this.siblingColumn.querySelector(".column-content").replaceChildren();
        this.focusColumn.querySelector(".column-content").replaceChildren();
    }

    #isDescendant(target, ancestorId) {
        let curr = target;
        while (curr) {
            if (curr.id === ancestorId) {
                return true;
            }
            curr = state.objectsById.get(curr.parent_id);
        }
        return false;
    }

    getCurrentObject() {
        return this.#currentObject;
    }

    setCurrentObject(obj) {
        if (!obj) {
            return;
        }
        this.#currentObject = obj;
        this.updateView();
    }

    handleNavigationKeyDown(e) {
        if (e.target instanceof HTMLInputElement) {
            return;
        }

        const siblings = state.childrenById.get(this.#currentObject?.parent_id) ?? [];
        const children = state.childrenById.get(this.#currentObject?.id) ?? [];
        const currentIdx = siblings.indexOf(this.#currentObject?.id);

        const keyMap = {
            j: siblings[currentIdx + 1],
            arrowdown: siblings[currentIdx + 1],
            k: siblings[currentIdx - 1],
            arrowup: siblings[currentIdx - 1],
            l: children[0],
            arrowright: children[0],
            h: this.#getParent(this.#currentObject)?.id,
            arrowleft: this.#getParent(this.#currentObject)?.id,
        };

        const nextId = keyMap[e.key.toLowerCase()];
        if (nextId) {
            this.setCurrentObject(state.objectsById.get(nextId));
            e.preventDefault();
        }
    }
}

// Utility Functions
const toggleVisibility = (el) =>
    (el.style.display = el.style.display === "block" ? "none" : "block");

const debounce = (fn, delay) => {
    let timeout;
    return (...args) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => fn(...args), delay);
    };
};

const getColorGradient = (
    (cache = new Map()) =>
    (value, stopName) => {
        const key = `${stopName},${value}`;
        const cached = cache.get(key);

        if (cached) {
            return cached;
        }

        const stops = COLORSTOPS[stopName];

        const [current, next] = stops.reduce(
            ([prev, next], stop) => (value >= stop.value ? [stop, next] : [prev, stop]),
            [stops[0], stops[1]]
        );

        if (!next) {
            return "";
        }

        const t =
            next.value === current.value
                ? 1
                : (value - current.value) / (next.value - current.value);

        const interpolate = (a, b) => Math.round(a + (b - a) * t);
        const result = hslToHex(
            interpolate(current.h, next.h),
            interpolate(current.s, next.s),
            interpolate(current.l, next.l)
        );

        cache.set(key, result);
        return result;
    }
)();

const hslToHex = (
    (cache = new Map()) =>
    (h, s, l) => {
        const key = `${h},${s},${l}`;
        if (cache.has(key)) {
            return cache.get(key);
        }

        const [ss, ll] = [s / 100, l / 100];
        const a = ss * Math.min(ll, 1 - ll);
        const f = (n) => {
            const k = (n + h / 30) % 12;
            const color = ll - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
            return Math.round(255 * color)
                .toString(16)
                .padStart(2, "0");
        };

        const result = `#${f(0)}${f(8)}${f(4)}`;
        cache.set(key, result);
        return result;
    }
)();

// Chat Module
const toggleChatVisibility = () => {
    const { chatContent, toggleChatBtn, chatInput } = elements;
    const isHidden = chatContent.classList.toggle("hidden");
    toggleChatBtn.textContent = isHidden ? "︿" : "﹀";
    isHidden ? chatInput.blur() : chatInput.focus();
};

const sendChatMessage = () => {
    const { chatInput, messagesContainer } = elements;
    const message = chatInput.value.trim();
    if (!message) {
        return;
    }

    displayChatMessage(message, "sent", state.channel);
    worker.postMessage({ type: "chat", content: message });
    chatInput.value = "";
};

const createChannelTab = (channel) => {
    const tabs = document.querySelector(".chat-tabs");
    if (tabs.querySelector(`[data-channel="${channel}"]`)) {
        return;
    }

    const tab = Object.assign(document.createElement("button"), {
        className: "tab-btn",
        textContent: channel.charAt(0).toUpperCase() + channel.slice(1),
    });
    tab.dataset.channel = channel;
    tab.addEventListener("click", () => setChatChannel(channel));
    tabs.insertBefore(tab, elements.toggleChatBtn);
};

const displayChatMessage = (text, direction = "received", channel = "event") => {
    createChannelTab(channel);

    const msg = Object.assign(document.createElement("div"), {
        className: "message",
        textContent: text,
        style: { display: channel === state.channel ? "block" : "none" },
    });
    msg.dataset.channel = channel;
    msg.dataset.direction = direction;

    elements.messagesContainer.append(msg);
    elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
};

const setChatChannel = (channel) => {
    state.channel = channel;
    filterChatMessages();
    if (elements.chatContainer.classList.contains("hidden")) {
        toggleChatVisibility();
    }
    document
        .querySelectorAll(".tab-btn")
        .forEach((btn) => btn.classList.toggle("active", btn.dataset.channel === channel));
};

const filterChatMessages = () => {
    document
        .querySelectorAll(".message")
        .forEach(
            (msg) => (msg.style.display = msg.dataset.channel === state.channel ? "block" : "none")
        );
    elements.messagesContainer.scrollTop = elements.messagesContainer.scrollHeight;
};

// Explorer Instances
const [worldExplorer, playerExplorer] = [
    new GameObjectExplorer("worldExplorerContainer", null, 3),
    new GameObjectExplorer("playerExplorerContainer", null, 2),
];

// Worker Communication
const worker = new Worker("worker.js");

worker.onmessage = ({ data }) => {
    //console.log("Received <-", data);
    data.type
        ? worker.dispatchEvent(new CustomEvent(data.type, { detail: data }))
        : processObjectUpdate(data);
};

const processObjectUpdate = (snapshot) => {
    const [id, ...props] = snapshot.o.split(";");
    const obj = state.objectsById.get(id) ?? {};
    const previousParentId = obj.parent_id;

    Object.assign(obj, {
        id,
        ...Object.fromEntries(
            props.map((p) => {
                const [k, v] = p.split("=");
                return [k, isNaN(v) ? v : Number(v)];
            })
        ),
    });

    if (previousParentId !== obj.parent_id) {
        state.childrenById.get(previousParentId)?.remove(obj.id);
        state.childrenById.set(obj.parent_id, [
            ...(state.childrenById.get(obj.parent_id) ?? []),
            obj.id,
        ]);
    }

    state.objectsById.set(id, obj);

    if (obj.type === "type") {
        state.objectTypes.set(obj.name, obj);
        return;
    }

    if (state.playerId === obj.id && !worldExplorer.getCurrentObject()) {
        worldExplorer.setCurrentObject(obj);
    } else if (isObjectVisible(obj, worldExplorer)) {
        worldExplorer.updateView();
    }

    if (state.playerId === obj.parent_id && !playerExplorer.getCurrentObject()) {
        playerExplorer.setCurrentObject(obj);
    } else if (isObjectVisible(obj, playerExplorer)) {
        playerExplorer.updateView();
    }
};

const removeObject = (objectId) => {
    const obj = state.objectsById.get(objectId);
    if (!obj) {
        return;
    }

    (state.childrenById.get(objectId) ?? []).forEach(removeObject);

    const siblings = state.childrenById.get(obj.parent_id);
    if (siblings) {
        siblings.remove(objectId);
        if (!siblings.length) {
            state.childrenById.delete(obj.parent_id);
        }
    }

    state.objectsById.delete(objectId);
    state.childrenById.delete(objectId);

    for (const explorer of [worldExplorer, playerExplorer]) {
        if (explorer.getCurrentObject()?.id === objectId) {
            const parent = state.objectsById.get(obj.parent_id);
            const siblings = state.childrenById.get(obj.parent_id)?.[0];
            explorer.setCurrentObject(siblings ? state.objectsById.get(siblings) : parent);
        } else if (isObjectVisible(obj, explorer)) {
            explorer.updateView();
        }
    }
};

const isObjectVisible = (obj, explorer) => {
    const curr = explorer.getCurrentObject();
    return (
        curr &&
        (obj.id === curr.id || obj.parent_id === curr.id || obj.parent_id === curr.parent_id)
    );
};

// Event Listeners
document.addEventListener("keydown", (e) => {
    if (e.ctrlKey) {
        if (e.key === "I") {
            toggleVisibility(elements.keybindPopup);
            e.preventDefault();
        } else if (e.key === "Enter") {
            toggleChatVisibility();
            e.preventDefault();
        }
        return;
    }

    if (document.activeElement !== elements.chatInput) {
        [worldExplorer, playerExplorer].forEach((ex) => ex.handleNavigationKeyDown(e));
    }
});

elements.chatInput.addEventListener(
    "keydown",
    (e) => !e.ctrlKey && e.key === "Enter" && sendChatMessage()
);
elements.toggleChatBtn.addEventListener("click", toggleChatVisibility);

worker.addEventListener(
    "connected",
    ({ detail: { clientId, clientSecret, playerId, welcomeMessage } }) => {
        if (clientSecret) {
            localStorage.setItem("clientSecret", clientSecret);
        }
        if (playerId) {
            state.playerId = playerId;
            playerExplorer.setRootId(playerId);
            const player = state.objectsById.get(playerId);
            if (player) {
                worldExplorer.setCurrentObject(player);
            }
        }
        displayChatMessage("Connected.");
        displayChatMessage(welcomeMessage);
    }
);

worker.addEventListener("offline", ({ detail }) => {
    displayChatMessage(detail.message);
    worldExplorer.clear();
    playerExplorer.clear();
});

worker.addEventListener("chat", ({ detail }) =>
    displayChatMessage(detail.content, "received", detail.channel)
);

worker.addEventListener("disconnected", ({ detail: { id } }) => {
    const player = state.objectsById.get(id);
    if (player) {
        displayChatMessage(`${player.name} disconnected.`);
        removeObject(id);
    }
});

// Initialization
displayChatMessage("Connecting to server...");
setChatChannel(state.channel);
worker.postMessage({
    type: "connect",
    url: "ws://localhost:8080",
    clientSecret: localStorage.getItem("clientSecret"),
});
