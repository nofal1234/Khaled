  (function () {
    const normalize = (s) =>
      String(s ?? '')
        .replace(/\u0640/g, '')      
        .replace(/[أإآ]/g, 'ا')      
        .replace(/ة/g, 'ه')          
        .replace(/ى/g, 'ي')          
        .toLowerCase()
        .trim();

    function groupItems(items) {
      const map = new Map();
      for (const it of items) {
        const k = it.group || 'القائمة الرئيسية';
        if (!map.has(k)) map.set(k, []);
        map.get(k).push(it);
      }
      return Array.from(map.entries())
        .sort((a, b) => {
          if (a[0] === 'القائمة الرئيسية') return -1;
          if (b[0] === 'القائمة الرئيسية') return 1;
          return a[0].localeCompare(b[0], 'ar');
        })
        .map(([label, items]) => ({ label, items }));
    }

    window.xDataSidebar = function xDataSidebar({ menu = [] } = {}) {
      const source = (menu ?? []).map(i => ({
        title: i?.title ?? 'بدون عنوان',
        url: i?.url ?? '#',
        group: i?.group ?? 'القائمة الرئيسية',
      }));

      return {
        q: '',
        open: false,
        activeIndex: -1,

        get groupedResults() {
          const qn = normalize(this.q);
          if (!qn) return [];
          const filtered = source.filter(it => {
            const t = normalize(it.title);
            const g = normalize(it.group);
            const u = normalize(it.url);
            return t.includes(qn) || g.includes(qn) || u.includes(qn);
          });
          return groupItems(filtered);
        },
        get _flatMap() {
          const prefix = [];
          let acc = 0;
          for (const g of this.groupedResults) {
            prefix.push(acc);
            acc += g.items.length;
          }
          return { prefix, total: acc };
        },
        flatIndex(gi, idx) { return this._flatMap.prefix[gi] + idx; },

        // actions
        openSearch() {
          this.open = true;
          this.$nextTick(() => this.$refs.searchInput?.focus());
        },
        closeSearch() {
          this.open = false;
          this.q = '';
          this.activeIndex = -1;
        },
        move(step) {
          const total = this._flatMap.total;
          if (!total) return;
          this.activeIndex = this.activeIndex === -1
            ? (step > 0 ? 0 : total - 1)
            : (this.activeIndex + step + total) % total;
          this.$nextTick(() => {
            const el = this.$root.querySelector('[data-active="true"]');
            el?.scrollIntoView({ block: 'nearest' });
          });
        },
        go() {
          if (this.activeIndex < 0) return;
          // حوّل الفهرس المسطح إلى gi/idx
          const { prefix } = this._flatMap;
          let gi = 0;
          while (gi < prefix.length && prefix[gi] <= this.activeIndex) gi++;
          gi = Math.max(0, gi - 1);
          const idx = this.activeIndex - prefix[gi];
          const item = this.groupedResults[gi]?.items[idx];
          if (item?.url) {
            // اقفل السايدبار (لو عندك toggleModal)
            this.$root.toggleModal?.('sidebar', false);
            this.closeSearch();
            window.location.href = item.url;
          }
        },
      };
    };
  })();
