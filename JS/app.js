// Configuration
const API_URL = "https://api.artic.edu/api/v1/artworks/search?page=1&limit=25";
const IIIF_BASE = "https://www.artic.edu/iiif/2";

// Active artwork tracked by the IntersectionObserver
let activeArtwork = null;

// 1. Fetch Artworks filtered by a specific period (e.g., Late 19th Century)
async function loadGalleryEra() {
    const queryPayload = {
        "resources": "artworks",
        "fields": ["id", "title", "artist_title", "image_id", "thumbnail"],
        "limit": 25,
        "query": {
            "bool": {
                "must": [
                    { "exists": { "field": "image_id" } },
                    { "range": { "date_start": { "gte": 1870, "lte": 1900 } } }
                ]
            }
        }
    };

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(queryPayload)
        });
        const result = await response.json();
        renderHallway(result.data);
    } catch (error) {
        console.error("Failed to gather museum data:", error);
    }
}

// 2. Generate HTML elements out of the API response array
function renderHallway(artworks) {
    const hallway = document.getElementById('gallery-hallway');

    artworks.forEach(art => {
        const imgUrl = `${IIIF_BASE}/${art.image_id}/full/,500/0/default.jpg`;

        const exhibit = document.createElement('div');
        exhibit.className = 'exhibit';
        exhibit.dataset.title = art.title;
        exhibit.dataset.artist = art.artist_title || "Unknown Artist";
        exhibit.dataset.altText = art.thumbnail?.alt_text || "";
        exhibit.dataset.imageId = art.image_id || "";
        exhibit.dataset.artId = art.id || "";

        exhibit.innerHTML = `
            <div class="frame">
                <img src="${imgUrl}" alt="${art.title}">
            </div>
            <div class="label-plate">
                <strong>${art.title}</strong><br>
                <span>${art.artist_title || "Unknown"}</span>
            </div>
            <button class="request-btn">Request Artwork</button>
        `;

        exhibit.querySelector('.request-btn').addEventListener('click', () => openRequestModal(exhibit.dataset));

        hallway.appendChild(exhibit);
    });

    setupProximityDetection();
    setupModal();
}

// 3. Proximity Tracking System using IntersectionObserver
function setupProximityDetection() {
    const exhibits = document.querySelectorAll('.exhibit');

    const observerOptions = {
        root: document.querySelector('.gallery-wrapper'),
        rootMargin: '0px -35% 0px -35%',
        threshold: 0.5
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                exhibits.forEach(el => el.classList.remove('active'));
                entry.target.classList.add('active');
                activeArtwork = entry.target.dataset;
                triggerTourGuide(entry.target.dataset);
            }
        });
    }, observerOptions);

    exhibits.forEach(exhibit => observer.observe(exhibit));
}

// 4. Hook up the AI Tour Guide Audio System
function triggerTourGuide(artData) {
    const statusText = document.getElementById('guide-status');
    const infoText = document.getElementById('artwork-info');

    statusText.innerText = `Tour Guide approaching: "${artData.title}"`;
    infoText.innerText = `By ${artData.artist}.`;

    window.speechSynthesis.cancel();

    const narrationScript = `Here we have ${artData.title}, created by ${artData.artist}. Notice how the lighting draws your eye across the canvas. ${artData.altText}`;
    const utterance = new SpeechSynthesisUtterance(narrationScript);
    utterance.rate = 0.95;
    window.speechSynthesis.speak(utterance);
}

// 5. Request Modal
function setupModal() {
    document.getElementById('modal-close-btn').addEventListener('click', closeRequestModal);
    document.getElementById('request-modal').addEventListener('click', (e) => {
        if (e.target === document.getElementById('request-modal')) closeRequestModal();
    });
    document.getElementById('modal-submit-btn').addEventListener('click', submitRequest);
}

function openRequestModal(artData) {
    const session = Auth.getSession();
    if (!session) {
        window.location.href = 'login.html';
        return;
    }

    document.getElementById('modal-art-title').textContent = `"${artData.title}" by ${artData.artist}`;
    document.getElementById('modal-error').style.display = 'none';

    const modal = document.getElementById('request-modal');
    modal.dataset.artTitle = artData.title;
    modal.dataset.artArtist = artData.artist;
    modal.dataset.artImageId = artData.imageId;
    modal.dataset.artId = artData.artId;

    modal.style.display = 'flex';
}

function closeRequestModal() {
    document.getElementById('request-modal').style.display = 'none';
}

async function submitRequest() {
    const session = Auth.getSession();
    if (!session) { window.location.href = 'login.html'; return; }

    const modal = document.getElementById('request-modal');
    const budget = document.getElementById('modal-budget').value;
    const errorEl = document.getElementById('modal-error');

    try {
        const res = await fetch('http://localhost:3000/api/request', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                userEmail: session.email,
                artwork: {
                    id: modal.dataset.artId,
                    title: modal.dataset.artTitle,
                    artist: modal.dataset.artArtist,
                    imageId: modal.dataset.artImageId,
                },
                budget,
            }),
        });

        const data = await res.json();
        if (!res.ok) {
            errorEl.textContent = data.error;
            errorEl.style.display = 'block';
            return;
        }

        closeRequestModal();
        showToast(`Request sent for "${modal.dataset.artTitle}"!`);
    } catch {
        errorEl.textContent = 'Could not connect to the server.';
        errorEl.style.display = 'block';
    }
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'gallery-toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.classList.add('toast-visible'), 10);
    setTimeout(() => {
        toast.classList.remove('toast-visible');
        setTimeout(() => toast.remove(), 400);
    }, 3000);
}

window.onload = loadGalleryEra;
