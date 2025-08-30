function handle(text) {
  return text
    .toString()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\_/g, '-')
    .replace(/\-\-+/g, '-')
    .replace(/\-$/g, '');
}

class ProductCardMini extends HTMLElement {
  constructor() {
    super();
  }

  connectedCallback() {
    this.image = this.querySelector('img[product-card-image]');
    this.imageContainerRatio = this.getAttribute(
      'image-container-ratio',
    ).trim();
    this.imageFit = this.hasAttribute('image-fit');
    this.quickShopTrigger = this.getAttribute('quick-shop-trigger');

    this._isRendered = this.hasAttribute('rendered');
  }

  set product(product) {
    this._product = product;
    if (!this._isRendered) {
      this._render();
    }
  }

  get product() {
    return this._product;
  }

  set sectionId(id) {
    this._sectionId = id;
  }

  get sectionId() {
    return this._sectionId;
  }

  _render() {
    this.setAttribute('product-id', this._product.id);

    this.querySelectorAll('a[product-card-link]').forEach((link) =>
      link.setAttribute('href', this._product.url),
    );

    if (!this._product.available) {
      this.classList.add('product-card--sold-out');
    } else if (this._product.compare_at_price > this._product.price) {
      this.classList.add('product-card--sale');
    }

    if (this.imageContainerRatio === 'natural') {
      const previewImage = this.querySelector('img[product-card-image]');
      previewImage.closest('.o-ratio').style.paddingBottom = `100%`;
    }

    if (this.product.media && this.product.media.length > 0) {
      const mainImageSource = this.product.media[0].preview_image;

      this._updateImage(
        mainImageSource.src,
        mainImageSource.width,
        mainImageSource.height,
        mainImageSource.alt,
      );

      const secondaryImagePlaceholder = this.querySelector(
        'product-card-secondary-image-placeholder',
      );

      if (secondaryImagePlaceholder && this.product.media[1]) {
        const secondaryImageSource = this.product.media[1].preview_image;
        const secondaryImage = this._renderImage(
          secondaryImageSource.src,
          secondaryImageSource.width,
          secondaryImageSource.height,
          secondaryImagePlaceholder.getAttribute('class'),
          secondaryImageSource.alt,
          this.image.getAttribute('sizes'),
        );

        secondaryImage.setAttribute('product-card-secondary-image', '');

        this.image.parentElement.classList.add(
          'product-card__media--hover-image',
        );

        secondaryImagePlaceholder.replaceWith(secondaryImage);
      }

      if (this.getAttribute('image-hover') === 'zoom') {
        this.image.parentElement.classList.add(
          'product-card__media--hover-zoom',
        );
      }

      if (this.imageContainerRatio === 'natural') {
        this.image.closest('.o-ratio').style.paddingBottom = `${
          (1 / mainImageSource.aspect_ratio) * 100
        }%`;
      } else {
        this.image.closest('.o-ratio').style.paddingBottom = null;
      }

      this._updateSkeleton();
    }

    const vendor = this.querySelector('product-card-vendor');
    if (vendor) {
      vendor.textContent = this._product.vendor;
    }

    this.querySelector('product-card-title').textContent = this._product.title;

    const price = this.querySelector('product-card-price');
    if (price) {
      const variantPrice = `
        <span class="u-hidden-visually">${window.theme.t.regular_price}</span>
        <span class="price__number ${
          this._product.compare_at_price > this._product.price
            ? 'price__number--sale'
            : ''
        }">
          <span class="money">
          ${this._product.price_varies ? window.theme.t.from_price : ''}
          ${Shopify.formatMoney(this._product.price, theme.money_format)}
          </span>
        </span>
        ${
          this._product.compare_at_price > this._product.price
            ? `
              <span class="u-hidden-visually">${
                window.theme.t.sale_price
              }</span>
              <span class="price__compare">
                <span class="money">${Shopify.formatMoney(
                  this._product.compare_at_price,
                  theme.money_format,
                )}
                </span>
              </span>
            `
            : ''
        }
      `;

      price.innerHTML = variantPrice;
    }

    const priceNotes = this.querySelector('product-card-price-notes');
    const currentVariant = this._product.variants.find(
      (variant) => variant.available,
    );
    if (priceNotes && currentVariant && currentVariant.unit_price_measurement) {
      const priceNote = document.createElement('span');
      priceNote.classList.add('price__note', 'price__note--unit');

      const unitPriceTemplate = document.getElementById(
        'template-unit-price',
      ).content;
      priceNote.appendChild(unitPriceTemplate.cloneNode(true));

      priceNotes.appendChild(priceNote);

      const baseUnit = `${
        currentVariant.unit_price_measurement.reference_value !== 1
          ? currentVariant.unit_price_measurement.reference_value
          : ''
      }${currentVariant.unit_price_measurement.reference_unit}`;

      priceNotes.querySelector('unit-price').innerHTML =
        window.Shopify.formatMoney(
          currentVariant.unit_price,
          window.theme.money_format,
        );
      priceNotes.querySelector('base-unit').innerHTML = baseUnit;
    }

    // Quick shop triggers and add to cart buttons
    if (this.quickShopTrigger === 'button') {
      const productCardButton = this.querySelector('product-card-button');

      if (!this._product.available) {
        const soldOutButtonTemplate = document.getElementById(
          `${
            this._sectionId ? `${this._sectionId}--` : ''
          }template-sold-out-button`,
        ).content;

        const quickShopContainer = this.querySelector(
          'product-card-quick-shop',
        );

        if (quickShopContainer) quickShopContainer.remove();

        productCardButton.appendChild(soldOutButtonTemplate.cloneNode(true));
      } else if (this._product.variants && this._product.variants.length > 1) {
        const quickShopButtonTemplate = document.getElementById(
          `${
            this._sectionId ? `${this._sectionId}--` : ''
          }template-quick-shop-button`,
        ).content;
        const quickShopButton = quickShopButtonTemplate.cloneNode(true);

        const link = quickShopButton.querySelector('a');
        if (link) link.href = this._product.url;
        productCardButton.appendChild(quickShopButton);
      } else {
        const addToCartFormTemplate = document.getElementById(
          `${
            this._sectionId ? `${this._sectionId}--` : ''
          }template-add-to-cart-form`,
        ).content;
        const addToCartForm = addToCartFormTemplate.cloneNode(true);

        addToCartForm.querySelector('input[name="id"]').value =
          this._product.variants[0].id;

        const themeSpinnerTemplate =
          document.getElementById('template-spinner').content;
        const spinner = themeSpinnerTemplate.cloneNode(true);
        addToCartForm
          .querySelector('product-card-button-spinner')
          .appendChild(spinner);

        const quickShopContainer = this.querySelector(
          'product-card-quick-shop',
        );

        if (quickShopContainer) quickShopContainer.remove();

        productCardButton.appendChild(addToCartForm);
      }
    }

    const quickShopContainer = this.querySelector('product-card-quick-shop');
    if (
      quickShopContainer &&
      !(
        this.quickShopTrigger === 'button' &&
        (!this._product.available || this._product.variants.length === 1)
      )
    ) {
      const quickShopTemplate = document.getElementById(
        `${this._sectionId ? `${this._sectionId}--` : ''}template-quick-shop`,
      ).content;

      const quickShop = quickShopTemplate
        .cloneNode(true)
        .querySelector('quick-shop');

      if (quickShop.hasAttribute('placeholder')) {
        quickShop.setAttribute('data-product-url', this._product.url);
      }

      quickShopContainer.replaceWith(quickShop);
    }

    this.setAttribute('rendered', '');
    this._isRendered = true;
  }

