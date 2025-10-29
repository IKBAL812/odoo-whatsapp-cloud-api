"use client";

import { useEffect } from "react";
import { useTheme } from "../hooks/use-theme";

export default function ThemeWrapper() {
  const { theme } = useTheme();

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  return null;
}
