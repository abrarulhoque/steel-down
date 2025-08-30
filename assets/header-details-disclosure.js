class HeaderDetailsDisclosure extends DetailsDisclosure {
  constructor() {
    super();
    this._boundMouseEnterListener = this.mouseEnterListener.bind(this);
    this._boundMouseLeaveListener = this.mouseLeaveListener.bind(this);
  }

  connectedCallback() {
    this._summaryLink = this.querySelector('summary > a');

    if (!this.mainDetailsToggle.hasAttribute('open'))
      this._disableSummaryLink();

    this.mainDetailsToggle.addEventListener(
      'mouseenter',
      this._boundMouseEnterListener,
    );

    this.mainDetailsToggle.addEventListener(
      'mouseleave',
      this._boundMouseLeaveListener,
    );
  }

  disconnectedCallback() {
    this.disableListeners();
  }

  open() {
    this.mainDetailsToggle.setAttribute('open', '');
    this.querySelector('summary').setAttribute('aria-expanded', true);

    if (
      this.content.getBoundingClientRect().x + this.content.offsetWidth >
      window.innerWidth - 30
    ) {
      this.content.classList.add('is-left-aligned');
    }

    if (this.hasAttribute('adjust-mega-menu-height'))
      this._setContentHeight(36);
  }

  close() {
    this.mainDetailsToggle.removeAttribute('open');
    this.mainDetailsToggle
      .querySelector('summary')
      .setAttribute('aria-expanded', false);

    this.content.classList.remove('is-left-aligned');

    if (this.hasAttribute('adjust-mega-menu-height'))
      this._removeContentHeight();
  }

  onToggle() {
    if (!this.panelAnimations)
      this.panelAnimations = this.content.getAnimations();
    if (!this.contentAnimations) {
      this.contentAnimations = Array.from(
        this.querySelectorAll('.has-animation'),
      ).reduce((animations, element) => {
        const animation = element.getAnimations();
        return [...animations, ...animation];
      }, []);
    }

    if (this.mainDetailsToggle.hasAttribute('open')) {
      setTimeout(() => {
        this._enableSummaryLink();
      }, 50);

      // dropdown animation reset
      this.panelAnimations.forEach((animation) => animation.play());
      // mega items animation reset
      this.contentAnimations.forEach((animation) => animation.play());

      document.body.setAttribute('header-menu-open', '');
    } else {
      this._disableSummaryLink();
      // dropdown animation cancel
      this.panelAnimations.forEach((animation) => animation.cancel());
      // mega items animation cancel
      this.contentAnimations.forEach((animation) => animation.cancel());

      document.body.removeAttribute('header-menu-open', '');
    }
  }

  mouseEnterListener() {
    if (
      !document
        .querySelector('body')
        .hasAttribute('header-details-disclosure-edit')
    )
      this.open();
  }

  mouseLeaveListener() {
    if (
      !document
        .querySelector('body')
        .hasAttribute('header-details-disclosure-edit')
    )
      this.close();
  }

  disableListeners() {
    this.mainDetailsToggle.removeEventListener(
      'mouseenter',
      this._boundMouseEnterListener,
    );
    this.mainDetailsToggle.removeEventListener(
      'mouseleave',
      this._boundMouseLeaveListener,
    );
  }

  _setContentHeight(padding = 0) {
    const headerSection = document.querySelector('.js-header');
    const headerBottomBoundary =
      headerSection && headerSection.getBoundingClientRect().bottom > 0
        ? headerSection.getBoundingClientRect().bottom
        : 0;
    const combinedPanelCutoff = Math.round(headerBottomBoundary + padding);

    if (this.content.offsetHeight > window.innerHeight - combinedPanelCutoff) {
      this.content.style.setProperty(
        '--header-elements-height',
        `${combinedPanelCutoff}px`,
      );
      this.content.classList.add('has-height-control');
    }
  }

  _removeContentHeight() {
    this.content.classList.remove('has-height-control');
  }

  _summaryLinkListener(e) {
    e.preventDefault();
  }

  _enableSummaryLink() {
    if (this._summaryLink)
      this._summaryLink.removeEventListener('click', this._summaryLinkListener);
  }

  _disableSummaryLink() {
    if (this._summaryLink)
      this._summaryLink.addEventListener('click', this._summaryLinkListener);
  }
}

customElements.define('header-details-disclosure', HeaderDetailsDisclosure);
