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
        const session = this.getSession();
        return session && session.role === "artist";
    },

    updateNav() {
        const session = this.getSession();
        const navActions = document.querySelector(".nav-actions");
        if (!navActions) return;
        if (session) {
            const requestsLink = session.role === "artist"
                ? `<a href="requests.html" class="btn-gallery btn-gallery-solid">Requests</a>`
                : "";
            navActions.innerHTML = `
                <span class="nav-user">Hi, ${session.firstName}</span>
                ${requestsLink}
                <button onclick="Auth.logout()" class="btn-gallery btn-gallery-outline">Logout</button>
            `;
        } else {
            navActions.innerHTML = `
                <a href="login.html" class="btn-gallery btn-gallery-outline">Login</a>
                <a href="register.html" class="btn-gallery btn-gallery-solid">Register</a>
            `;
        }
    },
};
