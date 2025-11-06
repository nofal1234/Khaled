document.addEventListener('DOMContentLoaded', () => {
  const spinner = document.getElementById('spinner-container');
  if (spinner) spinner.style.display = 'none';

  // الحصول على عناصر الصفحة التي نحتاجها (قد لا تكون موجودة على كل الصفحات)
  const userActionLinks = document.querySelectorAll('.user-actions a');
  const modal = document.getElementById('supplier-modal');
  const closeButton = document.querySelector('.close-button');

  // وظيفة لإظهار النافذة المنبثقة
  const showModal = (event) => {
    if (!modal) return;
    // منع الرابط من الانتقال إلى صفحة أخرى
    event.preventDefault(); 
    // إضافة الكلاس 'show' لإظهار النافذة المنبثقة
    modal.classList.add('show');
  };

  // وظيفة لإخفاء النافذة المنبثقة
  const hideModal = () => {
    if (!modal) return;
    // إزالة الكلاس 'show' لإخفاء النافذة المنبثقة
    modal.classList.remove('show');
  };

  if (userActionLinks && userActionLinks.length) {
    userActionLinks.forEach((link) => {
      // إضافة مستمع حدث 'click' لكل رابط
      link.addEventListener('click', showModal);
    });
  }

  if (closeButton) {
    // عند النقر على زر الإغلاق (X)، قم بإخفاء النافذة
    closeButton.addEventListener('click', hideModal);
  }

  if (modal) {
    // عند النقر خارج النافذة المنبثقة، قم بإخفائها
    window.addEventListener('click', (event) => {
      if (event.target === modal) {
        hideModal();
      }
    });
  }
});

function GlobalState() {
  const config = window.qumra || {};

  return {
    ...__qumra__,
    globalLoading: {
      page: false,
      cart: false,
      checkout: false,
      addToCart: false,
      buyNow: false,
    },
		globalLoading: {
			page: false,
			cart: false,
			checkout: false,
			addToCart: false,
            buyNow: false,
		},

		updateLoading(type, value) {
			this.globalLoading[type] = value;
		},
		updateCartItem(id, item) {
			// const item = this?.globals?.cart?.items?.find(i => i._id === id);
			if (item) item = item
		},
		updateCart(data) {
			this.globals.cart = data;
			// Ensure item and cart totals are populated even if backend omits them
			try {
				const cart = this.globals.cart || {};
				const items = Array.isArray(cart.items) ? cart.items : [];
				let totalPrice = 0, totalCompareAtPrice = 0, totalSavings = 0, totalQuantity = 0;
				items.forEach((it) => {
					const qty = Number(it.quantity) || 0;
					const inferFromTotals = (t) => (qty > 0 ? Number(t) / qty : undefined);
					const coalesce = (...vals) => vals.find(v => Number.isFinite(Number(v)) && Number(v) > 0);
					const unitPrice = coalesce(
						it.price,
						it?.variantData?.price,
						inferFromTotals(it?.totalPrice),
						it?.productData?.pricing?.price,
						it?.productData?.price,
						0
					) || 0;
					const unitCompare = coalesce(
						it.compareAtPrice,
						it?.variantData?.compareAtPrice,
						inferFromTotals(it?.totalCompareAtPrice),
						it?.productData?.pricing?.compareAtPrice,
						it?.productData?.compareAtPrice,
						it?.productData?.pricing?.originalPrice,
						it?.productData?.price,
						unitPrice,
						0
					) || 0;
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
			} catch (_) {}
	   },
	   showToast(message, type = "success") {
		Toastify({
			text: message,
			duration: 3000,
			close: true,
			gravity: "top", 
			position: "right", 
			stopOnFocus: true,
			style: {
				background: type === "success" ? "linear-gradient(to right, #00b09b, #96c93d)"
					: "linear-gradient(to right, #ff5f6d, #ffc371)",
			},
		}).showToast();
	},
		modal: {
			open: false,
			type: "",
		},
		toggleModal(type, open) {
			this.modal = {
				open: open !== undefined ? open : !this.modal.open,
				type: type,
			}
		},
		init() {
			window.toggleModal = this.toggleModal.bind(this);
			window.updateCart = this.updateCart.bind(this);
			window.updateCartItem = this.updateCartItem.bind(this);
			window.updateLoading = this.updateLoading.bind(this);
			// window.setSearch = this.setSearch.bind(this);
			window.updateLoading = this.updateLoading.bind(this);
			window.globalLoading = this.globalLoading;
			window.globals = this.globals;
			window.showToast = this.showToast.bind(this);
			 
		},
	};
}
window.GlobalState = GlobalState();

document.addEventListener("DOMContentLoaded", () => {
	const loginElements = document.getElementsByClassName("login");
	const logoutElements = document.getElementsByClassName("logout");
  
	Array.from(loginElements).forEach((el) => {
	  el.addEventListener("click", () => {
		window.qumra?.login?.();
	  });
	});
  
	Array.from(logoutElements).forEach((el) => {
	  el.addEventListener("click", () => {
		window.qumra?.logout?.();
	  });
	});
  
  // Global quick Add-To-Cart (works from product lists/cards)
  if (!window.addProductToCart) {
    const Request = window.qumra?.storeGate;
    const addToCartSchema = `mutation AddToCart($data: AddToCartInput!) {
  addToCart(data: $data) {
    data {
      _id app
      items {
        productId _id variantId
        productData { title slug app image { _id fileUrl } price }
        variantData { compareAtPrice price options { _id label option { _id name } } }
        quantity price compareAtPrice totalPrice totalCompareAtPrice totalSavings
      }
      deviceId sessionId status totalQuantity totalPrice totalCompareAtPrice totalSavings isFastOrder
    }
    success message
  }
}`;

    window.addProductToCart = function(productId, quantity = 1, options = []) {
      if (typeof Request !== "function") {
        window.showToast?.("خطأ في الاتصال بالخادم", "error");
        return;
      }
      const data = { productId, quantity, options };
      window.updateLoading?.("addToCart", true);
      Request(addToCartSchema, { data })
        .then((res) => {
          const ok = res?.addToCart?.success;
          if (ok) {
            window.updateCart?.(res.addToCart.data);
            window.showToast?.(res?.addToCart?.message || "تمت إضافة المنتج للسلة بنجاح", "success");
            window.dispatchEvent(new CustomEvent("open-cart"));
          } else {
            window.showToast?.(res?.addToCart?.message || "فشل إضافة المنتج للسلة", "error");
          }
        })
        .catch(() => window.showToast?.("حدث خطأ أثناء الإضافة للسلة", "error"))
        .finally(() => window.updateLoading?.("addToCart", false));
    }
  }
  });
  