  _renderImage(
    url,
    width,
    height,
    classes = '',
    alt = '',
    sizes = '100vw',
    srcsetWidths = [180, 360, 540, 720, 900, 1080, 1296, 1512],
  ) {
    if (!url || !width || !height) return null;

    const image = document.createElement('img');
    const imageContainerRatio =
      this.imageContainerRatio !== 'natural'
        ? this.imageContainerRatio
            .split(':')
            .reduce((ratio, value) => (ratio !== 0 ? value / ratio : value), 0)
        : null;
    const aspectRatio = width / height;
    const uncroppedImage =
      this.imageContainerRatio === 'natural' ||
      (imageContainerRatio && this.imageFit);

    let masterWidth = width;
    let masterHeight = height;

    if (!uncroppedImage) {
      masterHeight = Math.round(masterWidth * imageContainerRatio);

      if (masterHeight > height) {
        masterHeight = height;
        masterWidth = Math.round(masterHeight / imageContainerRatio);
      }
    }

    const srcset = srcsetWidths.reduce((srcset, srcWidth) => {
      const srcHeight = Math.round(
        uncroppedImage
          ? srcWidth / aspectRatio
          : srcWidth * imageContainerRatio,
      );

      if (srcWidth > masterWidth || srcHeight > masterHeight) return srcset;

      return `${srcset}${url}${url.includes('?') ? '&' : '?'}width=${srcWidth}${
        !uncroppedImage ? `&height=${srcHeight}&crop=center` : ''
      } ${srcWidth}w ${srcHeight}h, `;
    }, '');

    const masterSrc = !uncroppedImage
      ? `${url}${
          url.includes('?') ? '&' : '?'
        }width=${masterWidth}&height=${masterHeight}&crop=center`
      : url;

    image.setAttribute('src', masterSrc);
    image.setAttribute('srcset', srcset);
    image.setAttribute('width', masterWidth);
    image.setAttribute('height', masterHeight);
    image.setAttribute('class', classes);
    image.setAttribute('alt', alt);
    image.setAttribute('sizes', sizes);

    return image;
  }

