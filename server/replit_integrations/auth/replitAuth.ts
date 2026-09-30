import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import connectPg from "connect-pg-simple";
import bcrypt from "bcryptjs";
import { authStorage } from "./storage";
import type { User } from "@shared/models/auth";

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000;
  const pgStore = connectPg(session);
  const sessionStore =
    process.env.NODE_ENV === "test" || process.env.LOCAL_DEMO === "true"
      ? undefined
      : new pgStore({
          conString: process.env.DATABASE_URL,
          createTableIfMissing: false,
          ttl: Math.floor(sessionTtl / 1000),
          tableName: "sessions",
        });
  return session({
    secret: process.env.SESSION_SECRET!,
    store:
      process.env.NODE_ENV === "test" || process.env.LOCAL_DEMO === "true"
        ? undefined
        : sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.SESSION_COOKIE_SECURE === "true",
      maxAge: sessionTtl,
    },
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(
      { usernameField: "email" },
      async (email, password, done) => {
        try {
          const user = await authStorage.getUserByEmail(
            email.toLowerCase().trim(),
          );
          if (!user)
            return done(null, false, {
              message: "Incorrect email or password.",
            });
          if (!user.passwordHash)
            return done(null, false, {
              message: "Incorrect email or password.",
            });
          const valid = await bcrypt.compare(password, user.passwordHash);
          if (!valid)
            return done(null, false, {
              message: "Incorrect email or password.",
            });
          return done(null, user);
        } catch (err) {
          return done(err);
        }
      },
    ),
  );

  passport.serializeUser((user: any, cb) => cb(null, (user as User).id));
  passport.deserializeUser(async (id: string, cb) => {
    try {
      const user = await authStorage.getUser(id);
      cb(null, user ?? false);
    } catch (err) {
      cb(err);
    }
  });

  // Register
  app.post("/api/auth/register", async (req, res) => {
    const { email, password, firstName, lastName } = req.body;
    if (
      !email ||
      typeof email !== "string" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      !password ||
      typeof password !== "string"
    )
      return res
        .status(400)
        .json({ message: "Email and password are required." });
    const reserved = (process.env.SUPER_ADMIN_EMAILS || "guglaniarjun")
      .split(",")
      .map((v) => v.trim().toLowerCase());
    if (reserved.includes(email.toLowerCase().trim()))
      return res
        .status(403)
        .json({
          message: "This account must be provisioned by the administrator.",
        });
    if (password.length < 10)
      return res
        .status(400)
        .json({ message: "Password must be at least 10 characters." });

    try {
      const existing = await authStorage.getUserByEmail(
        email.toLowerCase().trim(),
      );
      if (existing)
        return res
          .status(409)
          .json({ message: "An account with this email already exists." });

      const passwordHash = await bcrypt.hash(password, 12);
      const user = await authStorage.createUser({
        email: email.toLowerCase().trim(),
        firstName: firstName?.trim() || null,
        lastName: lastName?.trim() || null,
        passwordHash,
      });

      req.login(user, (err) => {
        if (err)
          return res
            .status(500)
            .json({ message: "Login after registration failed." });
        const { passwordHash: _, ...safe } = user;
        res.json({ ok: true, user: safe });
      });
    } catch (err) {
      console.error("Register error:", err);
      res
        .status(500)
        .json({ message: "Registration failed. Please try again." });
    }
  });

  // Login
  app.post("/api/auth/login", (req, res, next) => {
    passport.authenticate(
      "local",
      (err: any, user: User | false, info: any) => {
        if (err) return res.status(500).json({ message: "Login error." });
        if (!user)
          return res
            .status(401)
            .json({ message: info?.message ?? "Invalid credentials." });
        req.login(user, (loginErr) => {
          if (loginErr)
            return res.status(500).json({ message: "Session error." });
          const { passwordHash: _, ...safe } = user as any;
          res.json({ ok: true, user: safe });
        });
      },
    )(req, res, next);
  });

  // Logout
  app.post("/api/auth/logout", (req, res) => {
    req.logout(() => res.json({ ok: true }));
  });

  app.get("/api/login", (_req, res) => res.redirect("/login"));
  app.get("/api/logout", (req, res) => {
    req.logout(() => res.redirect("/login"));
  });
  app.get("/api/callback", (_req, res) => res.redirect("/login"));
}

export const isAuthenticated: RequestHandler = (req, res, next) => {
  if (req.isAuthenticated()) return next();
  res.status(401).json({ message: "Unauthorized" });
};
