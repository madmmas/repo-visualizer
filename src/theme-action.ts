"use server";

import { cookies } from "next/headers";
import { themeCookie, type Theme } from "@/theme";

export async function setTheme(theme: Theme) {
  if (theme !== "system" && theme !== "light" && theme !== "dark") {
    throw new Error("Unknown theme");
  }

  const jar = await cookies();
  jar.set(themeCookie, theme, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
}
