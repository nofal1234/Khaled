function xDataSearch() {
  const Request = window?.qumra?.storeGate || (() => Promise.reject("storeGate not found"));

  const schema = {
    findAllCollections: `query FindAllCollections($input: GetAllCollectionsInput) {
        findAllCollections(input: $input) {
          success
          data {
            _id title slug description operation
            image { fileUrl _id }
          }
        }
      }`,
    findAllProducts: `query FindAllProducts($input: GetAllProductsInput) {
  findAllProducts(input: $input) {
    data {
      _id
      title
      slug
      description
      app
      tags
      status
      images {
        _id
        fileUrl
      }
      collections {
        title
        image {
          _id
          fileUrl
        }
      }
    }
  }
}`,
  };

  const normalize = (s) =>
    (s ?? "")
      .toString()
      .trim()
      .toLowerCase()
      .replace(/\s+/g, " ");

  return {
    // state
    products: [],
    collections: [],
    search: "",
    suggestions: [],
    isLoading: false,
    _debounce: null,

    // methods
    async fetchData() {
      try {
        this.isLoading = true;
        const [prodRes, collRes] = await Promise.all([
          Request(schema.findAllProducts),
          Request(schema.findAllCollections),
        ]);
        this.products = prodRes?.findAllProducts?.data || [];
        this.collections = collRes?.findAllCollections?.data || [];
      } catch (e) {
        console.error(e);
        showToast?.("حدث خطأ أثناء تحميل البيانات", "error");
      } finally {
        this.isLoading = false;
        this.updateSuggestions(); // لو فيه قيمة بالفعل
      }
    },

    updateSuggestions() {
      if (!this.search?.trim()) {
        this.suggestions = [];
        return;
      }
    
      Request(schema.findAllProducts, {
        input: { title: this.search }  
      })
        .then((res) => {
          this.suggestions = res?.findAllProducts?.data || [];
        })
        .catch(() => {
          this.suggestions = [];
        });
    },

    onInput() {
      clearTimeout(this._debounce);
      this._debounce = setTimeout(() => this.updateSuggestions(), 1000);
    },

    goTo(item) {
      if (!item?.slug) return;
      window.location.href = "/product/" + encodeURIComponent(item.slug);
    },

    setSearch(q) {
      const s = (q ?? "").toString().trim();
      if (!s) return;
      window.location.href = `/search?q=${encodeURIComponent(s)}`;
    },

    init() {
      // قراءة قيمة البحث من الكونتكست أو URL
      if (!this.search) {
        const fromCtx = window.__qumra__?.context?.search?.q;
        const fromUrl = new URLSearchParams(location.search).get("q");
        this.search = (fromCtx || fromUrl || "").toString();
      }

      // راقب أي تغيّر للبحث (لو اتغير بطرق أخرى)
      this.$watch("search", () => this.onInput());

      this.fetchData();
    },
  };
}

window.xDataSearch = xDataSearch;