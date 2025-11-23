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
  const lastSuccessfulQuantities = {};
  const clickGuards = {}; // منع التكرار السريع للنقر

  function getQtyFromGlobals(id) {
    try {
      const items = window?.globals?.cart?.items;
      if (!Array.isArray(items)) return undefined;
      const it = items.find((i) => i._id === id);
      return it ? it.quantity : undefined;
    } catch (e) {
      return undefined;
    }
  }

  function syncFromCartData(cartData) {
    const items = (cartData && cartData.items) || window?.globals?.cart?.items || [];
    if (!Array.isArray(items)) return;
    items.forEach((item) => {
      lastSuccessfulQuantities[item._id] = item.quantity;
      localQuantities[item._id] = item.quantity;
    });
    try { recalcCartTotals(); } catch (e) {}
  }

  // initial sync
  syncFromCartData(window?.globals?.cart);

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
      const fallbackQuantity = (lastSuccessfulQuantities[id] ?? getQtyFromGlobals(id) ?? quantity ?? 1);
      busy[id] = { isBusy: true, lastUpdated: Date.now() }; // فعّل السكيلتون للعنصر

      requestWithTimeout(Request(schema.updateCartItem, { data: { itemId: id, quantity } }), 10000)
        .then((res) => {
          const payload = res?.updateCartItem;
          if (payload?.success) {
            const data = payload.data;
            if (data) {
              updateCart(data);
              // updateCart() already recalculates everything correctly, no need to call updateFrontendQuantity again
              if (Array.isArray(data.items)) {
                data.items.forEach((it) => {
                  lastSuccessfulQuantities[it._id] = it.quantity;
                  localQuantities[it._id] = it.quantity;
                });
              } else {
                lastSuccessfulQuantities[id] = quantity;
                localQuantities[id] = quantity;
              }
            } else {
              lastSuccessfulQuantities[id] = quantity;
              localQuantities[id] = quantity;
            }
            window?.showToast?.("تم تحديث الكمية بنجاح", "success");
          } else {
            const serverQty = payload?.data?.items?.find((i) => i._id === id)?.quantity;
            const rollbackQty = (serverQty ?? lastSuccessfulQuantities[id] ?? getQtyFromGlobals(id) ?? fallbackQuantity);
            localQuantities[id] = rollbackQty;
            updateFrontendQuantity(id, rollbackQty);
            window?.showToast?.(payload?.message || "تعذر تحديث المنتج", "error");
            if (payload?.data) syncFromCartData(payload.data);
          }
        })
        .catch((err) => {
          const rollbackQty = (lastSuccessfulQuantities[id] ?? getQtyFromGlobals(id) ?? fallbackQuantity ?? 1);
          localQuantities[id] = rollbackQty;
          updateFrontendQuantity(id, rollbackQty);
          console.error(`updateCartItem error for item ${id}`, err);
        })
        .finally(() => {
          delete busy[id]; // شيل السكيلتون
        });
    }, 500);
  }

  function recalcCartTotals() {
    const cart = window.globals?.cart;
    if (!cart || !Array.isArray(cart.items)) return;
    let totalPrice = 0;
    let totalCompareAtPrice = 0;
    let totalSavings = 0;
    let totalQuantity = 0;
    cart.items.forEach((it) => {
      const qty = Number(it.quantity) || 0;
      const coalesce = (...vals) => vals.find(v => Number.isFinite(Number(v)) && Number(v) > 0);
      
      // احسب السعر الوحدة من القيم الأصلية فقط (تجنب استخدام totalPrice لتجنب الأخطاء التراكمية)
      let unitPrice = coalesce(
        it.price,
        it?.variantData?.price,
        it?.productData?.pricing?.price,
        it?.productData?.price
      );
      
      // فقط إذا لم يكن هناك سعر وحدة محفوظ، احسبه من totalPrice الحالي
      // ولكن فقط إذا كان totalPrice موجود وصحيح
      if (!unitPrice && qty > 0 && it.totalPrice && Number(it.totalPrice) > 0) {
        unitPrice = Number(it.totalPrice) / qty;
        // احفظ السعر الوحدة في it.price لتجنب إعادة الحساب
        if (!it.price) it.price = unitPrice;
      }
      
      unitPrice = unitPrice || 0;
      
      const unitCompare = coalesce(
        it.compareAtPrice,
        it?.variantData?.compareAtPrice,
        it?.productData?.pricing?.compareAtPrice,
        it?.productData?.compareAtPrice,
        it?.productData?.pricing?.originalPrice,
        it?.productData?.price,
        unitPrice
      ) || 0;
      
      // احسب الأسعار الإجمالية بناءً على الكمية الحالية
      it.totalPrice = unitPrice * qty;
      it.totalCompareAtPrice = unitCompare * qty;
      it.totalSavings = Math.max(0, it.totalCompareAtPrice - it.totalPrice);
      totalPrice += it.totalPrice;
      totalCompareAtPrice += it.totalCompareAtPrice;
      totalSavings += it.totalSavings;
      totalQuantity += qty;
    });
    cart.totalPrice = totalPrice;
    cart.totalCompareAtPrice = totalCompareAtPrice;
    cart.totalSavings = totalSavings;
    cart.totalQuantity = totalQuantity;
  }

  function updateFrontendQuantity(id, quantity) {
    const item = globals.cart.items.find((i) => i._id === id);
    if (item) {
      const oldQty = Number(item.quantity) || 1;
      item.quantity = quantity;
      
      // حفظ السعر الوحدة الصحيح من القيم الموجودة (بدون إعادة حساب من totalPrice)
      // لتجنب أخطاء التراكم عند تغيير الكمية
      const qty = Number(quantity) || 0;
      const coalesce = (...vals) => vals.find(v => Number.isFinite(Number(v)) && Number(v) > 0);
      
      // احسب السعر الوحدة من القيم الأصلية فقط (لا تستخدم totalPrice لأنه قد يكون خاطئ)
      let unitPrice = coalesce(
        item.price,
        item?.variantData?.price,
        item?.productData?.pricing?.price,
        item?.productData?.price
      );
      
      // إذا لم يكن هناك سعر وحدة محفوظ، احسبه من totalPrice القديم والكمية القديمة
      if (!unitPrice && oldQty > 0 && item.totalPrice) {
        unitPrice = Number(item.totalPrice) / oldQty;
        // احفظ السعر الوحدة في item.price لتجنب إعادة الحساب
        if (!item.price) item.price = unitPrice;
      }
      
      unitPrice = unitPrice || 0;
      
      const unitCompare = coalesce(
        item.compareAtPrice,
        item?.variantData?.compareAtPrice,
        item?.productData?.pricing?.compareAtPrice,
        item?.productData?.compareAtPrice,
        item?.productData?.pricing?.originalPrice,
        item?.productData?.price,
        unitPrice
      ) || 0;
      
      // احسب الأسعار الجديدة بناءً على الكمية الجديدة
      item.totalPrice = unitPrice * qty;
      item.totalCompareAtPrice = unitCompare * qty;
      item.totalSavings = Math.max(0, item.totalCompareAtPrice - item.totalPrice);
      
      // تحديث الإجماليات
      recalcCartTotals();
    }
  }

  return {
    busy,
    get globals() { 
      // تأكد من أن globals.cart.items موجود دائماً
      const g = window?.globals || {};
      if (!g.cart) g.cart = { items: [] };
      if (!Array.isArray(g.cart.items)) g.cart.items = [];
      return g;
    }, // الوصول إلى globals من window
    get isEmpty() {
      const items = window?.globals?.cart?.items;
      return !items || !Array.isArray(items) || items.length === 0;
    },
    inbusy(id) { return busy[id]?.isBusy || false; }, // تستخدمها في الـ x-if للسكيلتون

    clearCartItem(id) {
      busy[id] = { isBusy: true, lastUpdated: Date.now() }; // سكيلتون للعنصر أثناء الحذف
      requestWithTimeout(Request(schema.removeCartItem, { data: { itemId: id } }), 10000)
        .then((res) => {
          const data = res?.removeCartItem?.data || {};
          if (res?.removeCartItem?.success) {
            updateCart(data);
            syncFromCartData(data);
            window?.showToast?.("تم حذف المنتج من السلة. يمكنك إضافته مرة أخرى في أي وقت", "success");
          } else {
            delete lastSuccessfulQuantities[id];
            delete localQuantities[id];
          }
        })
        .catch((err) => console.error(`clearCartItem error for item ${id}`, err))
        .finally(() => {
          delete busy[id];
        });
    },

    decreaseCartItem(id, currentQuantity) {
      const now = Date.now();
      if (clickGuards[id] && now - clickGuards[id] < 250) return; // منع الازدواج
      clickGuards[id] = now;
      if (!(id in localQuantities)) {
        localQuantities[id] = currentQuantity;
        lastSuccessfulQuantities[id] = (lastSuccessfulQuantities[id] ?? getQtyFromGlobals(id) ?? currentQuantity);
      }
      if (localQuantities[id] > 1) {
        localQuantities[id]--;
        updateFrontendQuantity(id, localQuantities[id]);
        debounceUpdateCartItem(id);
      }
    },

    increaseCartItem(id, currentQuantity) {
      const now = Date.now();
      if (clickGuards[id] && now - clickGuards[id] < 250) return; // منع الازدواج
      clickGuards[id] = now;
      if (!(id in localQuantities)) {
        localQuantities[id] = currentQuantity;
        lastSuccessfulQuantities[id] = (lastSuccessfulQuantities[id] ?? getQtyFromGlobals(id) ?? currentQuantity);
      }
      localQuantities[id]++;
      updateFrontendQuantity(id, localQuantities[id]);
      debounceUpdateCartItem(id);
    },

    updateQuantityFromInput(id, event) {
      const newQuantity = parseInt(event.target.value) || 1;
      if (newQuantity > 0) {
        localQuantities[id] = newQuantity;
        updateFrontendQuantity(id, localQuantities[id]);
        debounceUpdateCartItem(id);
      }
    },

    checkout() {
      try {
        updateLoading('checkout', true);
        const go = window?.qumra?.checkout;
        if (typeof go === 'function') {
          Promise.resolve(go())
            .catch(() => { try { this.open = false; } catch(_){} })
            .finally(() => updateLoading('checkout', false));
        } else {
          try { this.open = false; } catch(_){}
          window.location.href = '/checkout';
          updateLoading('checkout', false);
        }
      } catch (_) {
        try { this.open = false; } catch(_){}
        updateLoading('checkout', false);
        window.location.href = '/checkout';
      }
    },
  };
}

window.xDataCart = xDataCart;
