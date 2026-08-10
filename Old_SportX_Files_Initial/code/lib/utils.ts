import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Conditionally compose Tailwind classes — merges duplicates safely. */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
