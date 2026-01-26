function xDataWishlist() {
  const WISHLIST_KEY = 'wishlist';
  let api = null;

  function getApi() {
    if (!api) {
      api = window.Api ? window.Api('/ajax') : null;
      if (!api) console.error('Api function is not available');
    }
    return api;
  }

  function requestWithTimeout(promise, timeout = 10000) {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Request timeout')), timeout)),
    ]);
  }
  // Store quantities for each item
  const itemQuantities = {};

  return {
    items: [],
    loadingId: null, // ← عشان التحكم في حالة الزر

    // Access modal from GlobalState - make it reactive
    modal: window.modal || { open: false, type: '' },

    toggleModal(type, open) {
      if (window.toggleModal) {
        window.toggleModal(type, open);
      }
    },

    init() {
      this.loadItems();
      window.addEventListener('wishlist:changed', () => this.loadItems());
      window.addEventListener('modal:changed', (e) => { this.modal = e.detail || { open: false, type: '' }; });
      // Initialize quantities for existing items
      this.items.forEach(item => {
        if (!itemQuantities[item._id]) {
          itemQuantities[item._id] = 1;
        }
      });
    },

    loadItems() {
      try {
        this.items = JSON.parse(localStorage.getItem(WISHLIST_KEY) || '[]');
        // Initialize quantities for new items
        this.items.forEach(item => {
          if (!itemQuantities[item._id]) {
            itemQuantities[item._id] = 1;
          }
        });
      } catch {
        this.items = [];
      }
    },

    count() {
      return this.items.length;
    },

    getItemQuantity(id) {
      return itemQuantities[id] || 1;
    },

    setItemQuantity(id, event) {
      const value = Number(event.target.value) || 1;
      itemQuantities[id] = Math.max(1, value);
    },

    increaseQuantity(id) {
      itemQuantities[id] = (itemQuantities[id] || 1) + 1;
    },

    decreaseQuantity(id) {
      const current = itemQuantities[id] || 1;
      itemQuantities[id] = Math.max(1, current - 1);
    },

    clear() {
      // Prefer REST API (optimistic local clear + server sync)
      if (typeof window.clearWishlist === 'function') {
        window.clearWishlist();
        return;
      }

      // Fallback: local clear only
      localStorage.setItem(WISHLIST_KEY, '[]');
      this.loadItems();

      // Clear IDs list and sync all heart icons
      const WISHLIST_IDS_KEY = 'wishlist_ids';
      try {
        localStorage.setItem(WISHLIST_IDS_KEY, '[]');

        // Reset all heart icons
        const buttons = document.querySelectorAll('.wishlist-heart-btn[data-product-id]');
        buttons.forEach((btn) => {
          const icon = btn.querySelector('i');
          if (icon) {
            icon.classList.remove('ph-fill', 'text-mainColor');
            icon.classList.add('ph-heart');
          }
        });
      } catch (e) {
        console.error('Error syncing heart icons:', e);
      }

      window.dispatchEvent(new CustomEvent('wishlist:changed'));
    },

    remove(id) {
      // Prefer REST API (optimistic local remove + server sync)
      if (typeof window.removeFromWishlist === 'function') {
        window.removeFromWishlist(id);
        return;
      }

      // Fallback: local remove only
      const newList = this.items.filter(it => it._id !== id);
      localStorage.setItem(WISHLIST_KEY, JSON.stringify(newList));
      this.loadItems();

      // Update IDs list and sync heart icons
      const WISHLIST_IDS_KEY = 'wishlist_ids';
      try {
        const ids = JSON.parse(localStorage.getItem(WISHLIST_IDS_KEY) || '[]');
        const newIds = ids.filter(pid => pid !== id);
        localStorage.setItem(WISHLIST_IDS_KEY, JSON.stringify(newIds));

        // Sync the heart icon for this product
        const buttons = document.querySelectorAll(`.wishlist-heart-btn[data-product-id="${id}"]`);
        buttons.forEach((btn) => {
          const icon = btn.querySelector('i');
          if (icon) {
            icon.classList.remove('ph-fill', 'text-mainColor');
            icon.classList.add('ph-heart');
          }
        });
      } catch (e) {
        console.error('Error syncing heart icons:', e);
      }

      window.dispatchEvent(new CustomEvent('wishlist:changed'));
    },

    currency(it) {
      // Try to get currency from globals or qumra config
      const globalCurrency = window?.globals?.currency?.currencySymbol || 
                            window?.__qumra__?.currency?.currencySymbol ||
                            window?.__qumra__?.currencySymbol;
      return globalCurrency || it.currency || 'ج.م';
    },

    addToCart(it, qty = 1) {
      const quantity = Number(qty) || 1;
      this.loadingId = it._id;
      this.addProductToCart(it._id, quantity, it.options || [])
        .finally(() => {
          this.loadingId = null;
        });
    },
  
    addProductToCart(productId, quantity, options = []) {
      updateLoading('cart', true);
      const apiClient = getApi();
      if (!apiClient) {
        window.showToast?.('خطأ في الاتصال بالخادم', 'error');
        updateLoading('cart', false);
        return Promise.resolve();
      }

      return requestWithTimeout(apiClient.post('/cart/add', { productId, quantity, options }), 10000)
        .then((res) => {
          // api.js throws on success:false, so reaching here is success
          if (window.updateCart) {
            window.updateCart(res?.data || res);
          }
          window.showToast?.('تم إضافة المنتج للسلة بنجاح', 'success');
          try {
            window.dispatchEvent(new CustomEvent('open-cart'));
          } catch (e) {}
        })
        .catch((err) => {
          console.error('addToCart error', err);
          window.showToast?.(err?.message || 'حدث خطأ أثناء إضافة المنتج للسلة', 'error');
        })
        .finally(() => {
          updateLoading('cart', false);
        });
    }
  };
}

