import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";

export interface AuthRequest extends Request {
  user?: { id: string; role: string };
}

export function requireAuth(req: any, res: any, next: any) {
  const header = req.headers["authorization"] as string | undefined;
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Missing Authorization header" });
  }
  const token = header.slice("Bearer ".length);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.user = { id: decoded.sub, role: decoded.role };
    return next();
  } catch {
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}
