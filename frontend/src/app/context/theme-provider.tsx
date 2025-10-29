import {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useMemo,
  useEffect,
  useState,
} from "react";

type Theme = "dark" | "light";

type ThemeContextValue = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

const DEFAULT_THEME: Theme = "dark";
const STORAGE_KEY = "app.theme";

export function ThemeProvider({ children }: PropsWithChildren) {
  const [theme, setTheme] = useState<Theme>(DEFAULT_THEME);
  const [isInitialized, setIsInitialized] = useState(false);

  // Load theme from localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const stored = window.localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (stored && (stored === "dark" || stored === "light")) {
      setTheme(stored);
    }
    setIsInitialized(true);
  }, []);

  // Save theme to localStorage and update document attribute
  useEffect(() => {
    if (!isInitialized) {
      return;
    }
    if (typeof window !== "undefined") {
      window.localStorage.setItem(STORAGE_KEY, theme);
      document.documentElement.setAttribute("data-theme", theme);
    }
  }, [theme, isInitialized]);

  const changeTheme = useCallback((nextTheme: Theme) => {
    if (nextTheme === "dark" || nextTheme === "light") {
      setTheme(nextTheme);
    }
  }, []);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  const contextValue = useMemo(
    () => ({
      theme,
      setTheme: changeTheme,
      toggleTheme,
    }),
    [theme, changeTheme, toggleTheme]
  );

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
};
