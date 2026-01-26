function xDataproduct({ product }) {

  // Helper function for showing toasts
  const showToast = (message, type = 'info', duration = 3000) => {
    if (window.showToast) {
      window.showToast(message, type, duration);
    } else {
      console.log(`[${type.toUpperCase()}] ${message}`);
    }
  };

  return {
    productQuantity: 1,
    product,
    localType: null,
    ProductModal: { type: null, data: null, open: false },
    loading: {
      checkout: false,
      priceAtCall: false,
      priceAtCallWhatsApp: false,
      addToCart: false,
      buyNow: false,
      optionsLoading: false,
    },
    selectedOptions: {},
    resolvedPrice: {},
    variantImage:[],
    variant: null,
    api: null,
    _variantTimer: null,
    _syncingQty: false,
    isInitializing: true,
    init() {
      this.api = window.Api ? window.Api('/ajax') : null;
      if (!this.api) {
        console.error('Api function is not available');
      }
      this.initOptions();
      this.$nextTick(() => {
        this.isInitializing = false;
        this.watchOptions();
        this.watchQuantity();
        this.watchStock();
        this.fetchVariant();
      });
    },
    clearOptions() {
      this.selectedOptions = {};
    },
    get areOptionsSelected() {
      if (product?.options?.length) {
        return product.options.every(opt => Boolean(this.selectedOptions[opt._id]));
      }
      return true;
    },
    get options() {
      return Object.values(this.selectedOptions);
    },
    hasInvalidOptions() {
      return this.options.some(v => !v);
    },
    get price() {
      return this.variant?.pricing?.price ?? this.resolvedPrice?.price ?? product?.pricing?.price ?? 0;
    },
    get compareAtPrice() {
      return this.variant?.pricing?.compareAtPrice ?? this.resolvedPrice?.compareAtPrice ?? product?.pricing?.compareAtPrice ?? null;
    },
    get stock() {
      return this.variant?.quantity ?? this.product?.quantity ?? product?.quantity ?? 0;
    },
    get isOutOfStock() {
      return this.stock <= 0;
    },
    get maxQty() {
      return this.stock > 0 ? this.stock : 1;
    },
    setQty(next) {
      if (this._syncingQty) return;
      this._syncingQty = true;
      this.productQuantity = next;
      this.$nextTick(() => (this._syncingQty = false));
    },
    fetchVariant() {
      if (!this.api) {
        this.api = window.Api ? window.Api('/ajax') : null;
        if (!this.api) return;
      }

      if (!this.options?.length) return;

      clearTimeout(this._variantTimer);

      this._variantTimer = setTimeout(() => {
        if (this.hasInvalidOptions()) {
          this.loading.optionsLoading = false;
          return;
        }

        this.loading.optionsLoading = true;
        this.loading.priceAtCall = true;

        this.api
          .post('/product/resolve-variant-by-options', {
            productId: this.product._id,
            options: this.options,
          })
          .then(res => {
            this.variant = res.data || null;
            if (this.variant) {
              this.resolvedPrice = this.variant.pricing || {};
              this.variantImage = this.variant.images || [];
              this.product.quantity = this.variant.quantity ?? this.product.quantity;
              this.setQty(1);
              showToast("تم تحديث السعر بنجاح", "success");
            } else {
              this.variant = null;
              this.resolvedPrice = {};
              this.variantImage = [];
            }
          })
          .catch(err => {
            console.error('Variant fetch error:', err);
            this.variant = null;
            this.resolvedPrice = {};
            this.variantImage = [];
            if (!err.message?.includes('Matching variant not found')) {
              showToast(err.message || "حدث خطأ أثناء تحديث السعر", "error");
            }
          })
          .finally(() => {
            this.loading.optionsLoading = false;
            this.loading.priceAtCall = false;
          });
      }, 250);
    },
    watchOptions() {
      this.$watch(
        'selectedOptions',
        () => {
          if (this.isInitializing) return;
          this.setQty(1);
          this.fetchVariant();
        },
        { deep: true }
      );

      if (Object.keys(this.selectedOptions).length === 0) {
        this.fetchVariant();
      }
    },
    watchQuantity() {
      this.$watch('productQuantity', value => {
        if (this._syncingQty) return;

        if (value < 1) {
          this.setQty(1);
          return;
        }

        if (this.stock > 0 && value > this.stock) {
          this.setQty(this.stock);
          return;
        }

        if (this.stock <= 0 && value !== 1) {
          this.setQty(1);
        }
      });
    },
    watchStock() {
      this.$watch('stock', value => {
        if (value <= 0) {
          if (this.productQuantity !== 1) this.setQty(1);
          return;
        }

        if (this.productQuantity > value) {
          this.setQty(value);
        }
      });
    },

    initOptions() {
      if (!product?.options?.length) return;
      
      this.selectedOptions = {};
      product.options.forEach((opt) => {
        this.selectedOptions[opt._id] = null;
      });

      this.$nextTick(() => {
        product.options.forEach((opt) => {
          const firstValue = opt.values?.[0]?._id;
          if (firstValue) {
            this.selectedOptions[opt._id] = firstValue;
          }
        });
      });
    },

    selectOption(prod, optionId, valueId) {
      console.log('Selecting option:', { optionId, valueId, product: prod._id });
      this.selectedOptions[optionId] = valueId;
      // fetchVariant will be called automatically via watchOptions
    },

    // ------- Form submission -------
    submitForm(e) {
      const form = e.target;
      const formData = new FormData(form);
      const optionsArray = formData.getAll("options[]");
      const productId = formData.get("product");
      const quantity = +formData.get("quantity");
      const btn = e.submitter;

      if (btn?.name === "addToCart") {
        this.addProductToCart(productId, quantity, optionsArray);
      } else if (btn?.name === "buyNow") {
        this.buyNowProduct({
          data: { productId, quantity, options: optionsArray },
        });
      }
    },

    addProductToCart(productId, quantity, options = []) {
      if (this.loading.addToCart) return;

      if (this.hasInvalidOptions()) {
        showToast("يرجى تحديد جميع الخيارات", "error");
        return;
      }

      if (this.isOutOfStock) {
        showToast("المنتج غير متوفر حالياً", "error");
        return;
      }

      this.updateLoading("addToCart", true);

      if (!this.api) {
        this.api = window.Api ? window.Api('/ajax') : null;
        if (!this.api) {
          console.error('Api function is not available');
          this.updateLoading("addToCart", false);
          showToast("خطأ في الاتصال بالخادم", "error");
          return;
        }
      }

      this.api
        .post('/cart/add', {
          productId,
          quantity,
          options: this.options.length > 0 ? this.options : options,
        })
        .then((res) => {
          if (window.updateCart) {
            window.updateCart(res.data);
          }
          this.toggleProductModal("productDetails", false);
          showToast(
            res?.message || "تمت إضافة المنتج للسلة بنجاح",
            "success"
          );

          // افتح درج السلة بعد الإضافة الناجحة
          try { 
            window.dispatchEvent(new CustomEvent("open-cart")); 
            window.dispatchEvent(new CustomEvent("cart:refresh"));
          } catch (_) { }
        })
        .catch((error) => {
          console.error('Add to cart error:', error);
          showToast(error.message || "حدث خطأ أثناء الإضافة للسلة", "error");
        })
        .finally(() => this.updateLoading("addToCart", false));
    },

    async buyNowProduct(payload) {
      if (this.loading.buyNow) return;

      if (this.hasInvalidOptions()) {
        showToast("يرجى تحديد جميع الخيارات", "error");
        return;
      }

      if (this.isOutOfStock) {
        showToast("المنتج غير متوفر حالياً", "error");
        return;
      }

      this.updateLoading("buyNow", true);

      if (!this.api) {
        this.api = window.Api ? window.Api('/ajax') : null;
        if (!this.api) {
          console.error('Api function is not available');
          this.updateLoading("buyNow", false);
          showToast("خطأ في الاتصال بالخادم", "error");
          return;
        }
      }

      try {
        // Clear cart first
        await this.api.post('/cart/clear');

        // Add product to cart
        const data = payload?.data || {};
        await this.api.post('/cart/add', {
          productId: data.productId || this.product._id,
          quantity: data.quantity || this.productQuantity,
          options: this.options.length > 0 ? this.options : (data.options || []),
        });

        // Redirect to checkout
        showToast("جارٍ تحويلك لصفحة الدفع...", "success", 2000);
        window.location.href = '/checkout';
      } catch (error) {
        console.error('Buy now error:', error);
        showToast(error.message || "حدث خطأ أثناء عملية الشراء", "error");
      } finally {
        this.updateLoading("buyNow", false);
      }
    },
    decreaseCartItem() {
      if (this.productQuantity <= (product?.minQuantity || 1)) {
        showToast(`الحد الادني لكمية المنتج هو ${product?.minQuantity || 1}`, "error");
        return;
      }
      this.setQty(this.productQuantity - 1);
    },
    increaseCartItem() {
      const max = this.stock;
      if (this.productQuantity >= max) {
        showToast("لا تتوفر كمية أكثر من هذا المنتج", "error");
        return;
      }
      this.setQty(this.productQuantity + 1);
    },


    checkout() {
      this.loading.checkout = true;
      window.Qumra?.order
        ?.checkout()
        .then((res) => {
          if (res?.url) {
            showToast("جارٍ تحويلك لصفحة الدفع...", "success", 2000);
            window.location.href = res.url;
          } else {
            showToast("تعذر بدء عملية الدفع", "error");
          }
        })
        .catch(() => showToast("حدث خطأ أثناء الدفع", "error"))
        .finally(() => {
          this.loading.checkout = false;
        });
    },

    updateLoading(key, val) {
      if (key in this.loading) this.loading[key] = val;
    },

    toggleProductModal(type, open) {
      this.ProductModal.type = type;
      this.ProductModal.open =
        open !== undefined ? open : !this.ProductModal.open;
      this.productQuantity = product?.productQuantity || 1;
      this.ProductModal.data = product;
      if (open) {
        this.initOptions();
        if (!this.api) {
          this.init();
        }
      }
    },
  };
}

window.xDataproduct = xDataproduct;

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("productForm");
  if (!form) return;
  const productHandler = document.querySelector('[x-ref="productComponent"]')
    ?._x_dataStack?.[0];

  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const formData = new FormData(form);
    const optionsArray = formData.getAll("options[]");
    const productId = formData.get("product");
    const quantity = +formData.get("quantity");

    // Check if productHandler exists and has the required data
    if (!productHandler || !productHandler.product) {
      console.error('Product handler or product data not available');
      return;
    }

    console.log(productHandler.areOptionsSelected, productHandler.product);
    if (productHandler.product?.options?.length > 0 && !productHandler.areOptionsSelected) {
      const showToast = (message, type = 'info') => {
        if (window.showToast) {
          window.showToast(message, type);
        } else {
          console.log(`[${type.toUpperCase()}] ${message}`);
        }
      };
      showToast("يرجى تحديد الخيارات", "error");
      return;
    }

    const data = { productId, quantity, options: optionsArray };
    const btn = e.submitter;

    if (btn?.name === "addToCart") {
      productHandler.addProductToCart(productId, quantity, optionsArray);
    } else if (btn?.name === "buyNow") {
      productHandler.buyNowProduct({ data });
    }
  });
});