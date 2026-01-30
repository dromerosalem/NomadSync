/**
 * Storage Persistence Service
 * 
 * Requests persistent storage to prevent iOS from evicting IndexedDB data
 * after 7 days of inactivity.
 */

class PersistenceService {
  private isPersisted = false;

  /**
   * Request persistent storage from the browser.
   * Should be called early in app initialization.
   */
  async requestPersistence(): Promise<boolean> {
    if (!navigator.storage || !navigator.storage.persist) {
      console.warn('[PersistenceService] Storage API not available');
      return false;
    }

    try {
      // Check if already persisted
      const alreadyPersisted = await navigator.storage.persisted();
      if (alreadyPersisted) {
        console.log('[PersistenceService] Storage already persisted');
        this.isPersisted = true;
        return true;
      }

      // Request persistence
      const granted = await navigator.storage.persist();
      this.isPersisted = granted;
      
      if (granted) {
        console.log('[PersistenceService] Storage persistence granted');
      } else {
        console.warn('[PersistenceService] Storage persistence denied');
      }
      
      return granted;
    } catch (error) {
      console.error('[PersistenceService] Error requesting persistence:', error);
      return false;
    }
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
}

export const persistenceService = new PersistenceService();
