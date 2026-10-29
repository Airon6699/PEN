
const products = [
    { id: 1, name: "The Signature", type: "ballpoint", price: 38, oldPrice: 45, tag: "BESTSELLER", desc: "Matte black · Brass details", image: "photo-1583485088034-697b5bc54ccd", color: "#353631" },
    { id: 2, name: "The Atelier", type: "fountain", price: 64, tag: "NEW ARRIVAL", desc: "Forest green · Fine nib", image: "photo-1455390582262-044cdead277a", color: "#52614d" },
    { id: 3, name: "The Minimalist", type: "rollerball", price: 29, desc: "Brushed silver · Smooth ink", image: "photo-1517842645767-c639042777db", color: "#aaa9a4" },
    { id: 4, name: "The Executive", type: "ballpoint", price: 52, desc: "Midnight blue · Gold trim", image: "photo-1453738773917-9c3eff1db985", color: "#293a55" },
    { id: 5, name: "The Writer's Set", type: "sets", price: 89, tag: "GIFT READY", desc: "Two pens · Signature box", image: "photo-1511988617509-a57c8a288659", color: "#8d6745" },
    { id: 6, name: "The Classic", type: "fountain", price: 72, desc: "Ivory finish · Fine nib", image: "photo-1519682337058-a94d519337bc", color: "#c4b69e" },
    { id: 7, name: "The Daily", type: "ballpoint", price: 24, desc: "Warm grey · Everyday writing", image: "photo-1516979187457-637abb4f9353", color: "#96928b" },
    { id: 8, name: "The Studio", type: "rollerball", price: 42, tag: "POPULAR", desc: "Graphite · Balanced body", image: "photo-1455390582262-044cdead277a", color: "#5b5b56" },
    { id: 9, name: "The Collector", type: "sets", price: 118, desc: "Three-piece gift collection", image: "photo-1453738773917-9c3eff1db985", color: "#795f48" }
];

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const money = value => "$" + value.toFixed(2);
const imageUrl = (id, width = 700) => `https://images.unsplash.com/${id}?auto=format&fit=crop&w=${width}&q=80`;

let activeFilter = "all";
let searchTerm = "";
let sortMode = "featured";
let bag = JSON.parse(localStorage.getItem("penora-bag") || "[]");
let favorites = new Set(JSON.parse(localStorage.getItem("penora-favorites") || "[]"));
let currentAuth = "login";
let currentUser = null;
let toastTimer;

const grid = $("#product-grid");
const overlay = $("#overlay");
const bagDrawer = $("#bag-drawer");
const favoriteDrawer = $("#favorites-drawer");
const authModal = $("#auth-modal");
const checkoutModal = $("#checkout-modal");

function saveBag() {
    localStorage.setItem("penora-bag", JSON.stringify(bag));
}

function saveFavorites() {
    localStorage.setItem("penora-favorites", JSON.stringify([...favorites]));
}

function showToast(message) {
    const toast = $("#toast");
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}

function getProduct(id) {
    return products.find(product => product.id === Number(id));
}

function visibleProducts() {
    let result = products.filter(product => {
        const matchesType = activeFilter === "all" || product.type === activeFilter;
        const matchesSearch = `${product.name} ${product.desc} ${product.type}`.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesType && matchesSearch;
    });

    if (sortMode === "low") result.sort((a, b) => a.price - b.price);
    if (sortMode === "high") result.sort((a, b) => b.price - a.price);
    if (sortMode === "name") result.sort((a, b) => a.name.localeCompare(b.name));

    return result;
}

function renderProducts() {
    const result = visibleProducts();
    $("#product-total").textContent = `${String(result.length).padStart(2, "0")} OBJECTS`;
    $("#empty-state").hidden = result.length > 0;

    grid.innerHTML = result.map((product, index) => `
        <article class="product-card" style="animation-delay:${index * 35}ms">
            <div class="product-image">
                <img src="${imageUrl(product.image)}" alt="${product.name}" loading="lazy">
                ${product.tag ? `<span class="product-tag">${product.tag}</span>` : ""}
                <button class="favorite-btn ${favorites.has(product.id) ? "active" : ""}" data-favorite="${product.id}" aria-label="Toggle favorite">${favorites.has(product.id) ? "♥" : "♡"}</button>
                <button class="quick-add" data-add="${product.id}">Add to bag · ${money(product.price)} ↗</button>
            </div>
            <div class="product-info">
                <div><h3>${product.name}</h3><p>${product.desc}</p></div>
                <strong>${money(product.price)}</strong>
            </div>
            <div class="product-meta"><span class="swatch" style="--swatch:${product.color}"></span><span>${product.type.toUpperCase()}</span></div>
        </article>
    `).join("");
}

function updateCounts() {
    const count = bag.reduce((sum, item) => sum + item.quantity, 0);
    $("#bag-count").textContent = count;
    $("#drawer-count").textContent = `(${count})`;
    $("#bag-subtotal").textContent = money(bag.reduce((sum, item) => sum + item.price * item.quantity, 0));
}

