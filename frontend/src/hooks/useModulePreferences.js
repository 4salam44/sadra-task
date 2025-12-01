import { useEffect, useMemo, useState } from "react";

const getDefaultState = (modules) =>
  modules.reduce((acc, mod) => {
    acc[mod.id] = true;
    return acc;
  }, {});

export default function useModulePreferences(storageKey, modules = []) {
  const moduleIdsKey = useMemo(
    () => modules.map((mod) => mod.id).join("|"),
    [modules]
  );

  const [state, setState] = useState(() => {
    const defaults = getDefaultState(modules);
    if (typeof window === "undefined") return defaults;
    try {
      const stored = window.localStorage.getItem(storageKey);
      if (!stored) return defaults;
      const parsed = JSON.parse(stored);
      return { ...defaults, ...parsed };
    } catch (err) {
      console.warn("Failed to parse module preferences", err);
      return defaults;
    }
  });

  useEffect(() => {
    const defaults = getDefaultState(modules);
    setState((prev) => {
      const merged = { ...defaults, ...prev };
      const changed = modules.some((mod) => merged[mod.id] !== prev[mod.id]);
      return changed ? merged : prev;
    });
  }, [moduleIdsKey, modules]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(state));
    } catch (err) {
      console.warn("Failed to store module preferences", err);
    }
  }, [storageKey, state]);

  const toggleModule = (id) => {
    setState((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const resetModules = () => {
    setState(getDefaultState(modules));
  };

  return [state, toggleModule, resetModules];
}

