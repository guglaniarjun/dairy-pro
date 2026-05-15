import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import bcrypt from "bcryptjs";
import { authStorage } from "./storage";
import type { User } from "@shared/models/auth";

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000;
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: sessionTtl,
    },
  });
}

const getCallbackDomain = (req: any): string => {
  const replitDomains = process.env.REPLIT_DOMAINS;
  if (replitDomains) return replitDomains.split(",")[0].trim();
  return req.hostname;
};

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  // ── Local (email/password) strategy ────────────────────────────────────────
  passport.use(
    new LocalStrategy({ usernameField: "email" }, async (email, password, done) => {
      try {
        const user = await authStorage.getUserByEmail(email.toLowerCase().trim());
        if (!user) return done(null, false, { message: "No account found with that email." });
        if (!user.passwordHash) return done(null, false, { message: "This account uses Google sign-in. Please log in with Google." });
        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return done(null, false, { message: "Incorrect password." });
        return done(null, user);
      } catch (err) {
        return done(err);
      }
    })
  );

  // ── Google OAuth strategy ───────────────────────────────────────────────────
  const googleClientId = process.env.GOOGLE_CLIENT_ID;
  const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (googleClientId && googleClientSecret) {
    const callbackURL = process.env.REPLIT_DOMAINS
      ? `https://${process.env.REPLIT_DOMAINS.split(",")[0].trim()}/api/auth/google/callback`
      : `http://localhost:5000/api/auth/google/callback`;

    passport.use(
      new GoogleStrategy(
        {
          clientID: googleClientId,
          clientSecret: googleClientSecret,
          callbackURL,
        },
        async (_accessToken, _refreshToken, profile, done) => {
          try {
            const email = profile.emails?.[0]?.value;
            let user: User | undefined;

            user = await authStorage.getUserByGoogleId(profile.id);
            if (!user && email) {
              user = await authStorage.getUserByEmail(email);
              if (user) {
                user = await authStorage.updateUser(user.id, { googleId: profile.id });
              }
            }
            if (!user) {
              user = await authStorage.createUser({
                email: email ?? null,
                firstName: profile.name?.givenName ?? profile.displayName,
                lastName: profile.name?.familyName ?? null,
                profileImageUrl: profile.photos?.[0]?.value ?? null,
                googleId: profile.id,
              });
            }
            return done(null, user);
          } catch (err) {
            return done(err as Error);
          }
        }
      )
    );
  }

  passport.serializeUser((user: any, cb) => cb(null, (user as User).id));
  passport.deserializeUser(async (id: string, cb) => {
    try {
      const user = await authStorage.getUser(id);
      cb(null, user ?? false);
    } catch (err) {
      cb(err);
    }
  });

  // ── Register ────────────────────────────────────────────────────────────────
  app.post("/api/auth/register", async (req, res) => {
    const { email, password, firstName, lastName } = req.body;
    if (!email || !password) return res.status(400).json({ message: "Email and password are required." });
    if (password.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters." });

    try {
      const existing = await authStorage.getUserByEmail(email.toLowerCase().trim());
      if (existing) return res.status(409).json({ message: "An account with this email already exists." });

      const passwordHash = await bcrypt.hash(password, 12);
      const user = await authStorage.createUser({
        email: email.toLowerCase().trim(),
        firstName: firstName?.trim() || null,
        lastName: lastName?.trim() || null,
        passwordHash,
      });

      req.login(user, (err) => {
        if (err) return res.status(500).json({ message: "Login after registration failed." });
        res.json({ ok: true, user: sanitize(user) });
      });
    } catch (err) {
      console.error("Register error:", err);
      res.status(500).json({ message: "Registration failed. Please try again." });
    }
  });

  // ── Login ───────────────────────────────────────────────────────────────────
  app.post("/api/auth/login", (req, res, next) => {
    passport.authenticate("local", (err: any, user: User | false, info: any) => {
      if (err) return res.status(500).json({ message: "Login error." });
      if (!user) return res.status(401).json({ message: info?.message ?? "Invalid credentials." });
      req.login(user, (loginErr) => {
        if (loginErr) return res.status(500).json({ message: "Session error." });
        res.json({ ok: true, user: sanitize(user) });
      });
    })(req, res, next);
  });

  // ── Google OAuth ────────────────────────────────────────────────────────────
  app.get("/api/auth/google", (req, res, next) => {
    if (!googleClientId || !googleClientSecret) {
      return res.status(501).json({ message: "Google login is not configured." });
    }
    passport.authenticate("google", { scope: ["profile", "email"] })(req, res, next);
  });

  app.get("/api/auth/google/callback", (req, res, next) => {
    passport.authenticate("google", {
      successRedirect: "/",
      failureRedirect: "/login?error=google_failed",
    })(req, res, next);
  });

  // ── Logout ──────────────────────────────────────────────────────────────────
  app.post("/api/auth/logout", (req, res) => {
    req.logout(() => res.json({ ok: true }));
  });

  // Backward-compat redirect
  app.get("/api/login", (_req, res) => res.redirect("/login"));
  app.get("/api/logout", (req, res) => {
    req.logout(() => res.redirect("/login"));
  });

  // ── Callback kept for any residual OIDC redirect ───────────────────────────
  app.get("/api/callback", (_req, res) => res.redirect("/login"));
}

function sanitize(user: User) {
  const { passwordHash, ...safe } = user;
  return safe;
}

export const isAuthenticated: RequestHandler = (req, res, next) => {
  if (req.isAuthenticated()) return next();
  res.status(401).json({ message: "Unauthorized" });
};
