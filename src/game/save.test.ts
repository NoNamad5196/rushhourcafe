import { afterEach, describe, expect, it, vi } from "vitest";
import { createNewGame, runCurrentWave } from "./engine";
import {
  clearSavedGame,
  loadSavedGame,
  normalizeLoadedGame,
  saveGame,
  SAVE_VERSION
} from "./save";
import type { GameState } from "./types";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return Array.from(this.values.keys())[index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

describe("save persistence", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns null when there is no saved game", () => {
    vi.stubGlobal("localStorage", new MemoryStorage());

    expect(loadSavedGame()).toBeNull();
  });

  it("saves and restores a normal game state", () => {
    vi.stubGlobal("localStorage", new MemoryStorage());
    const state: GameState = {
      ...createNewGame("save-test"),
      wave: 8,
      gold: 90
    };

    saveGame(state);
    const loaded = loadSavedGame();

    expect(loaded?.wave).toBe(8);
    expect(loaded?.gold).toBe(90);
    expect(loaded?.phase).toBe("preparation");
  });

  it("ignores corrupted saved JSON", () => {
    const storage = new MemoryStorage();
    vi.stubGlobal("localStorage", storage);
    storage.setItem("rush-hour-cafe:auto-shift:save", "{bad json");

    expect(loadSavedGame()).toBeNull();
  });

  it("ignores saves from a different version", () => {
    const storage = new MemoryStorage();
    vi.stubGlobal("localStorage", storage);
    storage.setItem(
      "rush-hour-cafe:auto-shift:save",
      JSON.stringify({
        saveVersion: "1.3.3",
        savedAt: new Date().toISOString(),
        state: createNewGame("old-save")
      })
    );

    expect(SAVE_VERSION).toBe("1.4.0");
    expect(loadSavedGame()).toBeNull();
  });

  it("normalizes running saves into a safe non-replay phase", () => {
    const running = runCurrentWave(createNewGame("running-save"));
    const normalized = normalizeLoadedGame(running);

    expect(running.phase).toBe("running");
    expect(normalized.phase).toBe("report");
    expect(normalized.lastReport).toBeTruthy();
  });

  it("clears the saved game", () => {
    vi.stubGlobal("localStorage", new MemoryStorage());
    saveGame(createNewGame("clear-save"));
    expect(loadSavedGame()).not.toBeNull();

    clearSavedGame();

    expect(loadSavedGame()).toBeNull();
  });
});
