import { Router } from "express";

const router = Router();

router.get("/", (_req, res) => {
  res.send("Hello from Express + TypeScript! Some extra text");
});

router.get("/health", (_req, res) => {
  res.status(200).json({ status: "healthy" });
});

export default router;
