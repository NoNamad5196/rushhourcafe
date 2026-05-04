import { slotDefinitions } from "./data";
import type { GameState } from "./types";

export const SAVE_VERSION = "1.4.0";
const SAVE_KEY = "rush-hour-cafe:auto-shift:save";

interface SavedGameEnvelope {
  saveVersion: string;
  savedAt: string;
  state: GameState;
}

export function loadSavedGame(): GameState | null {
  const storage = getStorage();
  if (!storage) {
    return null;
  }

  try {
    const raw = storage.getItem(SAVE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<SavedGameEnvelope>;
    if (parsed.saveVersion !== SAVE_VERSION || !isGameStateLike(parsed.state)) {
      return null;
    }

    return normalizeLoadedGame(parsed.state);
  } catch {
    return null;
  }
}

export function saveGame(state: GameState): void {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  const envelope: SavedGameEnvelope = {
    saveVersion: SAVE_VERSION,
    savedAt: new Date().toISOString(),
    state: normalizeLoadedGame(state)
  };

  try {
    storage.setItem(SAVE_KEY, JSON.stringify(envelope));
  } catch {
    // Storage can fail in private mode or when quota is full. The game should keep running.
  }
}

export function clearSavedGame(): void {
  const storage = getStorage();
  if (!storage) {
    return;
  }

  try {
    storage.removeItem(SAVE_KEY);
  } catch {
    // Ignore storage failures for the same reason as saveGame().
  }
}

export function normalizeLoadedGame(state: GameState): GameState {
  const existingSlotIds = new Set(state.slots.map((slot) => slot.slotId));
  const missingSlots = slotDefinitions
    .filter((slot) => !existingSlotIds.has(slot.id))
    .map((slot) => ({
      slotId: slot.id,
      employee: null
    }));

  const normalized: GameState = {
    ...state,
    slots: missingSlots.length ? [...state.slots, ...missingSlots] : state.slots
  };

  if (normalized.phase === "running") {
    return {
      ...normalized,
      phase: normalized.lastReport ? "report" : "preparation"
    };
  }

  if (normalized.phase === "report" && !normalized.lastReport) {
    return {
      ...normalized,
      phase: "preparation"
    };
  }

  if (normalized.phase === "reward" && normalized.pendingRewards.length === 0) {
    return {
      ...normalized,
      phase: "preparation"
    };
  }

  return normalized;
}

function getStorage(): Storage | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

function isGameStateLike(value: unknown): value is GameState {
  if (!value || typeof value !== "object") {
    return false;
  }

  const state = value as Partial<GameState>;
  return (
    typeof state.phase === "string" &&
    typeof state.seed === "string" &&
    typeof state.wave === "number" &&
    typeof state.gold === "number" &&
    typeof state.reputation === "number" &&
    typeof state.life === "number" &&
    typeof state.storeLevel === "number" &&
    Array.isArray(state.shop) &&
    Array.isArray(state.bench) &&
    Array.isArray(state.slots) &&
    Array.isArray(state.pendingRewards) &&
    Boolean(state.upgrades)
  );
}
