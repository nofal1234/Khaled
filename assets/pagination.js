export function xDataPagination(context) {
    return {
      currentPage: context.pagination.page || 1,
      pagesPerView: 4,
      get startPage() {
        let half = Math.floor(this.pagesPerView / 2);
        let start = this.currentPage - half;
        if (start < 1) start = 1;
        let end = start + this.pagesPerView - 1;
        if (end > context.pagination.totalPages) {
          end = context.pagination.totalPages;
          start = Math.max(1, end - this.pagesPerView + 1);
        }
        return start;
      },

      get pagesToShow() {
        return Array.from(
          { length: this.pagesPerView },
          (_, i) => this.startPage + i
        ).filter((p) => p <= context.pagination.totalPages);
      },
  
      setPagination(page) {
        if (page < 1 || page > context.pagination.totalPages) return;
        this.currentPage = page;
        window.updateLoading("page", true);
  
        Qumra.products.setPage(page).then((res) => {
          this.currentPage = res.data.pagination.page;
          window.updateContext({ products: res.data.products });
          window.updateLoading("page", false);
        });
      },
  
      nextPage() {
        this.setPagination(this.currentPage + 1);
      },
  
      prevPage() {
        this.setPagination(this.currentPage - 1);
      }
    };
  }
  
  window.xDataPagination = xDataPagination;
  