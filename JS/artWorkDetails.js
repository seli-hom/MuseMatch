import { FetchWrapper } from "./fetchWrapper.js";

// Initialize the wrapper with the base API endpoint domain
const artInstituteAPI = new FetchWrapper("https://api.artic.edu/api/v1");
const galleryUsersAPI = new FetchWrapper("")
let catalog = [];

async function setCatalog() {
    try {
        // Utilizing your FetchWrapper get method cleanly
        const response = await artInstituteAPI.get("/artworks/search?page=1&limit=25");
        catalog = response.data;
        console.log("Museum Catalog Loaded:", catalog);
    } catch (error) {
        console.error("Could not populate catalog background cache:", error);
    }
}

export function initProductDetails() {
    // 1. Fetch catalog data silently in the background if needed
    setCatalog();
    
    // 2. Query target DOM nodes using the exact IDs inside your HTML file
    const artPieceName = document.querySelector("#art-piece-name");
    const artistName = document.querySelector("#artist-name");
    const desc = document.querySelector("#desc");
    const galleryLocation = document.querySelector("#gallery-location");
    const img = document.querySelector("#artwork-img");
    
    const artDetailsText = document.querySelector("#art-details-text");
    const artistDetailsText = document.querySelector("#artist-details-text");
    const addBtn = document.getElementById("detail-btn");

    // 3. Read the shared payload dropped into sessionStorage from the main gallery page
    const data = JSON.parse(sessionStorage.getItem("selected-item"));

    if (!data) {
        console.warn("No artwork data found in sessionStorage. Walk through the gallery first.");
        return;
    }

    // 4. Map the API payload structure straight to your layout fields
    artPieceName.textContent = data.itemTitle || "Untitled";
    artistName.textContent = data.artist || "Unknown Artist";
    desc.textContent = data.description || "No overview statement provided for this piece.";
    
    // Display location markers or gallery room assignments if available
    galleryLocation.textContent = data.location || "Main Hallway Display";

    // 5. Handle IIIF image reconstruction if an image_id was provided
    if (data.image_id) {
        img.src = `https://www.artic.edu/iiif/2/${data.image_id}/full/843,/0/default.jpg`;
        img.alt = data.itemTitle;
    } else if (data.thumbnail) {
        // Fallback to absolute image configurations if passed manually
        img.src = data.thumbnail;
    }

    // 6. Enrich secondary museum text panels if alt descriptive texts are supplied
    if (data.altText) {
        artDetailsText.textContent = data.altText;
    }

    // 7. Configure interactive action button tracking indices
    addBtn.setAttribute("data-item-id", data.itemID);
    
    // Remove previous listeners cleanly if reinvoked
    const cloneBtn = addBtn.cloneNode(true);
    addBtn.parentNode.replaceChild(cloneBtn, addBtn);

    cloneBtn.addEventListener("click", (event) => {
        const itemNo = event.target.getAttribute("data-item-id");
        console.log(`Action triggered for artwork index registration: ${itemNo}`);
        // If your separate layout files require addToCart processing, trigger here:
        // addToCart(itemNo, catalog);
    });    
}