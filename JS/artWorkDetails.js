import { FetchWrapper } from "./fetchWrapper.js";

const artInstituteAPI = new FetchWrapper("https://api.artic.edu/api/v1");
const API_BASE = "http://localhost:3000/api";

const data = JSON.parse(sessionStorage.getItem("selected-item"));

if (!data) {
    const section = document.getElementById("commission-section");
    if (section) section.innerHTML = `<p class="form-intro">No artwork selected. <a href="gallery.html" style="color:var(--gold)">Return to gallery</a>.</p>`;
} else {
    populateArtwork(data);
    populateCommissionSection(data);
}

function populateArtwork(data) {
    const setText = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val;
    };

    setText("art-piece-name", data.itemTitle || "Untitled");
    setText("artist-name", data.artist || "Unknown Artist");
    setText("desc", data.description || "No overview available for this piece.");
    setText("gallery-location", data.location || "Main Gallery");
    setText("art-details-text", data.altText || "Detailed context unavailable for this work.");

    const img = document.getElementById("artwork-img");
    if (img) {
        if (data.image_id) {
            img.src = `https://www.artic.edu/iiif/2/${data.image_id}/full/843,/0/default.jpg`;
            img.alt = data.itemTitle;
        } else if (data.thumbnail) {
            img.src = data.thumbnail;
        }
    }

    // Fetch richer artist details from the API in the background
    if (data.itemID) {
        artInstituteAPI.get(`/artworks/${data.itemID}?fields=artist_display,description`)
            .then(res => {
                const el = document.getElementById("artist-details-text");
                if (el && res.data?.artist_display) el.textContent = res.data.artist_display;
                const descEl = document.getElementById("desc");
                if (descEl && res.data?.description) {
                    const tmp = document.createElement("div");
                    tmp.innerHTML = res.data.description;
                    descEl.textContent = tmp.textContent;
                }
            })
            .catch(() => {});
    }
}