  _updateImage(
    url,
    width,
    height,
    alt = '',
    srcsetWidths = [180, 360, 540, 720, 900, 1080, 1296, 1512],
  ) {
    if (!this.image || !url || !width || !height) return null;

    const imageContainerRatio =
      this.imageContainerRatio !== 'natural'
        ? this.imageContainerRatio
            .split(':')
            .reduce((ratio, value) => (ratio !== 0 ? value / ratio : value), 0)
        : null;
    const aspectRatio = width / height;
    const uncroppedImage =
      this.imageContainerRatio === 'natural' ||
      (imageContainerRatio && this.imageFit);

    let masterWidth = width;
    let masterHeight = height;

    if (!uncroppedImage) {
      masterHeight = Math.round(masterWidth * imageContainerRatio);

      if (masterHeight > height) {
        masterHeight = height;
        masterWidth = Math.round(masterHeight / imageContainerRatio);
      }
    }

    const srcset = srcsetWidths.reduce((srcset, srcWidth) => {
      const srcHeight = Math.round(
        uncroppedImage
          ? srcWidth / aspectRatio
          : srcWidth * imageContainerRatio,
      );

      if (srcWidth > masterWidth || srcHeight > masterHeight) return srcset;

      return `${srcset}${url}${url.includes('?') ? '&' : '?'}width=${srcWidth}${
        !uncroppedImage ? `&height=${srcHeight}&crop=center` : ''
      } ${srcWidth}w ${srcHeight}h, `;
    }, '');

    const masterSrc = !uncroppedImage
      ? `${url}${
          url.includes('?') ? '&' : '?'
        }width=${masterWidth}&height=${masterHeight}&crop=center`
      : url;

    this.image.setAttribute('src', masterSrc);
    this.image.setAttribute('srcset', srcset);
    this.image.setAttribute('width', masterWidth);
    this.image.setAttribute('height', masterHeight);
    this.image.setAttribute('alt', alt);
  }

  _updateSkeleton() {
    if (!this.image) return;

    const skeleton =
      this.image.nextElementSibling &&
      this.image.nextElementSibling.tagName.toLowerCase() === 'image-skeleton'
        ? this.image.nextElementSibling
        : null;

    if (skeleton) {
      const svg = skeleton.querySelector('svg');
      const rect = svg.querySelector('rect');
      const width = this.image.getAttribute('width');
      const height = this.image.getAttribute('height');
      skeleton.setAttribute(
        'aria-label',
        `Loading image for ${this._product.title}`,
      );
      svg.setAttribute('width', width);
      svg.setAttribute('height', height);
      svg.setAttribute('viewBox', `0 0 ${width} ${height}`);

      rect.setAttribute('width', width);
      rect.setAttribute('height', height);
    }
  }
}
customElements.define('product-card-mini', ProductCardMini);

class ProductCard extends ProductCardMini {
  constructor() {
    super();

    this._boundSetVariant = this.setVariant.bind(this);
  }

