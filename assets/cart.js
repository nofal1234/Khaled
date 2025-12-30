function xDataCart() {
  const Request = window.qumra.storeGate;
  const schema = {
    removeCartItem: `mutation removeCartItem($data: RemoveCartItemInput!) {
      removeCartItem(data: $data) {
        data {
          _id app
          items {
            productId _id variantId
            productData { title slug app image { _id fileUrl } price }
            variantData {
              compareAtPrice
              options { _id label option { _id name } }
              price
            }
            quantity price compareAtPrice totalPrice totalCompareAtPrice totalSavings
          }
          deviceId sessionId status totalQuantity totalPrice totalCompareAtPrice totalSavings isFastOrder
        }
        success message
      }
    }`,
    updateCartItem: `mutation UpdateCartItem($data: updateCartItemInput!) {
      updateCartItem(data: $data) {
        success message
        data {
          _id app
          items {
            productId _id variantId
            productData { title slug app image { fileUrl _id } price }
            variantData {
              price compareAtPrice
              options { label _id option { _id name } }
            }
            quantity price compareAtPrice totalPrice totalCompareAtPrice totalSavings
          }
          deviceId sessionId status totalQuantity totalPrice totalCompareAtPrice totalSavings isFastOrder
        }
      }
    }`,
    createCheckoutToken: `mutation UpdateCartItem($input: CreateCheckoutTokenInput!) {
      createCheckoutToken(input: $input) { success message encryptionKey url }
    }`,
  };

  const updateTimers = {};
  const localQuantities = {};
  const lastSuccessfulQuantities = {}; // آخر كمية ناجحة
  const busy = Alpine.reactive({});

  // عند تشغيل الكارت أول مرة، خزّن الكميات الحالية كـ ناجحة
  if (globals.cart?.items) {
    globals.cart.items.forEach((item) => {
      lastSuccessfulQuantities[item._id] = item.quantity;
      localQuantities[item._id] = item.quantity;
    });
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

      requestWithTimeout(Request(schema.updateCartItem, { data: { itemId: id, quantity } }), 10000)
        .then((res) => {
          if (res?.updateCartItem?.success) {
            try {
              const data = res.updateCartItem.data;
              console.log('[updateCartItem] success:', {
                itemId: id,
                newQuantity: quantity,
                itemsLength: data?.items?.length,
                totalQuantity: data?.totalQuantity,
              });
            } catch (_) {}
            updateCart(res.updateCartItem.data);

            // ✅ حدّث آخر كمية ناجحة
            const updatedItem = res.updateCartItem.data.items.find(i => i._id === id);
            if (updatedItem) {
              lastSuccessfulQuantities[id] = updatedItem.quantity;
              localQuantities[id] = updatedItem.quantity;
              updateFrontendQuantity(id, updatedItem.quantity);
            }
          } else {
            // ❌ رجع لآخر كمية ناجحة
            localQuantities[id] = fallbackQuantity;
            updateFrontendQuantity(id, fallbackQuantity);
            try { console.log('[updateCartItem] failed:', res?.updateCartItem); } catch (_) {}
            // نفس رسالة تجاوز الكمية المتاحة المستخدمة في صفحة تفاصيل المنتج
            showToast(res?.updateCartItem?.message || "لا تتوفر كمية أكثر من هذا المنتج للخيارات المختارة", "error");
          }
        })
        .catch((err) => {
          localQuantities[id] = fallbackQuantity;
          updateFrontendQuantity(id, fallbackQuantity);
          console.error(`updateCartItem error for item ${id}`, err);
        })
        .finally(() => {
          delete busy[id];
        });
    }, 500);
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
      requestWithTimeout(Request(schema.removeCartItem, { data: { itemId: id } }), 10000)
        .then((res) => {
          updateCart(res.removeCartItem.data);
          delete lastSuccessfulQuantities[id];
          delete localQuantities[id];
        })
        .catch((err) => console.error(`clearCartItem error for item ${id}`, err))
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
      updateLoading('checkout', true);
      window.qumra.checkout().finally(() => updateLoading('checkout', false));
    },
  };
}

window.xDataCart = xDataCart;
