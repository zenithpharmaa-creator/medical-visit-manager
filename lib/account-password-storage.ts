export type NativeSecretStore = {
  getItemAsync: (key: string) => Promise<string | null>;
  setItemAsync: (key: string, value: string) => Promise<void>;
  deleteItemAsync: (key: string) => Promise<void>;
};

export type WebSecretStore = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
};

export function createAccountPasswordStorage(
  platform: string,
  nativeStore: NativeSecretStore,
  webStore: WebSecretStore | null,
) {
  if (platform === "web") {
    return {
      get: async (key: string): Promise<string | null> => webStore?.getItem(key) ?? null,
      set: async (key: string, value: string): Promise<void> => {
        if (!webStore) throw new Error("Browser storage is unavailable");
        webStore.setItem(key, value);
      },
      remove: async (key: string): Promise<void> => {
        webStore?.removeItem(key);
      },
    };
  }

  return {
    get: (key: string) => nativeStore.getItemAsync(key),
    set: (key: string, value: string) => nativeStore.setItemAsync(key, value),
    remove: (key: string) => nativeStore.deleteItemAsync(key),
  };
}