function renderBag() {
    if (!bag.length) {
        $("#bag-items").innerHTML = '<div class="drawer-empty">Your bag is waiting for something special.<br>Explore the collection to find your pen.</div>';
    } else {
        $("#bag-items").innerHTML = bag.map(item => {
            const product = getProduct(item.id);
            if (!product) return "";
            return `
                <div class="drawer-item">
                    <img src="${imageUrl(product.image, 250)}" alt="${product.name}">
                    <div>
                        <h4>${product.name}</h4>
                        <p>${money(product.price)}</p>
                        <div class="quantity">
                            <button data-quantity="${product.id}" data-change="-1" aria-label="Decrease quantity">−</button>
                            <span>${item.quantity}</span>
                            <button data-quantity="${product.id}" data-change="1" aria-label="Increase quantity">+</button>
                        </div>
                    </div>
                    <button class="remove-item" data-remove="${product.id}">Remove</button>
                </div>
            `;
        }).join("");
    }

    updateCounts();
    $("#checkout-total").textContent = $("#bag-subtotal").textContent;
}

function renderFavorites() {
    const items = products.filter(product => favorites.has(product.id));

    $("#favorite-items").innerHTML = items.length ? items.map(product => `
        <div class="drawer-item">
            <img src="${imageUrl(product.image, 250)}" alt="${product.name}">
            <div><h4>${product.name}</h4><p>${money(product.price)}</p><button class="text-link" data-add="${product.id}">Add to bag ↗</button></div>
            <button class="remove-item" data-favorite="${product.id}">Remove</button>
        </div>
    `).join("") : '<div class="drawer-empty">No favorites yet.<br>Tap the heart on a piece you love.</div>';
}

function addToBag(id) {
    const product = getProduct(id);
    if (!product) return;

    const existing = bag.find(item => item.id === product.id);
    if (existing) existing.quantity++;
    else bag.push({ id: product.id, price: product.price, quantity: 1 });

    saveBag();
    renderBag();
    showToast(`${product.name} added to your bag.`);
}

function changeQuantity(id, amount) {
    const item = bag.find(item => item.id === Number(id));
    if (!item) return;

    item.quantity += amount;
    if (item.quantity <= 0) bag = bag.filter(entry => entry.id !== Number(id));

    saveBag();
    renderBag();
}

function toggleFavorite(id) {
    id = Number(id);
    if (favorites.has(id)) favorites.delete(id);
    else favorites.add(id);

    saveFavorites();
    renderProducts();
    renderFavorites();
}

function openPanel(panel) {
    closePanels();
    overlay.classList.add("open");
    panel.classList.add("open");
    document.body.classList.add("locked");
}

function openModal(modal) {
    closePanels();
    overlay.classList.add("open");
    modal.classList.add("open");
    document.body.classList.add("locked");
}

function closePanels() {
    overlay.classList.remove("open");
    $$(".drawer, .modal-wrap").forEach(panel => panel.classList.remove("open"));
    document.body.classList.remove("locked");
}

function setAuthMode(mode) {
    currentAuth = mode;
    const isRegister = mode === "register";

    $$(".auth-tab").forEach(tab => tab.classList.toggle("active", tab.dataset.auth === mode));
    $("#auth-title").textContent = isRegister ? "Create your account." : "Welcome back.";
    $("#auth-description").textContent = isRegister ? "Join the PENORA writing community." : "Sign in to continue your PENORA experience.";
    $("#username-label").hidden = !isRegister;
    $("#email-label").hidden = !isRegister;
    $("#auth-username").required = isRegister;
    $("#auth-email").required = isRegister;
    $("#auth-password").autocomplete = isRegister ? "new-password" : "current-password";
    $("#auth-submit").textContent = isRegister ? "Create account ↗" : "Sign in ↗";
    $("#auth-message").textContent = "";
    $("#auth-message").className = "form-message";
}

