import { createContext, useContext, useEffect, useState } from "react";

type Theme = "dark" | "light" | "system";

export type ColorTheme =
  | "green"
  | "blue"
  | "indigo"
  | "violet"
  | "orange"
  | "rose"
  | "teal"
  | "amber";

export const COLOR_THEMES: {
  id: ColorTheme;
  name: string;
  hsl: string;
  label: string;
}[] = [
  { id: "green",  name: "Forest Green", hsl: "152 55% 38%", label: "Nature" },
  { id: "blue",   name: "Ocean Blue",   hsl: "210 70% 44%", label: "Ocean" },
  { id: "indigo", name: "Royal Indigo", hsl: "234 65% 52%", label: "Royal" },
  { id: "violet", name: "Deep Violet",  hsl: "262 65% 54%", label: "Violet" },
  { id: "orange", name: "Sunset Orange",hsl: "24 85% 48%",  label: "Sunset" },
  { id: "rose",   name: "Crimson Rose", hsl: "347 72% 50%", label: "Rose" },
  { id: "teal",   name: "Teal Breeze",  hsl: "173 65% 38%", label: "Teal" },
  { id: "amber",  name: "Amber Gold",   hsl: "38 80% 42%",  label: "Amber" },
];

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
  colorStorageKey?: string;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  colorTheme: ColorTheme;
  setColorTheme: (color: ColorTheme) => void;
};

const initialState: ThemeProviderState = {
  theme: "system",
  setTheme: () => null,
  colorTheme: "green",
  setColorTheme: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "dairy-farm-theme",
  colorStorageKey = "dairy-farm-color-theme",
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem(storageKey) as Theme) || defaultTheme
  );

  const [colorTheme, setColorTheme] = useState<ColorTheme>(
    () => (localStorage.getItem(colorStorageKey) as ColorTheme) || "green"
  );

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
  }, [theme]);

  useEffect(() => {
    const root = window.document.documentElement;
    if (colorTheme === "green") {
      root.removeAttribute("data-color-theme");
    } else {
      root.setAttribute("data-color-theme", colorTheme);
    }
  }, [colorTheme]);

  const value = {
    theme,
    setTheme: (t: Theme) => {
      localStorage.setItem(storageKey, t);
      setTheme(t);
    },
    colorTheme,
    setColorTheme: (c: ColorTheme) => {
      localStorage.setItem(colorStorageKey, c);
      setColorTheme(c);
    },
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);
  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider");
  return context;
};
