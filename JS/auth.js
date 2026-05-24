const SESSION_KEY = "museMatch_session";
const API_BASE = "http://localhost:3000/api";

const Auth = {
    async register(firstName, lastName, email, phone, password, role) {
        const res = await fetch(`${API_BASE}/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ firstName, lastName, email, phone, password, role }),
        });
        const data = await res.json();
        if (!res.ok) return { success: false, error: data.error };
        return { success: true };
    },

    async login(email, password) {
        const res = await fetch(`${API_BASE}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
        });
        const data = await res.json();
        if (!res.ok) return { success: false, error: data.error };
        sessionStorage.setItem(SESSION_KEY, JSON.stringify(data.user));
        return { success: true, user: data.user };
    },

    logout() {
        sessionStorage.removeItem(SESSION_KEY);
        window.location.href = "login.html";
    },

    getSession() {
        const raw = sessionStorage.getItem(SESSION_KEY);
        return raw ? JSON.parse(raw) : null;
    },

    isLoggedIn() {
        return !!this.getSession();
    },

    isArtist() {
        const s = this.getSession();
        return s && s.role === "artist";
    },

    updateNav() {
        const session = this.getSession();
        const container = document.getElementById("rail-auth");
        if (!container) return;
        if (session) {
            const commissionsLink = session.role === "artist"
                ? `<a class="rail-link" href="requests.html">Commissions</a>`
                : "";
            container.innerHTML = `
                <span class="rail-username">${session.firstName} ${session.lastName}</span>
                ${commissionsLink}
                <button class="rail-link rail-link-btn" onclick="Auth.logout()">Sign Out</button>
            `;
        } else {
            container.innerHTML = `
                <a class="rail-link" href="login.html">Sign In</a>
                <a class="rail-link" href="register.html">Register</a>
            `;
        }
    },
};

// Expose globally so ES module scripts can access it
window.Auth = Auth;
