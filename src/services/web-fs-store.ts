/**
 * IndexedDB Storage for FileSystemDirectoryHandle
 * Persists directory handles so users don't need to re-select on every visit
 */

import { getVaultPath, setDirectoryHandle } from "./web-fs";

// Database configuration
const DB_NAME = "life-os-vault";
const STORE_NAME = "handles";
const KEY = "directory-handle";

// Database version (increment if schema changes)
const DB_VERSION = 1;

/**
 * Open or create the IndexedDB database
 */
export const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      reject(new Error(`Failed to open IndexedDB: ${request.error?.message}`));
    };

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create the object store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
    };
  });
};

/**
 * Save a FileSystemDirectoryHandle to IndexedDB
 * Note: FileSystemDirectoryHandle can be stored directly in IndexedDB
 */
export const saveDirectoryHandle = async (
  handle: FileSystemDirectoryHandle
): Promise<void> => {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(handle, KEY);

    request.onerror = () => {
      reject(new Error(`Failed to save directory handle: ${request.error?.message}`));
    };

    request.onsuccess = () => {
      resolve();
    };

    transaction.oncomplete = () => {
      db.close();
    };
  });
};

/**
 * Load a FileSystemDirectoryHandle from IndexedDB
 * Returns null if no handle is stored
 */
export const loadDirectoryHandle = async (): Promise<FileSystemDirectoryHandle | null> => {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readonly");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(KEY);

    request.onerror = () => {
      reject(new Error(`Failed to load directory handle: ${request.error?.message}`));
    };

    request.onsuccess = () => {
      resolve(request.result ?? null);
    };

    transaction.oncomplete = () => {
      db.close();
    };
  });
};

/**
 * Clear the stored directory handle from IndexedDB
 */
export const clearDirectoryHandle = async (): Promise<void> => {
  const db = await openDB();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(KEY);

    request.onerror = () => {
      reject(new Error(`Failed to clear directory handle: ${request.error?.message}`));
    };

    request.onsuccess = () => {
      resolve();
    };

    transaction.oncomplete = () => {
      db.close();
    };
  });
};

/**
 * Set the global directory handle
 * This saves the handle to IndexedDB and updates the web-fs module
 */
export const setGlobalDirectoryHandle = async (
  handle: FileSystemDirectoryHandle
): Promise<void> => {
  // Save to IndexedDB for persistence
  await saveDirectoryHandle(handle);

  // Update the web-fs module's in-memory handle
  setDirectoryHandle(handle);
};

/**
 * Get the global directory handle
 * First tries to get from memory (web-fs), then falls back to IndexedDB
 */
export const getGlobalDirectoryHandle = async (): Promise<FileSystemDirectoryHandle | null> => {
  // First check if we have an in-memory handle via web-fs
  const vaultPath = getVaultPath();
  if (vaultPath) {
    // If we have a vault path, the handle is already set in memory
    // We need to get it from IndexedDB since web-fs doesn't expose the handle directly
    return loadDirectoryHandle();
  }

  // Try to load from IndexedDB
  const handle = await loadDirectoryHandle();
  if (handle) {
    // Restore the handle to memory
    setDirectoryHandle(handle);
  }

  return handle;
};

/**
 * Verify if a stored handle still has permission
 * The browser may revoke permissions after some time or on browser restart
 */
export const verifyHandlePermission = async (
  handle: FileSystemDirectoryHandle
): Promise<boolean> => {
  try {
    // Check if we already have permission
    const permission = await handle.queryPermission({ mode: "readwrite" });

    if (permission === "granted") {
      return true;
    }

    // Try to request permission if not granted
    const requestPermission = await handle.requestPermission({ mode: "readwrite" });
    return requestPermission === "granted";
  } catch {
    return false;
  }
};

/**
 * Restore the directory handle from IndexedDB and verify permissions
 * Returns true if successfully restored, false otherwise
 */
export const restoreDirectoryHandle = async (): Promise<boolean> => {
  const handle = await loadDirectoryHandle();

  if (!handle) {
    return false;
  }

  // Verify permission
  const hasPermission = await verifyHandlePermission(handle);

  if (!hasPermission) {
    // Permission denied, clear the stored handle
    await clearDirectoryHandle();
    return false;
  }

  // Restore to memory
  setDirectoryHandle(handle);

  return true;
};
