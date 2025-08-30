class FreeShippingBar extends HTMLElement {
  constructor() {
    super();
  }

  connectedCallback() {
    this.amountToSpendElement = this.querySelector('amount-to-spend');
    this.amountLeftElement = this.querySelector('amount-left');
    this.moneyValueLeftElement =
      this.amountLeftElement.querySelector('money-value');
    this.minimumReachedElement = this.querySelector('minimum-reached');
    this.track = this.querySelector('free-shipping-bar-track');

    this.minimumValue = Number(this.getAttribute('minimum-value'));
    this.value = Number(this.getAttribute('value'));

    this._setVariables();

    this.unsubscribe = window.theme.cart.store.subscribe((state) => {
      if (this.value !== state.products.total_price) {
        this.value = state.products.total_price;
        this._update();
      }

      if (
        this.value >= this.minimumValue &&
        this.classList.contains('is-visible')
      ) {
        this.track.addEventListener(
          'transitionend',
          () => {
            setTimeout(() => {
              this._playGoalAnimation();
            }, 250);
          },
          {
            once: true,
          },
        );
      }
    });

    this.revealDelay = this.getAttribute('reveal-delay') || 0;

    setTimeout(() => {
      const goalAnimationElement = this.querySelector(
        'free-shipping-bar-goal-animation',
      );

      if (goalAnimationElement && window.lottie && !this.goalAnimation) {
        this.goalAnimation = lottie.loadAnimation({
          container: goalAnimationElement,
          renderer: 'svg',
          loop: false,
          autoplay: false,
          useWebWorker: false,
          path: goalAnimationElement.getAttribute('data-url'),
        });
      }
    });

    let options = {
      rootMargin: '0px',
      threshold: 1.0,
    };

    this.visibilityObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        setTimeout(() => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');

            setTimeout(() => {
              if (this.amountLeft === 0) this._playGoalAnimation();
            }, 1000);

            this.visibilityObserver.disconnect();
          }
        }, this.revealDelay);
      });
    }, options);

    this.visibilityObserver.observe(this);
  }

  disconnectedCallback() {
    this.classList.remove('is-visible');
    if (this.visibilityObserver) this.visibilityObserver.disconnect();
  }

  _setVariables() {
    this.amountLeft =
      this.minimumValue - this.value <= 0 ? 0 : this.minimumValue - this.value;
    this.moneyLeft = window.Shopify.formatMoney(
      this.amountLeft,
      window.theme.money_format,
    ).replace(/[\.,]00$/, '');
    this.displacement = Math.round((this.amountLeft / this.minimumValue) * 100);
  }

  _update() {
    this.setAttribute('value', this.value);
    this._setVariables();

    if (this.moneyValueLeftElement)
      this.moneyValueLeftElement.innerHTML = this.moneyLeft;

    if (this.value > 0) {
      this.amountToSpendElement.setAttribute('hidden', '');
    } else {
      this.amountToSpendElement.removeAttribute('hidden');
    }

    if (this.value === 0 || this.amountLeft === 0) {
      this.amountLeftElement.setAttribute('hidden', '');
    } else {
      this.amountLeftElement.removeAttribute('hidden');
    }

    if (this.amountLeft > 0) {
      this.minimumReachedElement.setAttribute('hidden', '');
    } else {
      this.minimumReachedElement.removeAttribute('hidden');
    }

    //  TODO: Animate properly once per cart session
    // this._playGoalAnimation();
    this.track.style.setProperty('--displacement', `${this.displacement}%`);
  }

  _playGoalAnimation() {
    const animationShown = Boolean(
      localStorage.getItem('freeShippingAnimationShown'),
    );

    if (animationShown) return;

    if (this.goalAnimation) {
      localStorage.setItem('freeShippingAnimationShown', true);
      this.goalAnimation.play();
    }
  }
}
customElements.define('free-shipping-bar', FreeShippingBar);
