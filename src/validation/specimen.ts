import { z } from "zod";
export const specimenTitle = z
  .string()
  .trim()
  .min(1, "Enter a specimen name.")
  .max(60, "Use 60 characters or fewer.");
