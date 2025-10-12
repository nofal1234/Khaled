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
  const busy = Alpine.reactive({}); // حالة كل عنصر

  function requestWithTimeout(promise, timeout = 10000) {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Request timeout')), timeout)),
    ]);
  }

  function debounceUpdateCartItem(id) {
    if (updateTimers[id]) clearTimeout(updateTimers[id]);
    if (busy[id]?.isBusy) return; // لو العنصر بالفعل في طلب شغال

    updateTimers[id] = setTimeout(() => {
      const quantity = localQuantities[id];
      busy[id] = { isBusy: true, lastUpdated: Date.now() }; // فعّل السكيلتون للعنصر

      requestWithTimeout(Request(schema.updateCartItem, { data: { itemId: id, quantity } }), 10000)
        .then((res) => {
          updateCart(res.updateCartItem.data);
        })
        .catch((err) => console.error(`updateCartItem error for item ${id}`, err))
        .finally(() => {
          delete busy[id]; // شيل السكيلتون
        });
    }, 500);
  }

  function updateFrontendQuantity(id, quantity) {
    const item = globals.cart.items.find((i) => i._id === id);
    if (item) item.quantity = quantity;
  }

  return {
    busy,
    inbusy(id) { return busy[id]?.isBusy || false; }, // تستخدمها في الـ x-if للسكيلتون

    clearCartItem(id) {
      busy[id] = { isBusy: true, lastUpdated: Date.now() }; // سكيلتون للعنصر أثناء الحذف
      requestWithTimeout(Request(schema.removeCartItem, { data: { itemId: id } }), 10000)
        .then((res) => {
          updateCart(res.removeCartItem.data);
        })
        .catch((err) => console.error(`clearCartItem error for item ${id}`, err))
        .finally(() => {
          delete busy[id];
        });
    },

    decreaseCartItem(id, currentQuantity) {
      if (!(id in localQuantities)) localQuantities[id] = currentQuantity;
      if (localQuantities[id] > 1) {
        localQuantities[id]--;
        updateFrontendQuantity(id, localQuantities[id]);
        debounceUpdateCartItem(id);
      }
    },

    increaseCartItem(id, currentQuantity) {
      if (!(id in localQuantities)) localQuantities[id] = currentQuantity;
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
