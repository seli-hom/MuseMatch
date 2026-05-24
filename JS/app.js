const IIIF_BASE = "https://www.artic.edu/iiif/2";
const API_SEARCH = "https://api.artic.edu/api/v1/artworks/search";
const ITEMS_PER_PAGE = 10;

let currentPage = 1;
let totalPages = 1;

async function loadPage(page) {
    const hallway = document.getElementById("gallery-hallway");
    hallway.innerHTML = '<div class="loading-msg">Curating the collection...</div>';

    const queryPayload = {
        fields: ["id", "title", "artist_title", "image_id", "thumbnail"],
        limit: ITEMS_PER_PAGE,
        page,
        query: {
            bool: {
                must: [
                    { exists: { field: "image_id" } }
                ]
            }
        }
    };

    try {
        const res = await fetch(`${API_SEARCH}?page=${page}&limit=${ITEMS_PER_PAGE}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(queryPayload)
        });
        const result = await res.json();
        totalPages = Math.ceil(result.pagination.total / ITEMS_PER_PAGE);
        currentPage = page;
        renderHallway(result.data);
        updatePagination();
    } catch (err) {
        console.error("Failed to load artworks:", err);
        hallway.innerHTML = '<div class="loading-msg">Failed to load collection.</div>';
    }
}

function renderHallway(artworks) {
    const hallway = document.getElementById("gallery-hallway");
    hallway.innerHTML = "";

    artworks.forEach(art => {
        const imgUrl = `${IIIF_BASE}/${art.image_id}/full/,400/0/default.jpg`;

        const exhibit = document.createElement("div");
        exhibit.className = "exhibit";
        exhibit.dataset.title = art.title;
        exhibit.dataset.artist = art.artist_title || "Unknown Artist";
        exhibit.dataset.altText = art.thumbnail?.alt_text || "";

        exhibit.innerHTML = `
            <div class="frame">
                <img src="${imgUrl}" alt="${art.title}" loading="lazy">
            </div>
            <div class="label-plate">
                <strong>${art.title}</strong>
                <span>${art.artist_title || "Unknown"}</span>
                <button class="view-details-btn">View Details</button>
            </div>
        `;

        exhibit.querySelector(".view-details-btn").addEventListener("click", (e) => {
            e.stopPropagation();
            openDetails(art);
        });

        hallway.appendChild(exhibit);
    });

    setupProximityDetection();
}

function openDetails(art) {
    sessionStorage.setItem("selected-item", JSON.stringify({
        itemID: String(art.id || ""),
        itemTitle: art.title,
        artist: art.artist_title || "Unknown Artist",
        image_id: art.image_id || "",
        altText: art.thumbnail?.alt_text || "",
        description: art.thumbnail?.alt_text || "No overview available for this piece.",
        location: "Main Gallery — Late 19th Century",
    }));
    window.location.href = "artPieceDetails.html";
}

function updatePagination() {
    const label = document.getElementById("page-label");
    const counter = document.getElementById("page-counter");
    const prevBtn = document.getElementById("prev-page");
    const nextBtn = document.getElementById("next-page");

    if (label) label.textContent = `Page ${currentPage} of ${totalPages}`;
    if (counter) counter.textContent = `Gallery · Page ${currentPage}`;
    if (prevBtn) prevBtn.disabled = currentPage <= 1;
    if (nextBtn) nextBtn.disabled = currentPage >= totalPages;
}

function setupProximityDetection() {
    const exhibits = document.querySelectorAll(".exhibit");
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                exhibits.forEach(el => el.classList.remove("active"));
                entry.target.classList.add("active");
                triggerTourGuide(entry.target.dataset);
            }
        });
    }, {
        root: document.querySelector(".gallery-wrapper"),
        rootMargin: "0px -35% 0px -35%",
        threshold: 0.5
    });
    exhibits.forEach(ex => observer.observe(ex));
}

function triggerTourGuide(artData) {
    const status = document.getElementById("guide-status");
    const info = document.getElementById("artwork-info");
    if (status) status.textContent = `"${artData.title}"`;
    if (info) info.textContent = `by ${artData.artist}`;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(
        `Here we have ${artData.title}, created by ${artData.artist}. ${artData.altText}`
    );
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
}

document.addEventListener("DOMContentLoaded", () => {
    Auth.updateNav();

    document.getElementById("prev-page")?.addEventListener("click", () => {
        if (currentPage > 1) loadPage(currentPage - 1);
    });
    document.getElementById("next-page")?.addEventListener("click", () => {
        if (currentPage < totalPages) loadPage(currentPage + 1);
    });

    loadPage(1);
});
