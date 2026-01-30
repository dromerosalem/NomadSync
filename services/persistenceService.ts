/**
 * Storage Persistence Service
 * 
 * Requests persistent storage to prevent browsers from evicting IndexedDB/Cache data.
 * Chrome requires user interaction before granting persistence.
 */

class PersistenceService {
  private isPersisted = false;
  private hasAttempted = false;

  /**
   * Request persistent storage from the browser.
   * Should be called AFTER user interaction (e.g., after login).
   */
  async requestPersistence(): Promise<boolean> {
    if (!navigator.storage || !navigator.storage.persist) {
      console.info('[PersistenceService] Storage API not available on this browser');
      return false;
    }

    try {
      // Check if already persisted
      const alreadyPersisted = await navigator.storage.persisted();
      if (alreadyPersisted) {
        console.log('[PersistenceService] ✓ Storage persistence enabled');
        this.isPersisted = true;
        this.hasAttempted = true;
        return true;
      }

      // Request persistence (Chrome requires this to be called after user interaction)
      const granted = await navigator.storage.persist();
      this.isPersisted = granted;
      this.hasAttempted = true;
      
      if (granted) {
        console.log('[PersistenceService] ✓ Storage persistence granted');
      } else {
        console.warn(
          '[PersistenceService] ⚠️ Storage persistence denied. ' +
          'Offline data may be cleared if storage is low. ' +
          'Chrome grants persistence based on site engagement.'
        );
      }
      
      return granted;
    } catch (error) {
      console.error('[PersistenceService] Error requesting persistence:', error);
      return false;
    }
  }

  /**
   * Retry persistence request (useful after user interaction)
   */
  async retryPersistence(): Promise<boolean> {
    if (this.isPersisted) {
      return true; // Already granted
    }
    return this.requestPersistence();
  }

  /**
   * Get current storage estimate
   */
  async getStorageEstimate(): Promise<{ usage: number; quota: number } | null> {
    if (!navigator.storage || !navigator.storage.estimate) {
      return null;
    }

    try {
      const estimate = await navigator.storage.estimate();
      return {
        usage: estimate.usage || 0,
        quota: estimate.quota || 0
      };
    } catch {
      return null;
    }
  }

  /**
   * Check if storage is persisted
   */
  getIsPersisted(): boolean {
    return this.isPersisted;
  }

  /**
   * Check if we've attempted to request persistence
   */
  getHasAttempted(): boolean {
    return this.hasAttempted;
  }
}

export const persistenceService = new PersistenceService();
