// ── Configuration ──────────────────────────────────────────────────────────
const SEARCH_URL = "https://api.artic.edu/api/v1/artworks/search";
const IIIF_BASE  = "https://www.artic.edu/iiif/2";
const PAGE_SIZE  = 25;

// Total pages to cycle through (loops back around)
const TOTAL_PAGES = 5;

let currentPage = 1;

// ── Query builder ───────────────────────────────────────────────────────────
function buildQuery(page) {
    return {
        resources: "artworks",
        fields: ["id", "title", "artist_title", "image_id", "thumbnail",
                 "description", "place_of_origin", "gallery_title"],
        limit: PAGE_SIZE,
        from: (page - 1) * PAGE_SIZE,
        query: {
            bool: {
                must: [
                    { exists: { field: "image_id" } },
                    { range: { date_start: { gte: 1870, lte: 1900 } } }
                ]
            }
        }
    };
}

// ── Load page ───────────────────────────────────────────────────────────────
async function loadPage(page) {
    const hallway = document.getElementById('gallery-hallway');
    hallway.innerHTML = '<div class="loading-msg">Curating the collection...</div>';

    // Scroll the gallery back to the start on page change
    document.querySelector('.gallery-wrapper').scrollLeft = 0;

    try {
        const response = await fetch(SEARCH_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(buildQuery(page))
        });
        const result = await response.json();
        renderHallway(result.data || []);
        updatePaginationUI(page);
    } catch (error) {
        hallway.innerHTML = '<div class="loading-msg">Could not load gallery. Please try again.</div>';
        console.error("Failed to gather museum data:", error);
    }
}

// ── Render hallway ──────────────────────────────────────────────────────────
function renderHallway(artworks) {
    const hallway = document.getElementById('gallery-hallway');
    hallway.innerHTML = '';

    if (!artworks.length) {
        hallway.innerHTML = '<div class="loading-msg">No pieces found for this page.</div>';
        return;
    }

    artworks.forEach(art => {
        const imgUrl = `${IIIF_BASE}/${art.image_id}/full/,500/0/default.jpg`;

        const exhibit = document.createElement('div');
        exhibit.className = 'exhibit';
        exhibit.dataset.title     = art.title || "Untitled";
        exhibit.dataset.artist    = art.artist_title || "Unknown Artist";
        exhibit.dataset.altText   = art.thumbnail?.alt_text || "";
        exhibit.dataset.id        = art.id;
        exhibit.dataset.imageId   = art.image_id;
        exhibit.dataset.desc      = art.description || "";
        exhibit.dataset.location  = art.gallery_title || "Main Hallway";

        exhibit.innerHTML = `
            <div class="frame">
                <img
                    src="${imgUrl}"
                    alt="${art.title}"
                    loading="lazy"
                    onerror="this.style.background='#1a150a';this.style.minHeight='200px';"
                />
            </div>
            <div class="label-plate">
                <strong>${art.title || "Untitled"}</strong>
                <span>${art.artist_title || "Unknown"}</span>
                <button
                    class="view-details-btn"
                    onclick="goToDetails(this.closest('.exhibit'))"
                >
                    View Details
                </button>
            </div>
        `;

        hallway.appendChild(exhibit);
    });

    setupProximityDetection();
}

// ── Navigate to details page ─────────────────────────────────────────────
function goToDetails(exhibit) {
    const payload = {
        itemID:    exhibit.dataset.id,
        itemTitle: exhibit.dataset.title,
        artist:    exhibit.dataset.artist,
        altText:   exhibit.dataset.altText,
        image_id:  exhibit.dataset.imageId,
        description: exhibit.dataset.desc,
        location:  exhibit.dataset.location
    };
    sessionStorage.setItem("selected-item", JSON.stringify(payload));
    window.location.href = "artPieceDetails.html";
}

// ── Proximity detection ──────────────────────────────────────────────────
function setupProximityDetection() {
    const exhibits = document.querySelectorAll('.exhibit');

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                exhibits.forEach(el => el.classList.remove('active'));
                entry.target.classList.add('active');
                triggerTourGuide(entry.target.dataset);
            }
        });
    }, {
        root: document.querySelector('.gallery-wrapper'),
        rootMargin: '0px -35% 0px -35%',
        threshold: 0.5
    });

    exhibits.forEach(exhibit => observer.observe(exhibit));
}

// ── Tour guide narration ─────────────────────────────────────────────────
function triggerTourGuide(artData) {
    document.getElementById('guide-status').innerText =
        `"${artData.title}"`;
    document.getElementById('artwork-info').innerText =
        `By ${artData.artist}`;

    window.speechSynthesis.cancel();
    const script = `Here we have ${artData.title}, by ${artData.artist}. ${artData.altText}`;
    const utterance = new SpeechSynthesisUtterance(script);
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
}

// ── Pagination UI ────────────────────────────────────────────────────────
function updatePaginationUI(page) {
    document.getElementById('page-label').textContent =
        `Page ${page} of ${TOTAL_PAGES}`;
    document.getElementById('page-counter').textContent =
        `Gallery · Page ${page}`;
}

// Arrow buttons — loop back around
document.getElementById('prev-page').addEventListener('click', () => {
    currentPage = currentPage <= 1 ? TOTAL_PAGES : currentPage - 1;
    loadPage(currentPage);
});

document.getElementById('next-page').addEventListener('click', () => {
    currentPage = currentPage >= TOTAL_PAGES ? 1 : currentPage + 1;
    loadPage(currentPage);
});

// ── Boot ─────────────────────────────────────────────────────────────────
window.onload = () => loadPage(1);