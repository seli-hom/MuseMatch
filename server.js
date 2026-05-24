require("dotenv").config();

const express = require("express");
const bcrypt = require("bcryptjs");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const Anthropic = require("@anthropic-ai/sdk");

const app = express();
const PORT = 3000;

const USERS_FILE = path.join(__dirname, "users.json");
const REQUESTS_FILE = path.join(__dirname, "requested_art.json");
const UPLOADS_DIR = path.join(__dirname, "uploads");

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR);

const upload = multer({ dest: UPLOADS_DIR });
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── JSON helpers ──────────────────────────────────────────────────────────────
function readUsers() {
    if (!fs.existsSync(USERS_FILE)) return { users: [] };
    return JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
}
function writeUsers(data) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(data, null, 2));
}

function readRequests() {
    if (!fs.existsSync(REQUESTS_FILE)) return { requests: [] };
    return JSON.parse(fs.readFileSync(REQUESTS_FILE, "utf8"));
}
function writeRequests(data) {
    fs.writeFileSync(REQUESTS_FILE, JSON.stringify(data, null, 2));
}

// ── Migration: give existing users the "viewer" role if missing ───────────────
(function migrateUsers() {
    const db = readUsers();
    let changed = false;
    db.users.forEach((u) => {
        if (!u.role) { u.role = "viewer"; changed = true; }
    });
    if (changed) writeUsers(db);
})();

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));
app.use("/uploads", express.static(UPLOADS_DIR));

// ── POST /api/register ────────────────────────────────────────────────────────
app.post("/api/register", (req, res) => {
    const { firstName, lastName, email, phone, password, role } = req.body;

    if (!firstName || !lastName || !email || !password) {
        return res.status(400).json({ error: "All fields are required." });
    }

    const validRoles = ["artist", "viewer"];
    const assignedRole = validRoles.includes(role) ? role : "viewer";

    const db = readUsers();
    if (db.users.find((u) => u.email === email)) {
        return res.status(409).json({ error: "An account with this email already exists." });
    }

    const hash = bcrypt.hashSync(password, 10);
    db.users.push({ firstName, lastName, email, phone: phone || "", password: hash, role: assignedRole });
    writeUsers(db);

    res.status(201).json({ success: true });
});

// ── POST /api/login ───────────────────────────────────────────────────────────
app.post("/api/login", (req, res) => {
    const { email, password } = req.body;

    const db = readUsers();
    const user = db.users.find((u) => u.email === email);

    if (!user || !bcrypt.compareSync(password, user.password)) {
        return res.status(401).json({ error: "Invalid email or password." });
    }

    res.json({
        success: true,
        user: {
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName,
            phone: user.phone,
            role: user.role,
        },
    });
});

// ── POST /api/request ─────────────────────────────────────────────────────────
app.post("/api/request", (req, res) => {
    const { userEmail, artwork, budget } = req.body;

    if (!userEmail || !artwork || !budget) {
        return res.status(400).json({ error: "Missing required fields." });
    }

    const db = readUsers();
    const user = db.users.find((u) => u.email === userEmail);
    if (!user) return res.status(404).json({ error: "User not found." });

    const requests = readRequests();
    const newRequest = {
        id: Date.now().toString(),
        artwork: {
            id: artwork.id || "",
            title: artwork.title,
            artist: artwork.artist,
            imageId: artwork.imageId || "",
        },
        viewer: {
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            phone: user.phone,
        },
        budget,
        status: "pending",
        requestedAt: new Date().toISOString(),
        completedAt: null,
        completedImagePath: null,
        similarityScore: null,
    };

    requests.requests.push(newRequest);
    writeRequests(requests);

    res.status(201).json({ success: true, request: newRequest });
});

// ── GET /api/requests ─────────────────────────────────────────────────────────
app.get("/api/requests", (req, res) => {
    const data = readRequests();
    res.json(data.requests);
});

// ── POST /api/requests/:id/complete ──────────────────────────────────────────
app.post("/api/requests/:id/complete", upload.single("completedImage"), async (req, res) => {
    const { id } = req.params;
    const data = readRequests();
    const request = data.requests.find((r) => r.id === id);

    if (!request) return res.status(404).json({ error: "Request not found." });

    request.status = "completed";
    request.completedAt = new Date().toISOString();
    request.completedImagePath = req.file ? `/uploads/${req.file.filename}` : null;
    request.similarityScore = null;

    // Compare images with Claude if we have both
    if (req.file && request.artwork.imageId) {
        try {
            const originalUrl = `https://www.artic.edu/iiif/2/${request.artwork.imageId}/full/,600/0/default.jpg`;

            // Fetch original from Art Institute
            const originalRes = await fetch(originalUrl);
            if (!originalRes.ok) throw new Error("Could not fetch original image");
            const originalBuffer = Buffer.from(await originalRes.arrayBuffer());
            const originalBase64 = originalBuffer.toString("base64");

            // Read uploaded image
            const uploadedBuffer = fs.readFileSync(req.file.path);
            const uploadedBase64 = uploadedBuffer.toString("base64");
            const uploadedMime = req.file.mimetype || "image/jpeg";

            const message = await anthropic.messages.create({
                model: "claude-opus-4-7",
                max_tokens: 16,
                messages: [
                    {
                        role: "user",
                        content: [
                            {
                                type: "image",
                                source: { type: "base64", media_type: "image/jpeg", data: originalBase64 },
                            },
                            {
                                type: "image",
                                source: { type: "base64", media_type: uploadedMime, data: uploadedBase64 },
                            },
                            {
                                type: "text",
                                text: "can you compare these 2 images and only give me back ONLY a pourcentage of similarity",
                            },
                        ],
                    },
                ],
            });

            const raw = message.content[0]?.text || "";
            const match = raw.match(/\d+(\.\d+)?/);
            if (match) request.similarityScore = parseFloat(match[0]);
        } catch (err) {
            console.error("Image comparison failed:", err.message);
        }
    }

    writeRequests(data);
    res.json({ success: true, request });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`MuseMatch running → http://localhost:${PORT}/htmlTemplates/gallery.html`);
});
