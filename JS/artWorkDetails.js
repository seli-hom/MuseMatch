import { FetchWrapper } from "./fetchWrapper.js";

// ── Constants ─────────────────────────────────────────────────────────────────
const IIIF_BASE       = "https://www.artic.edu/iiif/2";
const ART_API         = "https://api.artic.edu/api/v1";

// !! Update this to match your server setup !!
const GALLERY_API_BASE = "http://localhost/gallery-api/v1";

const artInstituteAPI = new FetchWrapper(ART_API);

// ── Main init ─────────────────────────────────────────────────────────────────
export function initProductDetails() {

    // DOM refs
    const artPieceName      = document.querySelector("#art-piece-name");
    const artistName        = document.querySelector("#artist-name");
    const desc              = document.querySelector("#desc");
    const galleryLocation   = document.querySelector("#gallery-location");
    const img               = document.querySelector("#artwork-img");
    const artDetailsText    = document.querySelector("#art-details-text");
    const artistDetailsText = document.querySelector("#artist-details-text");
    const commissionBtn     = document.querySelector("#commission-btn");
    const formStatus        = document.querySelector("#form-status");

    // Pull selected artwork payload dropped by gallery page
    const data = JSON.parse(sessionStorage.getItem("selected-item"));

    if (!data) {
        if (artPieceName) artPieceName.textContent = "No artwork selected";
        if (desc) desc.textContent = "Please return to the gallery and select a piece.";
        console.warn("No artwork data found in sessionStorage.");
        return;
    }

    // ── Populate static fields from sessionStorage payload ────────────────
    artPieceName.textContent    = data.itemTitle  || "Untitled";
    artistName.textContent      = data.artist     || "Unknown Artist";
    desc.textContent            = data.description || "No overview provided for this piece.";
    galleryLocation.textContent = data.location   || "Main Hallway Display";

    // IIIF image — prefer high-res reconstruction, fallback to thumbnail
    if (data.image_id) {
        img.src = `${IIIF_BASE}/${data.image_id}/full/843,/0/default.jpg`;
        img.alt = data.itemTitle || "Artwork";
    } else if (data.thumbnail) {
        img.src = data.thumbnail;
    }

    // Alt-text into art details panel
    if (data.altText) {
        artDetailsText.textContent = data.altText;
    }

    // ── Enrich artist bio from Art Institute agents endpoint ──────────────
    if (data.artist) {
        enrichArtistDetails(data.artist, artistDetailsText);
    }

    // ── Enrich artwork type from Art Institute artworks endpoint ──────────
    // (used later when POSTing to requested-pieces)
    if (data.itemID) {
        enrichArtworkType(data);
    }

    // ── Wire commission button ─────────────────────────────────────────────
    commissionBtn.addEventListener("click", () =>
        handleCommission(data, formStatus)
    );
}

// ── Fetch artist bio ──────────────────────────────────────────────────────────
async function enrichArtistDetails(artist, targetEl) {
    try {
        const res  = await fetch(`${ART_API}/agents/search?q=${encodeURIComponent(artist)}&limit=1`);
        const json = await res.json();
        const agent = json.data?.[0];
        if (agent) {
            const born = agent.birth_date  ? `b. ${agent.birth_date}` : null;
            const died = agent.death_date  ? `d. ${agent.death_date}` : null;
            const dates = [born, died].filter(Boolean).join(", ");
            targetEl.textContent =
                agent.description ||
                `${agent.title || artist}${dates ? " (" + dates + ")" : ""}.`;
        }
    } catch (_) {
        // silently leave placeholder text
    }
}

// ── Enrich artwork_type and cache it onto the data object ─────────────────────
async function enrichArtworkType(data) {
    try {
        const res  = await fetch(
            `${ART_API}/artworks/${data.itemID}?fields=title,artist_title,artwork_type_title`
        );
        const json = await res.json();
        if (json.data) {
            // Write enriched values back so handleCommission can read them
            data._enrichedTitle  = json.data.title              || data.itemTitle;
            data._enrichedArtist = json.data.artist_title       || data.artist;
            data._enrichedType   = json.data.artwork_type_title || "Painting";
        }
    } catch (_) {
        // defaults will be used in handleCommission
    }
}