function populateCommissionSection(artData) {
    const section = document.getElementById("commission-section");
    if (!section) return;

    const session = window.Auth ? window.Auth.getSession() : null;

    if (!session) {
        section.innerHTML = `
            <p class="form-intro">
                Sign in to request a commissioned replica of this piece from one of our artists.
            </p>
            <a href="login.html" class="commission-btn" style="display:block;text-align:center;margin-bottom:0;">
                <span>Sign In to Commission</span>
            </a>
            <p class="register-link">No account yet? <a href="register.html">Register here</a></p>
        `;
        return;
    }

    if (session.role === "artist") {
        section.innerHTML = `
            <p class="form-intro">
                You are browsing as an artist. View and manage all incoming commission requests from your dashboard.
            </p>
            <a href="requests.html" class="commission-btn" style="display:block;text-align:center;margin-bottom:0;">
                <span>View Commission Requests</span>
            </a>
        `;
        return;
    }

    const budgetOptions = ["50", "100", "200", "300", "400", "500+"];

    // Logged-in viewer
    section.innerHTML = `
        <style>
          .custom-select { position: relative; user-select: none; margin-bottom: 20px; }
          .custom-select-label { font-size:0.62rem;letter-spacing:0.22em;color:var(--gold-dim);text-transform:uppercase;display:block;margin-bottom:6px; }
          .custom-select-trigger {
            display: flex; align-items: center; justify-content: space-between;
            background: rgba(255,255,255,0.04);
            border: 1px solid var(--gold-dim);
            color: var(--cream);
            font-family: 'Tenor Sans', sans-serif;
            font-size: 0.9rem;
            padding: 10px 14px;
            cursor: pointer;
            transition: border-color 0.2s, background 0.2s;
          }
          .custom-select-trigger:hover,
          .custom-select.open .custom-select-trigger { border-color: var(--gold); background: rgba(201,168,76,0.06); }
          .custom-select-arrow {
            font-size: 0.65rem; color: var(--gold-dim); transition: transform 0.2s;
          }
          .custom-select.open .custom-select-arrow { transform: rotate(180deg); }
          .custom-select-options {
            display: none;
            position: absolute;
            top: 100%; left: 0; right: 0;
            background: #1a1508;
            border: 1px solid var(--gold-dim);
            border-top: none;
            z-index: 50;
          }
          .custom-select.open .custom-select-options { display: block; }
          .custom-select-option {
            padding: 10px 14px;
            font-family: 'Tenor Sans', sans-serif;
            font-size: 0.9rem;
            color: var(--cream-dim);
            cursor: pointer;
            transition: background 0.15s, color 0.15s;
            border-bottom: 1px solid rgba(201,168,76,0.08);
          }
          .custom-select-option:last-child { border-bottom: none; }
          .custom-select-option:hover,
          .custom-select-option.selected { background: rgba(201,168,76,0.12); color: var(--gold); }
        </style>
        <p class="form-intro">
            Select your budget and submit a commission request. An artist will review it and get back to you.
        </p>
        <div class="custom-select" id="budget-select">
            <span class="custom-select-label">Budget</span>
            <div class="custom-select-trigger">
                <span id="budget-display">$50</span>
                <span class="custom-select-arrow">&#9660;</span>
            </div>
            <div class="custom-select-options">
                ${budgetOptions.map((v, i) => `<div class="custom-select-option${i === 0 ? " selected" : ""}" data-value="${v}">$${v}</div>`).join("")}
            </div>
        </div>
        <button class="commission-btn" id="commission-btn">
            <span>Commission a Replica</span>
        </button>
        <div id="commission-status" style="text-align:center;font-size:0.75rem;letter-spacing:0.1em;padding:10px;margin-top:12px;display:none;"></div>
        <p class="register-link" style="margin-top:14px;">
            Signed in as ${session.firstName} ${session.lastName} &nbsp;·&nbsp;
            <button onclick="Auth.logout()" style="background:none;border:none;color:var(--gold);cursor:pointer;font-family:inherit;font-size:inherit;letter-spacing:inherit;text-transform:inherit;border-bottom:1px solid var(--gold-dim);">Sign Out</button>
        </p>
    `;

    // Custom dropdown logic
    let selectedBudget = "50";
    const selectEl = document.getElementById("budget-select");
    const trigger = selectEl.querySelector(".custom-select-trigger");
    const display = document.getElementById("budget-display");
    const options = selectEl.querySelectorAll(".custom-select-option");

    trigger.addEventListener("click", () => selectEl.classList.toggle("open"));
    options.forEach(opt => {
        opt.addEventListener("click", () => {
            selectedBudget = opt.dataset.value;
            display.textContent = `$${selectedBudget}`;
            options.forEach(o => o.classList.remove("selected"));
            opt.classList.add("selected");
            selectEl.classList.remove("open");
        });
    });
    document.addEventListener("click", e => {
        if (!selectEl.contains(e.target)) selectEl.classList.remove("open");
    });

    document.getElementById("commission-btn").addEventListener("click", async () => {
        const btn = document.getElementById("commission-btn");
        const statusEl = document.getElementById("commission-status");
        const budget = selectedBudget;

        btn.disabled = true;
        statusEl.style.display = "block";
        statusEl.style.color = "var(--cream-dim)";
        statusEl.style.borderColor = "var(--gold-dim)";
        statusEl.style.border = "1px solid var(--gold-dim)";
        statusEl.textContent = "Submitting request...";

        try {
            const res = await fetch(`${API_BASE}/request`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    userEmail: session.email,
                    artwork: {
                        id: artData.itemID,
                        title: artData.itemTitle,
                        artist: artData.artist,
                        imageId: artData.image_id,
                    },
                    budget,
                }),
            });

            const result = await res.json();
            if (!res.ok) {
                statusEl.style.color = "var(--err)";
                statusEl.style.border = "1px solid var(--err)";
                statusEl.textContent = result.error || "Request failed.";
                btn.disabled = false;
                return;
            }

            statusEl.style.color = "var(--success)";
            statusEl.style.border = "1px solid var(--success)";
            statusEl.textContent = "Commission request submitted successfully!";
            btn.style.opacity = "0.5";
            btn.disabled = true;
        } catch {
            statusEl.style.color = "var(--err)";
            statusEl.style.border = "1px solid var(--err)";
            statusEl.textContent = "Could not connect to the server.";
            btn.disabled = false;
        }
    });
}
