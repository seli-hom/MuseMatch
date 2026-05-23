// Configuration
const API_URL = "https://api.artic.edu/api/v1/artworks/search?page=1&limit=25";
const IIIF_BASE = "https://www.artic.edu/iiif/2";

// 1. Fetch Artworks filtered by a specific period (e.g., Late 19th Century)
async function loadGalleryEra() {
    const hallway = document.getElementById('gallery-hallway');
    
    // Elasticsearch query payload matching data fields inside Art Institute database
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
        const imgUrl = `${IIIF_BASE}/${art.image_id}/full/,500/0/default.jpg`; // Capped height at 500px
        
        const exhibit = document.createElement('div');
        exhibit.className = 'exhibit';
        // Store metadata directly on DOM properties for the AI Guide to extract later
        exhibit.dataset.title = art.title;
        exhibit.dataset.artist = art.artist_title || "Unknown Artist";
        exhibit.dataset.altText = art.thumbnail?.alt_text || "";

        exhibit.innerHTML = `
            <div class="frame">
                <img src="${imgUrl}" alt="${art.title}">
            </div>
            <div class="label-plate">
                <strong>${art.title}</strong><br>
                <span>${art.artist_title || "Unknown"}</span>
            </div>
        `;
        
        hallway.appendChild(exhibit);
    });

    // Initialize detection systems once paintings are physically on the wall
    setupProximityDetection();
}

// 3. Proximity Tracking System using IntersectionObserver
function setupProximityDetection() {
    const exhibits = document.querySelectorAll('.exhibit');
    
    const observerOptions = {
        root: document.querySelector('.gallery-wrapper'),
        rootMargin: '0px -35% 0px -35%', // Strictly targets items passing through the center 30% window of screen
        threshold: 0.5
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // Remove focus markers from previous paintings
                exhibits.forEach(el => el.classList.remove('active'));
                
                // Active focus markers on current painting
                entry.target.classList.add('active');
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

    // Stop any speech currently running to avoid audio overlap
    window.speechSynthesis.cancel();

    // Construct the narration script
    // NOTE: In production, send this string payload to your backend LLM router first,
    // then feed the LLM text output into the SpeechSynthesis engine below!
    const narrationScript = `Here we have ${artData.title}, created by ${artData.artist}. Notice how the lighting draws your eye across the canvas. ${artData.altText}`;

    const utterance = new SpeechSynthesisUtterance(narrationScript);
    utterance.rate = 0.95; // Slightly slower, clean cadence mimicking a human curator
    
    window.speechSynthesis.speak(utterance);
}

// Launch application on window bootstrap
window.onload = loadGalleryEra;