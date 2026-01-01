function xDataSearch() {
  const Request = window?.qumra?.storeGate || (() => Promise.reject("storeGate not found"));

  const schema = {
    findAllSearch: `query FindAllSearch($input: GetAllProductsInput, $collectionsInput: GetAllCollectionsInput) {
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
  findAllCollections(input: $collectionsInput) {
    message
    data {
      _id
      title
      slug
      description
      operation
      image { fileUrl _id }
    }
  }
}`,
  };

  return {
    search: "",
    suggestions: [],
    isLoading: false,
    _debounce: null,

    async updateSuggestions() {
      const term = this.search?.trim();
      if (!term) {
        this.suggestions = [];
        return;
      }

      try {
        this.isLoading = true;
        const res = await Request(schema.findAllSearch, {
          input: { title: term },
          collectionsInput: { title: term },
        });
        const products = res?.findAllProducts?.data || [];
        const collections = res?.findAllCollections?.data || [];
        this.suggestions = [
          ...collections.map((item) => ({ ...item, __type: "collection" })),
          ...products.map((item) => ({ ...item, __type: "product" })),
        ];
      } catch (e) {
        console.error(e);
        this.suggestions = [];
        showToast?.("Error loading data", "error");
      } finally {
        this.isLoading = false;
      }
    },

    onInput() {
      clearTimeout(this._debounce);
      this._debounce = setTimeout(() => this.updateSuggestions(), 3000);
    },

    goTo(item) {
      if (!item) return;

      if (item.__type === "collection") {
        const handle = item.slug || item.handle || item.operation;
        if (handle) {
          window.location.href = "/collection/" + encodeURIComponent(handle);
        }
        return;
      }

      if (item.slug) {
        window.location.href = "/product/" + encodeURIComponent(item.slug);
      }
    },

    setSearch(q) {
      const s = (q ?? "").toString().trim();
      if (!s) {
        window.location.href = "/search";
        return;
      }
      window.location.href = `/search?q=${encodeURIComponent(s)}`;
    },

    init() {
      if (!this.search) {
        const fromCtx = window.__qumra__?.context?.search?.q;
        const fromUrl = new URLSearchParams(location.search).get("q");
        this.search = (fromCtx || fromUrl || "").toString();
      }

      this.$watch("search", () => this.onInput());

      if (this.search?.trim()) {
        this.updateSuggestions();
      }
    },
  };
}

window.xDataSearch = xDataSearch;
