function xDataWishlist() {
  const WISHLIST_KEY = 'wishlist';
  const Request = window.qumra.storeGate;
  const schema = {
    addToCart: `mutation AddToCart($data: AddToCartInput!) {
      addToCart(data: $data) {
        data {
          _id app
          items {
            productId _id variantId
            productData { title slug app image { _id fileUrl } price }
            variantData { compareAtPrice options { _id label option { _id name } } price }
            quantity price compareAtPrice totalPrice totalCompareAtPrice totalSavings
          }
          deviceId sessionId status totalQuantity totalPrice totalCompareAtPrice totalSavings isFastOrder
        }
        success message
      }
    }`,
  };
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
            icon.classList.remove('ph-fill', 'text-red-500');
            icon.classList.add('ph-heart');
          }
        });
      } catch (e) {
        console.error('Error syncing heart icons:', e);
      }
      
      window.dispatchEvent(new CustomEvent('wishlist:changed'));
    },

    remove(id) {
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
            icon.classList.remove('ph-fill', 'text-red-500');
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
      return Request(schema.addToCart, { data: { productId, quantity, options } })
        .then((res) => {
          const result = res?.addToCart;
          if (result?.success) {
            updateCart(result.data);
            // Show success toast
            if (window.showToast) {
              window.showToast('تم إضافة المنتج للسلة بنجاح', 'success');
            }
            // Open cart sidebar
            try {
              window.dispatchEvent(new CustomEvent('open-cart'));
            } catch (e) {}
          } else {
            // Show error message
            const errorMsg = result?.message || 'فشل إضافة المنتج للسلة';
            if (window.showToast) {
              window.showToast(errorMsg, 'error');
            }
          }
        })
        .catch((err) => {
          console.error('addToCart error', err);
          // Show error toast
          if (window.showToast) {
            window.showToast('حدث خطأ أثناء إضافة المنتج للسلة', 'error');
          }
        })
        .finally(() => {
          updateLoading('cart', false);
        });
    }
  };
}

window.xDataWishlist = xDataWishlist;

// Wishlist helpers using GraphQL API (مع fallback للعمل محلياً حتى لو Request غير متوفر)
(function () {
  const Request = window.qumra?.storeGate;

  const WISHLIST_IDS_KEY = 'wishlist_ids';

  const schema = {
    getAllWishlists: `query GetAllWishlists($sessionId: String, $accountId: String) {
  getAllWishlists(sessionId: $sessionId, accountId: $accountId) {
    success
    message
    data {
      _id
      accountId
      sessionId
      app
      products { _id }
      createdAt
      updatedAt
    }
  }
}`,
    addToWishlist: `mutation AddToWishlist($createWishlistInput: CreateWishlistInput!) {
  addToWishlist(createWishlistInput: $createWishlistInput) {
    success
    message
    data {
      _id
      accountId
      sessionId
      app
      products { _id }
      createdAt
      updatedAt
    }
  }
}`,
    removeFromWishlist: `mutation RemoveFromWishlist($input: RemoveFromWishlistInput!) {
  removeFromWishlist(input: $input) {
    success
    message
    data {
      _id
      accountId
      sessionId
      app
      products { _id }
      createdAt
      updatedAt
    }
  }
}`,
  };

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

  function syncHeartIcons(ids) {
    const set = new Set(ids);
    const buttons = document.querySelectorAll('.wishlist-heart-btn[data-product-id]');
    buttons.forEach((btn) => {
      const pid = btn.getAttribute('data-product-id');
      const icon = btn.querySelector('i');
      if (!icon) return;
      if (set.has(pid)) {
        icon.classList.remove('ph-heart');
        icon.classList.add('ph-fill', 'ph-heart', 'text-red-500');
      } else {
        icon.classList.remove('ph-fill', 'text-red-500');
        icon.classList.add('ph-heart');
      }
    });
  }

  function refreshFromServer() {
    const { accountId, sessionId } = getAuth();
    if (typeof Request !== 'function') {
      const ids = getLocalIds();
      syncHeartIcons(ids);
      return Promise.resolve();
    }
    if (!accountId && !sessionId) {
      const ids = getLocalIds();
      syncHeartIcons(ids);
      return Promise.resolve();
    }
    return Request(schema.getAllWishlists, { sessionId, accountId })
      .then((res) => {
        const list = res?.getAllWishlists?.data || [];
        const first = Array.isArray(list) ? list[0] : null;
        const products = first?.products || [];
        const ids = products.map((p) => p._id).filter(Boolean);
        setLocalIds(ids);
        syncHeartIcons(ids);
      })
      .catch(() => {
        const ids = getLocalIds();
        syncHeartIcons(ids);
      });
  }

  window.toggleWishlist = function (productId, variantId) {
    const { accountId, sessionId } = getAuth();

    const ids = getLocalIds();
    const exists = ids.includes(productId);

    if (!productId) return;

    if (exists) {
      // إزالة من المفضلة محلياً (IDs + full objects)
      const newIds = ids.filter((id) => id !== productId);
      setLocalIds(newIds);
      syncHeartIcons(newIds);

      const currentItems = getWishlistItems();
      const filteredItems = currentItems.filter((it) => it._id !== productId);
      setWishlistItems(filteredItems);

      try {
        if (window.showToast) {
          window.showToast('تم إزالة المنتج من المفضلة', 'info');
        }
      } catch (_) {}

      if (typeof Request === 'function') {
        const variables = {
          input: {
            accountId: accountId || undefined,
            sessionId: sessionId || undefined,
            productId,
          },
        };
        Request(schema.removeFromWishlist, variables)
          .then(() => refreshFromServer())
          .catch(() => {});
      }
    } else {
      // إضافة للمفضلة محلياً (IDs فقط هنا، بيانات كاملة تضاف في toggleWishlistFromElement)
      const newIds = ids.concat(productId);
      setLocalIds(newIds);
      syncHeartIcons(newIds);

      try {
        if (window.showToast) {
          window.showToast('تم إضافة المنتج إلى المفضلة', 'success');
        }
      } catch (_) {}

      if (typeof Request === 'function') {
        const variables = {
          createWishlistInput: {
            accountId: accountId || undefined,
            sessionId: sessionId || undefined,
            product: {
              id: productId,
              variantId: variantId || null,
            },
          },
        };
        Request(schema.addToWishlist, variables)
          .then(() => refreshFromServer())
          .catch(() => {});
      }
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