async function submitAuth(event) {
    event.preventDefault();

    const message = $("#auth-message");
    const username = $("#auth-username").value.trim();
    const email = $("#auth-email").value.trim();
    const password = $("#auth-password").value;

    message.className = "form-message";
    message.textContent = "Please wait...";

    try {
        const response = await fetch(`/api/${currentAuth}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, email, password })
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Something went wrong.");

        currentUser = data.user;
        message.textContent = currentAuth === "register" ? "Account created successfully." : "You are signed in.";
        message.classList.add("success");
        $("#account-btn").textContent = "♙";
        showToast(`Welcome${currentUser.username ? `, ${currentUser.username}` : ""}!`);

        setTimeout(() => {
            closePanels();
            $("#auth-form").reset();
            setAuthMode("login");
        }, 800);
    } catch (error) {
        message.textContent = error.message === "Failed to fetch"
            ? "Cannot reach the server. Start it with node server.js."
            : error.message;
        message.classList.add("error");
    }
}

async function submitCheckout(event) {
    event.preventDefault();

    if (!bag.length) {
        showToast("Your bag is empty.");
        return;
    }

    const message = $("#checkout-message");
    message.className = "form-message";
    message.textContent = "Placing your demo order...";

    const order = {
        name: $("#checkout-name").value.trim(),
        email: $("#checkout-email").value.trim(),
        address: $("#checkout-address").value.trim(),
        items: bag.map(item => ({ id: item.id, quantity: item.quantity }))
    };

    try {
        const response = await fetch("/api/orders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(order)
        });

        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Could not place the order.");

        bag = [];
        saveBag();
        renderBag();
        message.className = "form-message success";
        message.textContent = `Order ${data.order.id} created. This is a demo; no payment was taken.`;
        $("#checkout-form").reset();
        showToast("Your demo order has been recorded.");
    } catch (error) {
        message.className = "form-message error";
        message.textContent = error.message === "Failed to fetch"
            ? "Cannot reach the server. Start it with node server.js."
            : error.message;
    }
}

grid.addEventListener("click", event => {
    const addButton = event.target.closest("[data-add]");
    const favoriteButton = event.target.closest("[data-favorite]");

    if (addButton) addToBag(addButton.dataset.add);
    if (favoriteButton) toggleFavorite(favoriteButton.dataset.favorite);
});

$("#bag-items").addEventListener("click", event => {
    const quantityButton = event.target.closest("[data-quantity]");
    const removeButton = event.target.closest("[data-remove]");

    if (quantityButton) changeQuantity(quantityButton.dataset.quantity, Number(quantityButton.dataset.change));
    if (removeButton) {
        bag = bag.filter(item => item.id !== Number(removeButton.dataset.remove));
        saveBag();
        renderBag();
    }
});

$("#favorite-items").addEventListener("click", event => {
    const addButton = event.target.closest("[data-add]");
    const favoriteButton = event.target.closest("[data-favorite]");

    if (addButton) addToBag(addButton.dataset.add);
    if (favoriteButton) toggleFavorite(favoriteButton.dataset.favorite);
});

$("#filters").addEventListener("click", event => {
    const button = event.target.closest("[data-filter]");
    if (!button) return;

    activeFilter = button.dataset.filter;
    $$(".filter").forEach(filter => filter.classList.toggle("active", filter === button));
    renderProducts();
});

$("#sort-select").addEventListener("change", event => {
    sortMode = event.target.value;
    renderProducts();
});

$("#reset-filters").addEventListener("click", () => {
    activeFilter = "all";
    searchTerm = "";
    $("#search-input").value = "";
    $$(".filter").forEach(filter => filter.classList.toggle("active", filter.dataset.filter === "all"));
    renderProducts();
});

$("#search-toggle").addEventListener("click", () => {
    $("#search-panel").classList.toggle("open");
    if ($("#search-panel").classList.contains("open")) $("#search-input").focus();
});

$("#search-close").addEventListener("click", () => $("#search-panel").classList.remove("open"));

$("#search-input").addEventListener("input", event => {
    searchTerm = event.target.value.trim();
    renderProducts();
    $("#collection").scrollIntoView({ behavior: "smooth", block: "start" });
});

$("#bag-toggle").addEventListener("click", () => {
    renderBag();
    openPanel(bagDrawer);
});

$("#account-btn").addEventListener("click", () => {
    setAuthMode("login");
    openModal(authModal);
});

$("#menu-toggle").addEventListener("click", () => $(".nav").classList.toggle("open"));

$(".nav").addEventListener("click", event => {
    if (event.target.closest("a")) $(".nav").classList.remove("open");
});

$$("[data-auth]").forEach(button => button.addEventListener("click", () => setAuthMode(button.dataset.auth)));
$$("[data-close]").forEach(button => button.addEventListener("click", closePanels));
overlay.addEventListener("click", closePanels);
document.addEventListener("keydown", event => {
    if (event.key === "Escape") closePanels();
});

$("#auth-form").addEventListener("submit", submitAuth);

$("#checkout-btn").addEventListener("click", () => {
    if (!bag.length) {
        showToast("Add a pen to your bag first.");
        return;
    }

    if (currentUser) {
        $("#checkout-name").value = currentUser.username || "";
        $("#checkout-email").value = currentUser.email || "";
    }

    $("#checkout-message").textContent = "";
    renderBag();
    openModal(checkoutModal);
});

$("#checkout-form").addEventListener("submit", submitCheckout);

$("#newsletter-form").addEventListener("submit", event => {
    event.preventDefault();
    const email = $("#newsletter-email").value.trim();
    if (!email) return;

    $("#newsletter-message").textContent = "Thank you for joining the PENORA list.";
    $("#newsletter-email").value = "";
});

renderProducts();
renderBag();
renderFavorites();
setAuthMode("login");
