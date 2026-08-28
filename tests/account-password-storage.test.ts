import { describe, expect, it, vi } from "vitest";
import { createAccountPasswordStorage } from "../lib/account-password-storage";

function createWebStore() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
  };
}

describe("account password storage", () => {
  it("uses browser storage for web password operations", async () => {
    const webStore = createWebStore();
    const nativeStore = {
      getItemAsync: vi.fn(),
      setItemAsync: vi.fn(),
      deleteItemAsync: vi.fn(),
    };
    const storage = createAccountPasswordStorage("web", nativeStore, webStore);

    expect(await storage.get("manager")).toBeNull();
    await storage.set("manager", "123");
    expect(await storage.get("manager")).toBe("123");
    await storage.remove("manager");
    expect(await storage.get("manager")).toBeNull();
    expect(nativeStore.getItemAsync).not.toHaveBeenCalled();
  });

  it("keeps native SecureStore behavior on Android", async () => {
    const nativeStore = {
      getItemAsync: vi.fn().mockResolvedValue("456"),
      setItemAsync: vi.fn().mockResolvedValue(undefined),
      deleteItemAsync: vi.fn().mockResolvedValue(undefined),
    };
    const storage = createAccountPasswordStorage("android", nativeStore, null);

    expect(await storage.get("manager")).toBe("456");
    await storage.set("manager", "789");
    await storage.remove("manager");
    expect(nativeStore.getItemAsync).toHaveBeenCalledWith("manager");
    expect(nativeStore.setItemAsync).toHaveBeenCalledWith("manager", "789");
    expect(nativeStore.deleteItemAsync).toHaveBeenCalledWith("manager");
  });

  it("reports a clear error when browser storage is unavailable for saving", async () => {
    const storage = createAccountPasswordStorage("web", {
      getItemAsync: vi.fn(),
      setItemAsync: vi.fn(),
      deleteItemAsync: vi.fn(),
    }, null);

    await expect(storage.set("manager", "123")).rejects.toThrow("Browser storage is unavailable");
  });
});
