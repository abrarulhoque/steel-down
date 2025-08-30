class ProductSingle extends HTMLElement {
  constructor() {
    super();
  }

  connectedCallback() {
    this.slider = this.querySelector('.js-product-slider');
  }

  updateMedia() {
    if (!this.slider || !this._variant.featured_media) return;

    const mediaId = this._variant.featured_media.id;
    const slide = this.querySelector(
      `.media-gallery__item[data-media-id="${mediaId}"]`,
    );

    if (!slide) return;

    const slideId = slide.getAttribute('data-slide-id');
    if (typeof $ === 'function') {
      const slider = $(this.slider);

      slider.slick('slickGoTo', slideId);
    } else {
      this.slider.setAttribute('data-slide-id', slideId);
    }
  }

  set variant(variant) {
    this._variant = variant;
    this.updateMedia();
  }

  get variant() {
    return this._variant;
  }
}
customElements.define('product-single', ProductSingle);
