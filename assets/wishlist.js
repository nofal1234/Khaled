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
  return {
    items: [],
    loadingId: null, // ← عشان التحكم في حالة الزر

    init() {
      this.loadItems();
      window.addEventListener('wishlist:changed', () => this.loadItems());
    },

    loadItems() {
      try {
        this.items = JSON.parse(localStorage.getItem(WISHLIST_KEY) || '[]');
      } catch {
        this.items = [];
      }
    },

    count() {
      return this.items.length;
    },

    clear() {
      localStorage.setItem(WISHLIST_KEY, '[]');
      this.loadItems();
      window.dispatchEvent(new CustomEvent('wishlist:changed'));
    },

    remove(id) {
      const newList = this.items.filter(it => it._id !== id);
      localStorage.setItem(WISHLIST_KEY, JSON.stringify(newList));
      this.loadItems();
      window.dispatchEvent(new CustomEvent('wishlist:changed'));
    },

    currency(it) {
      return it.currency || 'ر.س';
    },

    addToCart(it) {
      this.loadingId = it._id;
      this.addProductToCart(it._id, 1, it.options || [])
        .finally(() => {
          this.loadingId = null;
        });
    },
  
    addProductToCart(productId, quantity, options = []) {
      updateLoading('cart', true);
      return Request(schema.addToCart, { data: { productId, quantity, options } })
        .then((res) => {
          updateCart(res.addToCart.data);
        })
        .catch((err) => {
          console.error('addToCart error', err);
        })
        .finally(() => {
          updateLoading('cart', false);
        });
    }
    
    
  };
}

window.xDataWishlist = xDataWishlist;