// ── Commission flow ───────────────────────────────────────────────────────────
//
//  The gallery API's /login route (POST /login) returns:
//    { status: "success", message: "Login was approved" }   on success
//    { status: "failure", message: "Invalid credentials" }  on failure  (HTTP 400)
//
//  There is no user id in the login response, so we do a two-step:
//    1. POST /login  → verify credentials
//    2. GET  /login  → not available; instead we stored the viewer_id in
//       sessionStorage at registration time (see register.html) OR we
//       ask the user to confirm their id. As a pragmatic fallback we
//       pass viewer_id = null and let the DB use its default / FK rule.
//
//  If you add a GET /users?email=... route later, swap step 2 below.
//
async function handleCommission(artData, statusEl) {
    const email    = document.querySelector("#login-email")?.value?.trim();
    const password = document.querySelector("#login-password")?.value;

    if (!email || !password) {
        showStatus(statusEl, "Please enter your email and password.", "error");
        return;
    }

    showStatus(statusEl, "Verifying credentials...", "");

    try {
        // ── Step 1: Authenticate against gallery API ──────────────────────
        // Route: POST /login   (routes.php line: $app->post('/login', ...))
        const loginRes = await fetch(`${GALLERY_API_BASE}/login`, {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ email, password })
        });

        const loginData = await loginRes.json().catch(() => ({}));

        // The controller returns HTTP 400 + { status:"failure" } on bad credentials
        if (!loginRes.ok || loginData.status === "failure") {
            showStatus(
                statusEl,
                loginData.message || "Invalid credentials. Please try again or register.",
                "error"
            );
            return;
        }

        // ── Step 2: Retrieve viewer_id ────────────────────────────────────
        // /login response does not include the user id.
        // We read a cached id stored by register.html, or fall back to null.
        const cachedUserId = sessionStorage.getItem("gallery-user-id")
            ? parseInt(sessionStorage.getItem("gallery-user-id"), 10)
            : null;

        showStatus(statusEl, "Submitting commission request...", "");

        // ── Step 3: Resolve final artwork metadata ────────────────────────
        const artTitle    = artData._enrichedTitle  || artData.itemTitle || "Unknown";
        const artistTitle = artData._enrichedArtist || artData.artist    || "Unknown";
        const artType     = artData._enrichedType   || "Painting";

        // ── Step 4: POST to requested-pieces ─────────────────────────────
        // Route: POST /requested-pieces/   (routes.php group '/requested-pieces')
        // DB columns: art_piece_name, artist_name, artwork_type, viewer_id, is_selected
        const commissionPayload = {
            art_piece_name: artTitle,
            artist_name:    artistTitle,
            artwork_type:   artType,
            is_selected:    0           // TINYINT / boolean false
        };

        // Only include viewer_id if we have it — avoids FK violation on null
        if (cachedUserId !== null) {
            commissionPayload.viewer_id = cachedUserId;
        }

        const commissionRes = await fetch(`${GALLERY_API_BASE}/requested-pieces/`, {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify(commissionPayload)
        });

        const commissionData = await commissionRes.json().catch(() => ({}));

        if (!commissionRes.ok || commissionData.status === "failure") {
            showStatus(
                statusEl,
                commissionData.message || "Could not submit commission. Please try again.",
                "error"
            );
            return;
        }

        showStatus(
            statusEl,
            "Your commission request has been submitted successfully.",
            "success"
        );

    } catch (err) {
        console.error("Commission error:", err);
        showStatus(statusEl, "A network error occurred. Please check your connection.", "error");
    }
}

// ── Helper ────────────────────────────────────────────────────────────────────
function showStatus(el, message, type) {
    el.textContent   = message;
    el.className     = type;          // matches CSS: .error / .success / ""
    el.style.display = "block";
}

// ── Boot ──────────────────────────────────────────────────────────────────────
initProductDetails();