  connectedCallback() {
    super.connectedCallback();

    this._swatchTriggers = [];

    if (this._product && !this._isRendered) {
      this._currentVariantUrl = this._product.url;
      this._render();
    }

    if (this._swatchTriggers.length === 0) {
      this._swatchTriggers = Array.from(
        this.querySelectorAll('li[variant-id]'),
      );
    }

    if (!this._product) {
      this._setProductData();
    }

    this._setUpSwatchesListeners();
  }

  disconnectedCallback() {
    this._removeSwatchesListeners();
  }

  set product(product) {
    super.product = product;

    if (!this._isRendered) {
      this._currentVariantUrl = this._product.url;
      this._setUpSwatchesListeners();
    }
  }

  get product() {
    return this._product;
  }

  _render() {
    super._render();

    const swatches = this.querySelector('product-card-variant-swatches');
    if (swatches) {
      const swatchOption = this._product.options.find((option) =>
        theme.swatches.triggers.includes(option.name.toLowerCase()),
      );

      if (swatchOption) {
        const templateId = this._sectionId
          ? `${this._sectionId}--template-swatch`
          : 'template-swatch';
        const swatchTemplate = document.getElementById(templateId).content;
        swatches.innerHTML = `
          <div class="swatch-wrapper">
            <div class="product-card__swatch">
              <ul class="product-card__swatch__items o-list-inline">
              </ul>
              ${
                swatchOption.values.length > 5
                  ? `
                    <div class="product-card__overflow">
                      <a product-card-link href="${
                        this._product.url
                      }" class="product-card__overflow__item" title="${
                      this._product.title
                    }">
                        <span class="">+${swatchOption.values.length - 5}</span>
                      </a>
                    </div>
                  `
                  : ''
              }
            </div>
          </div>
        `;

        const swatchList = swatches.querySelector('ul');
        swatchOption.values.slice(0, 5).forEach((value) => {
          const variant = this._product.variants.find(
            (v) => v[`option${swatchOption.position}`] === value,
          );

          if (variant) {
            const variantId = variant.id;
            const swatchFragment = swatchTemplate.cloneNode(true);
            const variantNameHandle = handle(value);

            const variantSwatch =
              swatchFragment.querySelector('variant-swatch');
            variantSwatch.setAttribute('swatch-id', variantNameHandle);
            variantSwatch.style.setProperty(
              '--background-graphic',
              variantNameHandle.replaceAll('-', ''),
            );
            variantSwatch.setAttribute('aria-label', value.replaceAll('"', ''));

            const variantTrigger = swatchFragment.querySelector('li');
            variantTrigger.setAttribute('variant-id', variantId);

            this._swatchTriggers.push(variantTrigger);

            swatchList.appendChild(swatchFragment);
          }
        });
      }
    }
  }

  _setProductData() {
    const productData = this.querySelector('[id^=ProductJson]');
    if (productData) this._product = JSON.parse(productData.textContent);
  }

  setVariant(e) {
    if (!e.target.hasAttribute('variant-id')) return;

    const variantId = e.target.getAttribute('variant-id');
    const variant = this._product.variants.find(
      (v) => v.id.toString() === variantId,
    );

    if (variant) {
      this.querySelectorAll('li.is-active').forEach((li) =>
        li.classList.remove('is-active'),
      );
      e.target.classList.add('is-active');

      this._currentVariantUrl = `${this._product.url}${
        this._product.url.includes('?') ? '&' : '?'
      }variant=${variantId}`;
      const variantImage = variant.featured_media
        ? variant.featured_media.preview_image
        : this._product.media && this._product.media.length > 0
        ? this._product.media[0].preview_image
        : null;

      this.querySelectorAll('a[product-card-link]').forEach((link) =>
        link.setAttribute('href', this._currentVariantUrl),
      );

      if (variantImage) {
        this._updateImage(
          variantImage.src,
          variantImage.width,
          variantImage.height,
          variantImage.alt,
        );
      }

      const quickShop = this.querySelector('quick-shop');

      if (quickShop) {
        quickShop.variantId = variantId;
      }
    }
  }

  _setUpSwatchesListeners() {
    this._swatchTriggers.forEach((trigger) => {
      trigger.addEventListener('click', this._boundSetVariant);
    });
  }

  _removeSwatchesListeners() {
    this._swatchTriggers.forEach((trigger) => {
      trigger.removeEventListener('click', this._boundSetVariant);
    });
  }
}
customElements.define('product-card', ProductCard);
