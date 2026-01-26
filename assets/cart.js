function xDataCart() {
  // Helper function for showing toasts
  const showToast = (message, type = 'info', duration = 3000) => {
    if (window.showToast) {
      window.showToast(message, type, duration);
    } else {
      console.log(`[${type.toUpperCase()}] ${message}`);
    }
  };

  const updateTimers = {};
  const localQuantities = {};
  const lastSuccessfulQuantities = {}; // آخر كمية ناجحة
  const busy = Alpine.reactive({});
  let api = null;

  // عند تشغيل الكارت أول مرة، خزّن الكميات الحالية كـ ناجحة
  if (globals.cart?.items) {
    globals.cart.items.forEach((item) => {
      lastSuccessfulQuantities[item._id] = item.quantity;
      localQuantities[item._id] = item.quantity;
    });
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

  function debounceUpdateCartItem(id) {
    if (updateTimers[id]) clearTimeout(updateTimers[id]);
    if (busy[id]?.isBusy) return;

    updateTimers[id] = setTimeout(() => {
      const quantity = localQuantities[id];
      const fallbackQuantity = lastSuccessfulQuantities[id] ?? quantity;

      busy[id] = { isBusy: true, lastUpdated: Date.now() };

      const apiClient = getApi();
      if (!apiClient) {
        localQuantities[id] = fallbackQuantity;
        updateFrontendQuantity(id, fallbackQuantity);
        delete busy[id];
        showToast("خطأ في الاتصال بالخادم", "error");
        return;
      }

      requestWithTimeout(
        apiClient.post('/cart/change', {
          itemId: id,
          quantity: quantity,
          options: []
        }),
        10000
      )
        .then((res) => {
          try {
            console.log('[updateCartItem] success:', {
              itemId: id,
              newQuantity: quantity,
              itemsLength: res?.items?.length,
              totalQuantity: res?.totalQuantity,
            });
          } catch (_) {}
          
          // Update cart with response data
          if (window.updateCart) {
            window.updateCart(res);
          }

          // ✅ حدّث آخر كمية ناجحة
          const updatedItem = res?.items?.find(i => i._id === id);
          if (updatedItem) {
            lastSuccessfulQuantities[id] = updatedItem.quantity;
            localQuantities[id] = updatedItem.quantity;
            updateFrontendQuantity(id, updatedItem.quantity);
          }
        })
        .catch((err) => {
          // ❌ رجع لآخر كمية ناجحة
          localQuantities[id] = fallbackQuantity;
          updateFrontendQuantity(id, fallbackQuantity);
          console.error(`updateCartItem error for item ${id}`, err);
          showToast(err.message || "لا تتوفر كمية أكثر من هذا المنتج للخيارات المختارة", "error");
        })
        .finally(() => {
          delete busy[id];
        });
    }, 400);
  }

  function updateFrontendQuantity(id, quantity) {
    const item = globals.cart.items.find((i) => i._id === id);
    if (item) item.quantity = quantity;
  }

  return {
    busy,
    inbusy(id) { return busy[id]?.isBusy || false; },

    handleQuantityInput(id, rawValue) {
      let value = parseInt(rawValue, 10);

      if (isNaN(value) || value < 1) {
        value = 1;
      }

      if (!(id in localQuantities)) {
        const item = globals.cart.items.find((i) => i._id === id);
        const currentQuantity = item?.quantity || 1;
        localQuantities[id] = currentQuantity;
        lastSuccessfulQuantities[id] = currentQuantity;
      }

      localQuantities[id] = value;
      updateFrontendQuantity(id, value);
      debounceUpdateCartItem(id);
    },
    clearCartItem(id) {
      console.log("🚀 ~ xDataCart ~ id:", id)
      
      busy[id] = { isBusy: true, lastUpdated: Date.now() };
      
      const apiClient = getApi();
      if (!apiClient) {
        delete busy[id];
        showToast("خطأ في الاتصال بالخادم", "error");
        return;
      }

      requestWithTimeout(
        apiClient.post('/cart/remove', { itemId: id }),
        10000
      )
        .then((res) => {
          if (window.updateCart) {
            window.updateCart(res);
          }
          delete lastSuccessfulQuantities[id];
          delete localQuantities[id];
          showToast('تم حذف المنتج', 'success');
        })
        .catch((err) => {
          console.error(`clearCartItem error for item ${id}`, err);
          showToast(err.message || 'فشل حذف المنتج', 'error');
        })
        .finally(() => {
          delete busy[id];
        });
    },

    decreaseCartItem(id, currentQuantity) {
      if (!(id in localQuantities)) {
        localQuantities[id] = currentQuantity;
        lastSuccessfulQuantities[id] = currentQuantity;
      }
      if (localQuantities[id] > 1) {
        localQuantities[id]--;
        updateFrontendQuantity(id, localQuantities[id]);
        debounceUpdateCartItem(id);
      }
    },

    increaseCartItem(id, currentQuantity) {
      if (!(id in localQuantities)) {
        localQuantities[id] = currentQuantity;
        lastSuccessfulQuantities[id] = currentQuantity;
      }

      localQuantities[id]++;
      updateFrontendQuantity(id, localQuantities[id]);
      debounceUpdateCartItem(id);
    },

    checkout() {
      if (window.updateLoading) {
        window.updateLoading('checkout', true);
      }
      
      // Redirect to checkout page
      window.location.href = '/checkout';
      
      // Alternative: if you need to use API for checkout
      // const apiClient = getApi();
      // if (apiClient) {
      //   apiClient.get('/checkout')
      //     .then((res) => {
      //       if (res?.url) {
      //         window.location.href = res.url;
      //       }
      //     })
      //     .catch((err) => {
      //       console.error('Checkout error:', err);
      //       showToast(err.message || 'فشل إنشاء صفحة الدفع', 'error');
      //     })
      //     .finally(() => {
      //       if (window.updateLoading) {
      //         window.updateLoading('checkout', false);
      //       }
      //     });
      // } else {
      //   window.location.href = '/checkout';
      //   if (window.updateLoading) {
      //     window.updateLoading('checkout', false);
      //   }
      // }
    },
  };
}

window.xDataCart = xDataCart;
