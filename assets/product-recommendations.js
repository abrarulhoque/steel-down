class ProductRecommendations extends HTMLElement {
  constructor() {
    super();

    this.fetch_delay = 0;
  }

  connectedCallback() {
    this.onPageLoad = this.hasAttribute('on-page-load');

    if (this.onPageLoad) {
      this._loadRecommendations();
    } else {
      const handleIntersection = (entries, observer) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            observer.unobserve(this);

            this.fetch_delay = Number(
              window.theme?.complementary_products_fetch_delay || '0',
            );

            setTimeout(() => {
              this._loadRecommendations();
            }, this.fetch_delay);
          }
        });
      };

      new IntersectionObserver(handleIntersection.bind(this), {
        rootMargin: '0px 0px 400px 0px',
      }).observe(this);
    }
  }

  _loadRecommendations() {
    fetch(this.dataset.url)
      .then((response) => response.text())
      .then((text) => {
        const html = document.createElement('div');
        html.innerHTML = text;
        const recommendations = html.querySelector('product-recommendations');

        if (recommendations && recommendations.innerHTML.trim().length) {
          const existingContentCards = this.querySelectorAll('.product-card');
          const newContentCards = Array.from(
            recommendations.querySelectorAll('.product-card'),
          );

          if (
            newContentCards.length > 0 &&
            newContentCards.length > 0 &&
            existingContentCards.length === newContentCards.length
          ) {
            existingContentCards.forEach((card, i) =>
              card.replaceWith(newContentCards[i]),
            );
          } else {
            this.innerHTML = recommendations.innerHTML;
          }

          if (this.dataset.quickShopDynamicCheckout === 'true') {
            let shopifyPaymentButtonInterval = setInterval(() => {
              if (window.Shopify.PaymentButton) {
                window.Shopify.PaymentButton.init();

                clearInterval(shopifyPaymentButtonInterval);
              }
            }, 50);
          }

          if (
            document.body.dataset.animLoad === 'true' &&
            typeof window.sr !== 'undefined' &&
            !this.hasAttribute('animated')
          ) {
            const title = this.querySelector('.section__title');

            if (title) {
              window.sr.reveal(title, {
                interval: 50,
              });
            }

            const cardsToAnimate = this.querySelectorAll('.product-card-top');

            cardsToAnimate.forEach((el) => {
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
      })
      .catch((e) => {
        console.error(e);
      });
  }
}

customElements.define('product-recommendations', ProductRecommendations);
