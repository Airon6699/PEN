
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const root = __dirname;
const database = path.join(root, "users.json");
const sessions = new Map();
const port = 3000;

if (!fs.existsSync(database)) {
    fs.writeFileSync(database, "[]");
}

function readUsers() {
    return JSON.parse(fs.readFileSync(database, "utf8"));
}

function saveUsers(users) {
    fs.writeFileSync(database, JSON.stringify(users, null, 2));
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
    const hash = crypto.scryptSync(password, salt, 64).toString("hex");
    return { salt, hash };
}

function send(res, status, data) {
    res.writeHead(status, {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store"
    });
    res.end(JSON.stringify(data));
}

function getBody(req) {
    return new Promise((resolve, reject) => {
        let body = "";

        req.on("data", chunk => {
            body += chunk;

            if (body.length > 10000) {
                reject(new Error("Request too large"));
                req.destroy();
            }
        });

        req.on("end", () => {
            try {
                resolve(JSON.parse(body || "{}"));
            } catch {
                reject(new Error("Invalid JSON"));
            }
        });

        req.on("error", reject);
    });
}

function getSession(req) {
    const cookies = req.headers.cookie || "";
    const match = cookies.match(/(?:^|;\s*)sid=([a-f0-9]+)/);
    return match ? sessions.get(match[1]) : null;
}

const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);

    try {
        if (req.method === "POST" && url.pathname === "/api/register") {
            const { username, email, password } = await getBody(req);
            const name = String(username || "").trim();
            const mail = String(email || "").trim().toLowerCase();

            if (name.length < 3 || name.length > 24) {
                return send(res, 400, { error: "Username must be 3–24 characters." });
            }

            if (!/^[a-zA-Z0-9_]+$/.test(name)) {
                return send(res, 400, { error: "Use letters, numbers and underscores in your username." });
            }

            if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail) || mail.length > 254) {
                return send(res, 400, { error: "Enter a valid email address." });
            }

            if (typeof password !== "string" || password.length < 8 || password.length > 128) {
                return send(res, 400, { error: "Password must be 8–128 characters." });
            }

            const users = readUsers();

            if (users.some(user => user.username.toLowerCase() === name.toLowerCase())) {
                return send(res, 409, { error: "Username already exists." });
            }

            if (users.some(user => user.email === mail)) {
                return send(res, 409, { error: "Email already registered." });
            }

            const credentials = hashPassword(password);
            const user = {
                id: crypto.randomUUID(),
                username: name,
                email: mail,
                salt: credentials.salt,
                passwordHash: credentials.hash,
                createdAt: new Date().toISOString()
            };

            users.push(user);
            saveUsers(users);

            const sid = crypto.randomBytes(32).toString("hex");
            sessions.set(sid, user.id);

            res.setHeader("Set-Cookie", `sid=${sid}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400`);
            return send(res, 201, {
                message: "Account created successfully.",
                user: { username: name, email: mail }
            });
        }

        if (req.method === "POST" && url.pathname === "/api/login") {
            const { username, password } = await getBody(req);
            const name = String(username || "").trim();

            if (name.length > 254 || typeof password !== "string" || password.length > 128) {
                return send(res, 400, { error: "Invalid username or password." });
            }

            const users = readUsers();
            const user = users.find(item =>
                item.username.toLowerCase() === name.toLowerCase() ||
                item.email === name.toLowerCase()
            );

            if (!user || !user.salt || !user.passwordHash) {
                return send(res, 401, { error: "Incorrect username or password." });
            }

            const hash = hashPassword(password, user.salt).hash;
            const a = Buffer.from(hash, "hex");
            const b = Buffer.from(user.passwordHash, "hex");

            if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
                return send(res, 401, { error: "Incorrect username or password." });
            }

            const sid = crypto.randomBytes(32).toString("hex");
            sessions.set(sid, user.id);

            res.setHeader("Set-Cookie", `sid=${sid}; HttpOnly; SameSite=Strict; Path=/; Max-Age=86400`);
            return send(res, 200, {
                message: "Signed in successfully.",
                user: { username: user.username, email: user.email }
            });
        }

        if (req.method === "GET" && url.pathname === "/api/me") {
            const id = getSession(req);
            const user = id && readUsers().find(item => item.id === id);

            if (!user) return send(res, 401, { error: "Not signed in." });

            return send(res, 200, {
                user: { username: user.username, email: user.email }
            });
        }

        if (req.method === "POST" && url.pathname === "/api/logout") {
            const cookies = req.headers.cookie || "";
            const match = cookies.match(/(?:^|;\s*)sid=([a-f0-9]+)/);

            if (match) sessions.delete(match[1]);

            res.setHeader("Set-Cookie", "sid=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0");
            return send(res, 200, { message: "Signed out." });
        }

        if (url.pathname.startsWith("/api/")) {
            return send(res, 404, { error: "API route not found." });
        }

        const routes = {
            "/": "index.html",
            "/index.html": "index.html",
            "/style.css": "style.css",
            "/script.js": "script.js"
        };

        const file = routes[url.pathname];

        if (!file) {
            res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
            return res.end("404 — Not found");
        }

        const types = {
            ".html": "text/html; charset=utf-8",
            ".css": "text/css; charset=utf-8",
            ".js": "text/javascript; charset=utf-8"
        };

        res.writeHead(200, {
            "Content-Type": types[path.extname(file)]
        });
        fs.createReadStream(path.join(root, file)).pipe(res);
    } catch (error) {
        if (!res.headersSent) {
            send(res, 500, {
                error: error.message === "Invalid JSON"
                    ? "Invalid request data."
                    : "Server error."
            });
        }
    }
});

server.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
