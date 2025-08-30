class ProductRecentlyViewed extends HTMLElement {
  constructor() {
    super();
    this.fetchDelay = 0;
  }

  connectedCallback() {
    this.onPageLoad = this.hasAttribute('on-page-load');

    if (this.onPageLoad) {
      this._loadRecentlyViewed();
    } else {
      new IntersectionObserver(
        this._onIntersection.bind(this),
        { rootMargin: '0px 0px 400px 0px' }
      ).observe(this);
    }
  }

  _onIntersection(entries, observer) {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        observer.unobserve(this);
        this.fetchDelay = Number(window.theme?.complementary_products_fetch_delay || '0');
        setTimeout(() => this._loadRecentlyViewed(), this.fetchDelay);
      }
    });
  }

  _loadRecentlyViewed() {
    const allHandles = JSON.parse(localStorage.getItem('recentlyViewed')) || [];
    if (!allHandles.length) return;

    const maxItems = 6; // or read from data-max-items: Number(this.dataset.maxItems)
    const handles = allHandles.slice(0, maxItems);
    const fetches = handles.map(handle =>
      fetch(`/products/${handle}?view=card`).then(res => res.text())
    );

    Promise.all(fetches)
      .then(snippets => {
        const container = this.querySelector('[data-items]');
        container.innerHTML = snippets.join('');
        this._initAnimations();
      })
      .catch(console.error);
  }

  _initAnimations() {
    if (
      document.body.dataset.animLoad === 'true' &&
      typeof window.sr !== 'undefined' &&
      !this.hasAttribute('animated')
    ) {
      const title = this.querySelector('.section__title');
      if (title){
        window.sr.reveal(title, { interval: 5 });
        setTimeout(function(){
          title.style.opacity = '1';
        },10)
      }

      this.querySelectorAll('.product-card-top').forEach(el => {
        const container = el.closest('.grid-layout');
        window.sr.reveal(el, {
          container,
          origin: 'bottom',
          interval: 50,
          reset: true,
        });
      });
    }
  }
}

customElements.define('product-related', ProductRecentlyViewed);