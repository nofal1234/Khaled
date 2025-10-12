

document.addEventListener('DOMContentLoaded', () => {
	(document?.getElementById('spinner-container')).style.display = 'none';

  // الحصول على عناصر الصفحة التي نحتاجها
  const userActionLinks = document.querySelectorAll('.user-actions a');
  const modal = document.getElementById('supplier-modal');
  const closeButton = document.querySelector('.close-button');
  // وظيفة لإظهار النافذة المنبثقة
  const showModal = (event) => {
      // منع الرابط من الانتقال إلى صفحة أخرى
      event.preventDefault(); 
      // إضافة الكلاس 'show' لإظهار النافذة المنبثقة
      modal.classList.add('show');
  };

  // وظيفة لإخفاء النافذة المنبثقة
  const hideModal = () => {
      // إزالة الكلاس 'show' لإخفاء النافذة المنبثقة
      modal.classList.remove('show');
  };

  // إضافة مستمعي الأحداث لجميع الروابط المحددة
  userActionLinks.forEach(link => {
      // إضافة مستمع حدث 'click' لكل رابط
      link.addEventListener('click', showModal);
  });

  // عند النقر على زر الإغلاق (X)، قم بإخفاء النافذة
  closeButton.addEventListener('click', hideModal);

  // عند النقر خارج النافذة المنبثقة، قم بإخفائها
  window.addEventListener('click', (event) => {
      if (event.target === modal) {
          hideModal();
      }
  });

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

		updateLoading(type, value) {
			this.globalLoading[type] = value;
		},
		updateCartItem(id, item) {
			// const item = this?.globals?.cart?.items?.find(i => i._id === id);
			if (item) item = item
		},
		updateCart(data) {
			this.globals.cart = data;
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
  });
  