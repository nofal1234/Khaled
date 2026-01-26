function xDataSearch() {
  // Helper function for showing toasts
  const showToast = (message, type = 'info', duration = 3000) => {
    if (window.showToast) {
      window.showToast(message, type, duration);
    } else {
      console.log(`[${type.toUpperCase()}] ${message}`);
    }
  };

  return {
    search: "",
    suggestions: [],
    isLoading: false,
    isOpen: false,
    api: null,
    _debounce: null,
    _timer: null,
    _lastQuery: null,
    trending: {
      products: [],
      collections: []
    },
    results: {
      products: [],
      collections: []
    },

    init() {
      this.api = window.Api ? window.Api('/ajax') : null;
      if (!this.api) {
        console.error('Api function is not available');
      }

      // Initialize search from context or URL
      if (!this.search) {
        const fromCtx = window.__qumra__?.context?.search?.q;
        const fromUrl = new URLSearchParams(location.search).get("q");
        this.search = (fromCtx || fromUrl || "").toString();
      }

      this.watchQuery();

      // Fetch suggestions if search term exists
      if (this.search?.trim()) {
        this.updateSuggestions();
      }

      // Optional: fetch trending
      // this.fetchTrending();
    },

    watchQuery() {
      this.$watch('search', value => {
        clearTimeout(this._timer);
        
        if (!value || value.length < 2) {
          this.suggestions = [];
          this.results.products = [];
          this.results.collections = [];
          this.isLoading = false;
          return;
        }

        this.isLoading = true;
        this._timer = setTimeout(() => {
          if (value === this._lastQuery) {
            this.isLoading = false;
            return;
          }
          this._lastQuery = value;
          this.updateSuggestions();
        }, 300);
      });
    },

    fetchTrending() {
      if (!this.api) return;

      this.api
        .get('/search/trending')
        .then(res => {
          this.trending.products = res?.products || [];
          this.trending.collections = res?.collections || [];
        })
        .catch(err => {
          console.error('Fetch trending error:', err);
        });
    },

    async updateSuggestions() {
      const term = this.search?.trim();
      if (!term) {
        this.suggestions = [];
        this.isLoading = false;
        return;
      }

      if (!this.api) {
        this.api = window.Api ? window.Api('/ajax') : null;
        if (!this.api) {
          console.error('Api function is not available');
          this.isLoading = false;
          return;
        }
      }

      try {
        this.isLoading = true;
        this.isOpen = true;

        // Use query string for GET request
        const queryString = `?q=${encodeURIComponent(term)}`;
        const res = await this.api.get(`/search${queryString}`);

        const products = res?.products || [];
        const collections = res?.collections || [];
        
        this.suggestions = [
          ...collections.map((item) => ({ ...item, __type: "collection" })),
          ...products.map((item) => ({ ...item, __type: "product" })),
        ];

        // Also update results for consistency
        this.results.products = products;
        this.results.collections = collections;
      } catch (e) {
        console.error('Search error:', e);
        this.suggestions = [];
        this.results.products = [];
        this.results.collections = [];
        showToast("Error loading data", "error");
      } finally {
        this.isLoading = false;
      }
    },

    onInput() {
      // This is kept for backward compatibility
      // The watchQuery will handle it automatically
      clearTimeout(this._debounce);
      this.isLoading = true;
      this._debounce = setTimeout(() => this.updateSuggestions(), 300);
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

    open() {
      this.isOpen = true;
    },

    close() {
      this.isOpen = false;
    },

    reset() {
      this.search = '';
      this.suggestions = [];
      this.results.products = [];
      this.results.collections = [];
    },

    get showTrending() {
      return !this.search || this.search.trim().length === 0;
    },

    get showResults() {
      return !!this.search && this.search.trim().length > 0;
    },
  };
}

window.xDataSearch = xDataSearch;
