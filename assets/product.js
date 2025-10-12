function xDataproduct({ product }) {
  const Request = window.qumra.storeGate
  
  // Helper function for showing toasts
  const showToast = (message, type = 'info', duration = 3000) => {
    if (window.showToast) {
      window.showToast(message, type, duration);
    } else {
      console.log(`[${type.toUpperCase()}] ${message}`);
    }
  };

  const schema = {
    addToCart: `mutation AddToCart($data: AddToCartInput!) {
  addToCart(data: $data) {
    data {
      _id
      app
      items {
        productId
        _id
        variantId
        productData {
          title
          slug
          app
          image {
            _id
            fileUrl
          }
          price
        }
        variantData {
          compareAtPrice
          options {
            _id
            label
            option {
              _id
              name
            }
          }
          price
        }
        quantity
        price
        compareAtPrice
        totalPrice
        totalCompareAtPrice
        totalSavings
      }
      deviceId
      sessionId
      status
      totalQuantity
      totalPrice
      totalCompareAtPrice
      totalSavings
      isFastOrder
    }
    success
    message
  }
}`,
    buyNow: `mutation BuyNow($data: AddToCartInput!) {
  buyNow(data: $data) {
    success
    message
    url
    encryptionKey
  }
}
    `,
    resolvePrice: `mutation ResolvePrice($input: ResolvePriceInput!) {
  resolvePrice(input: $input) {
    success
    message
    data {
      product {
        _id
        pricing {
          originalPrice
          compareAtPrice
          price
        }
      }
    }
  }
}`
  }
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
    get areOptionsSelected() {
      if (product?.options?.length) {
        return product.options.every(opt => Boolean(this.selectedOptions[opt._id]));
      }
      return true; 
    },

    resolvePrice(prod) {
      if (!prod?.options?.length) {
        this.loading.optionsLoading = false;
        return;
      }
      
      const allSelected = prod.options.every(
        (opt) => Boolean(this.selectedOptions[opt._id])
      );
      if (!allSelected) {
        console.log('Not all options are selected yet');
        this.loading.optionsLoading = false;
        return;
      }
      
      // Check if all selected values are valid
      const invalidSelections = prod.options.filter(opt => {
        const selectedValue = this.selectedOptions[opt._id];
        const validValues = opt.values.map(v => v._id);
        return !validValues.includes(selectedValue);
      });
      
      if (invalidSelections.length > 0) {
        console.error('Invalid option selections:', invalidSelections);
        this.loading.optionsLoading = false;
        showToast("خيارات غير صحيحة", "error");
        return;
      }

      const selectedOptionValues = prod.options.map(
        (opt) => this.selectedOptions[opt._id]
      );

      // Log the selected options for debugging
      console.log('Selected options:', this.selectedOptions);
      console.log('Product options:', prod.options);
      console.log('Selected option values:', selectedOptionValues);

      const input = {
        productId: prod._id,
        quantity: this.productQuantity,
        options: selectedOptionValues,
      };

      console.log('Resolving price with input:', input);

      this.loading.priceAtCall = true;
      
      // Check if Request function exists
      if (typeof Request !== 'function') {
        console.error('Request function is not defined');
        this.loading.priceAtCall = false;
        this.loading.optionsLoading = false;
        showToast("خطأ في الاتصال بالخادم", "error");
        return;
      }

      Request(schema.resolvePrice, { input })
        .then((res) => {
          console.log('Price resolution response:', res);
          const ok = res?.resolvePrice?.success;
          if (ok) {
            this.resolvedPrice = res.resolvePrice.data.product.pricing;
            showToast("تم تحديث السعر بنجاح", "success");
          } else {
            const errorMessage = res?.resolvePrice?.message || "تعذر تحديث السعر";
            console.error('Price resolution failed:', errorMessage);
            // Don't show error toast for "Matching variant not found" - just stop loading
            if (!errorMessage.includes('Matching variant not found')) {
              showToast(errorMessage, "error");
            }
          }
        })
        .catch((error) => {
          console.error('Price resolution error:', error);
          // Don't show error toast for "Matching variant not found" - just stop loading
          if (!error.message?.includes('Matching variant not found')) {
            showToast("حدث خطأ أثناء تحديث السعر", "error");
          }
        })
        .finally(() => {
          this.loading.priceAtCall = false;
          this.loading.optionsLoading = false;
        });
    },

    initOptions() {
      // if (!product?.options) return;
      // this.selectedOptions = {};
      // product.options.forEach((opt) => {
      //   this.selectedOptions[opt._id] = opt.values?.[0]?._id || null;
      // });
      // this.resolvePrice(product);
      if (product?.options.length == 0) return;
      else showToast("يرجى تحديد الخيارات", "success");

    },

    selectOption(prod, optionId, valueId) {
      console.log('Selecting option:', { optionId, valueId, product: prod._id });
      this.selectedOptions[optionId] = valueId;
      this.loading.optionsLoading = true;
      
      // Add timeout as backup to prevent infinite loading
      setTimeout(() => {
        if (this.loading.optionsLoading) {
          this.loading.optionsLoading = false;
        }
      }, 10000); // 10 seconds timeout
      
      // Only resolve price if product has options and we have valid selections
      if (prod?.options?.length > 0) {
        // Check if all options are selected
        const allSelected = prod.options.every(
          (opt) => Boolean(this.selectedOptions[opt._id])
        );
        
        if (allSelected) {
          // Check if we have valid variants for this product
          if (prod.variants && prod.variants.length > 0) {
            this.resolvePrice(prod);
          } else {
            // No variants available, just stop loading
            console.log('No variants available for this product');
            this.loading.optionsLoading = false;
          }
        } else {
          // Not all options selected yet, just stop loading
          this.loading.optionsLoading = false;
        }
      } else {
        this.loading.optionsLoading = false;
      }
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
      this.updateLoading("addToCart", true);
      
      if (typeof Request !== 'function') {
        console.error('Request function is not defined');
        this.updateLoading("addToCart", false);
        showToast("خطأ في الاتصال بالخادم", "error");
        return;
      }
      
      // Use options as is - they should already be in the correct format
      let formattedOptions = options;
      
      Request(schema.addToCart, { data: { productId, quantity, options: formattedOptions } })
        .then((res) => {
          const ok = res?.addToCart?.success;
          if (ok) {
            if (window.updateCart) {
              window.updateCart(res.addToCart.data);
            }
            this.toggleProductModal("productDetails", false);
            showToast(
              res?.addToCart?.message || "تمت إضافة المنتج للسلة بنجاح",
              "success"
            );
          } else {
            showToast(
              res?.addToCart?.message || "فشل إضافة المنتج للسلة",
              "error"
            );
          }
        })
        .catch((error) => {
          console.error('Add to cart error:', error);
          showToast("حدث خطأ أثناء الإضافة للسلة", "error");
        })
        .finally(() => this.updateLoading("addToCart", false));
    },

    buyNowProduct(payload) {
      this.updateLoading("buyNow", true);
      
      if (typeof Request !== 'function') {
        console.error('Request function is not defined');
        this.updateLoading("buyNow", false);
        showToast("خطأ في الاتصال بالخادم", "error");
        return;
      }
      
      // Use options as is - they should already be in the correct format
      
      Request(schema.buyNow, payload)
        .then((res) => {
          const ok = res?.buyNow?.success;
          if (ok && res?.buyNow?.url) {
            showToast("جارٍ تحويلك لصفحة الدفع...", "success", 2000);
            window.location.href = res.buyNow.url;
          } else {
            showToast(res?.buyNow?.message || "فشل عملية الشراء", "error");
          }
        })
        .catch((error) => {
          console.error('Buy now error:', error);
          showToast("حدث خطأ أثناء عملية الشراء", "error");
        })
        .finally(() => this.updateLoading("buyNow", false));
    },

    decreaseCartItem() {
      if (this.productQuantity <= (product?.minQuantity || 1)) {
        showToast(`الحد الادني لكمية المنتج هو ${product?.minQuantity || 1}`, "error");
        return;
      }
      this.productQuantity -= 1;
    },
    increaseCartItem() {
      const max = this.product?.quantity;
      console.log(max, product, this.productQuantity);
      if (this.productQuantity >= max) {
        showToast("لا تتوفر كمية أكثر من هذا المنتج", "error");
        return;
      }
      this.productQuantity += 1;
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
      this.quantity = product?.productQuantity || 1;
      this.ProductModal.data = product;
      if (open) this.initOptions();
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
     if(productHandler.product.options.length > 0 && !productHandler.areOptionsSelected) {
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