window.xDataWishlist = xDataWishlist;

// Wishlist helpers using REST API (مع fallback للعمل محلياً حتى لو API غير متوفر)
(function () {
  const WISHLIST_IDS_KEY = 'wishlist_ids';
  let api = null;

  function showToast(message, type = 'info', duration = 3000) {
    try {
      if (window.showToast) window.showToast(message, type, duration);
    } catch (_) {}
  }

  function getApi() {
    if (!api) {
      api = window.Api ? window.Api('/ajax') : null;
      if (!api) {
        console.error('Api function is not available');
      }
    }
    return api;
  }

  function requestWithTimeout(promise, timeout = 10000) {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Request timeout')), timeout)),
    ]);
  }

  function getAuth() {
    const globals = window.globals || {};
    const accountId = globals.customer?._id || null;
    const sessionId =
      (globals.cart && globals.cart.sessionId) ||
      globals.sessionId ||
      (window.__qumra__ && window.__qumra__.sessionId) ||
      null;
    return { accountId, sessionId };
  }

  function getLocalIds() {
    try {
      return JSON.parse(localStorage.getItem(WISHLIST_IDS_KEY) || '[]');
    } catch {
      return [];
    }
  }

  function setLocalIds(ids) {
    localStorage.setItem(WISHLIST_IDS_KEY, JSON.stringify(ids));
  }

  function getWishlistItems() {
    try {
      return JSON.parse(localStorage.getItem('wishlist') || '[]');
    } catch {
      return [];
    }
  }

  function setWishlistItems(items) {
    localStorage.setItem('wishlist', JSON.stringify(items));
    // notify Alpine wishlist sidebar to reload from localStorage
    window.dispatchEvent(new CustomEvent('wishlist:changed'));
  }

  function ensureWishlistItemFromDom(productId) {
    if (!productId) return;
    const items = getWishlistItems();
    if (items.some((it) => it?._id === productId)) return;

    let btn = null;
    try {
      btn = document.querySelector(`.wishlist-heart-btn[data-product-id="${productId}"]`);
    } catch (_) {
      btn = null;
    }
    if (!btn) return;

    const title = btn.getAttribute('data-product-title') || '';
    const slug = btn.getAttribute('data-product-slug') || '';
    const imageUrl = btn.getAttribute('data-product-image') || '';
    const priceRaw = btn.getAttribute('data-product-price');
    const compareRaw = btn.getAttribute('data-product-compare-at-price');

    const price = priceRaw != null ? Number(priceRaw) : 0;
    const compareAtPrice = compareRaw != null ? Number(compareRaw) : undefined;

    const newItem = {
      _id: productId,
      title,
      slug,
      image: imageUrl ? { fileUrl: imageUrl } : null,
      price,
      compareAtPrice,
      currency: (window.__qumra__ && window.__qumra__.currency) || 'ر.س',
    };
    setWishlistItems([...items, newItem]);
  }

  function syncHeartIcons(ids) {
    const set = new Set(ids);
    const buttons = document.querySelectorAll('.wishlist-heart-btn[data-product-id]');
    buttons.forEach((btn) => {
      const pid = btn.getAttribute('data-product-id');
      const icon = btn.querySelector('i');
      if (!icon) return;
      if (set.has(pid)) {
        icon.classList.remove('ph-heart');
        icon.classList.add('ph-fill', 'ph-heart', 'text-mainColor');
      } else {
        icon.classList.remove('ph-fill', 'text-mainColor');
        icon.classList.add('ph-heart');
      }
    });
  }

  // No "list" endpoint was provided; for now we only sync from local state on load.
  function refreshFromServer() {
    const ids = getLocalIds();
    syncHeartIcons(ids);
    return Promise.resolve();
  }

  function serverAdd(productId, variantId) {
    const apiClient = getApi();
    if (!apiClient) return Promise.resolve();
    const { accountId, sessionId } = getAuth();
    return requestWithTimeout(
      apiClient.post('/wishlist/add', {
        productId,
        variantId: variantId || null,
        accountId: accountId || undefined,
        sessionId: sessionId || undefined,
      }),
      10000
    );
  }

  function serverRemove(productId) {
    const apiClient = getApi();
    if (!apiClient) return Promise.resolve();
    const { accountId, sessionId } = getAuth();
    return requestWithTimeout(
      apiClient.post('/wishlist/remove', {
        productId,
        accountId: accountId || undefined,
        sessionId: sessionId || undefined,
      }),
      10000
    );
  }

  function serverClear() {
    const apiClient = getApi();
    if (!apiClient) return Promise.resolve();
    const { accountId, sessionId } = getAuth();
    return requestWithTimeout(
      apiClient.post('/wishlist/clear', {
        accountId: accountId || undefined,
        sessionId: sessionId || undefined,
      }),
      10000
    );
  }

  window.clearWishlist = function () {
    const prevIds = getLocalIds();
    const prevItems = getWishlistItems();

    // optimistic local clear
    setLocalIds([]);
    setWishlistItems([]);
    syncHeartIcons([]);

    return serverClear()
      .then(() => {
        showToast('تم مسح المفضلة', 'success');
      })
      .catch((err) => {
        // rollback
        setLocalIds(prevIds);
        setWishlistItems(prevItems);
        syncHeartIcons(prevIds);
        showToast(err?.message || 'فشل مسح المفضلة', 'error');
      });
  };

  window.addToWishlist = function (productId, variantId) {
    if (!productId) return;
    const prevIds = getLocalIds();
    const ids = prevIds.slice();
    if (!ids.includes(productId)) ids.push(productId);

    // optimistic local update (IDs only)
    setLocalIds(ids);
    syncHeartIcons(ids);
    // if the caller didn't provide full product data (toggleWishlist only),
    // try to build the wishlist item object from DOM data-* attributes
    ensureWishlistItemFromDom(productId);
    showToast('تم إضافة المنتج إلى المفضلة', 'success');

    return serverAdd(productId, variantId)
      .then(() => refreshFromServer())
      .catch((err) => {
        // rollback
        setLocalIds(prevIds);
        syncHeartIcons(prevIds);
        showToast(err?.message || 'فشل إضافة المنتج إلى المفضلة', 'error');
      });
  };

  window.removeFromWishlist = function (productId) {
    if (!productId) return;
    const prevIds = getLocalIds();
    const prevItems = getWishlistItems();

    const nextIds = prevIds.filter((id) => id !== productId);
    const nextItems = prevItems.filter((it) => it?._id !== productId);

    // optimistic local update (IDs + full objects)
    setLocalIds(nextIds);
    setWishlistItems(nextItems);
    syncHeartIcons(nextIds);
    showToast('تم إزالة المنتج من المفضلة', 'success');

    return serverRemove(productId)
      .then(() => refreshFromServer())
      .catch((err) => {
        // rollback
        setLocalIds(prevIds);
        setWishlistItems(prevItems);
        syncHeartIcons(prevIds);
        showToast(err?.message || 'فشل إزالة المنتج من المفضلة', 'error');
      });
  };

  window.toggleWishlist = function (productId, variantId) {
    const ids = getLocalIds();
    const exists = ids.includes(productId);

    if (!productId) return;

    if (exists) {
      return window.removeFromWishlist(productId);
    } else {
      return window.addToWishlist(productId, variantId);
    }
  };

  // Helper: build / toggle wishlist entry from a DOM button with data-* attributes
  window.toggleWishlistFromElement = function (btn) {
    if (!btn) return;
    const productId = btn.getAttribute('data-product-id');
    if (!productId) return;

    const title = btn.getAttribute('data-product-title') || '';
    const slug = btn.getAttribute('data-product-slug') || '';
    const imageUrl = btn.getAttribute('data-product-image') || '';
    const priceRaw = btn.getAttribute('data-product-price');
    const compareRaw = btn.getAttribute('data-product-compare-at-price');

    const price = priceRaw != null ? Number(priceRaw) : 0;
    const compareAtPrice = compareRaw != null ? Number(compareRaw) : undefined;

    const items = getWishlistItems();
    const exists = items.some((it) => it._id === productId);

    if (exists) {
      const filtered = items.filter((it) => it._id !== productId);
      setWishlistItems(filtered);
    } else {
      const newItem = {
        _id: productId,
        title,
        slug,
        image: imageUrl ? { fileUrl: imageUrl } : null,
        price,
        compareAtPrice,
        currency: (window.__qumra__ && window.__qumra__.currency) || 'ر.س',
      };
      setWishlistItems([...items, newItem]);
    }

    // keep IDs / server state in sync
    window.toggleWishlist(productId);

    // open wishlist sidebar so user immediately sees the change
    try {
      window.dispatchEvent(new CustomEvent('open-wishlist'));
    } catch (_) {}
  };

  // Preferred handler for product-card heart:
  // - makes REST request (add/remove)
  // - ensures wishlist item is stored so it يظهر في wishlist sidebar
  window.wishlistToggleFromElement = function (btn) {
    if (!btn) return;
    const productId = btn.getAttribute('data-product-id');
    if (!productId) return;

    const ids = getLocalIds();
    const exists = ids.includes(productId);

    if (exists) {
      // remove (local + server)
      return window.removeFromWishlist(productId);
    }

    // add: ensure item object exists first, then sync server
    ensureWishlistItemFromDom(productId);
    const p = window.addToWishlist(productId, btn.getAttribute('data-variant-id') || null);

    // open wishlist sidebar so user sees the added item immediately
    try {
      window.dispatchEvent(new CustomEvent('open-wishlist'));
    } catch (_) {}

    return p;
  };

  window.isInWishlist = function (productId) {
    const ids = getLocalIds();
    return ids.includes(productId);
  };

  window.openWishlistPage = function () {
    window.location.href = '/wishlist';
  };

  document.addEventListener('DOMContentLoaded', function () {
    const ids = getLocalIds();
    syncHeartIcons(ids);
    refreshFromServer();
  });
})();