class ProductForm extends HTMLElement {
  constructor() {
    super();
  }

  connectedCallback() {
    this._eventAttached = false;
    setTimeout(() => {
      this.form = this.querySelector('form');
      this.idInput = this.form.elements['id'];
      this.submitButton = this.form.elements['add'];

      this.idInput.removeAttribute('disabled');

      this.notifyOnAdd = this.hasAttribute('notify-on-add');

      this._boundSubmit = this.submit.bind(this);

      this._eventAttached = true;
      this.form.addEventListener('submit', this._boundSubmit);
    });
  }

  disconnectedCallback() {
    if (this._eventAttached) {
      this._eventAttached = false;
      this.form.removeEventListener('submit', this._boundSubmit);
    }
  }

  async submit(e) {
    e.preventDefault();

    const data = new FormData(e.target);
    const item = Object.fromEntries(data.entries());

    try {
      this.removeError();
      await this._setIsAdding();
      await window.theme.cart.store.getState().add(item);
      await this._setIsAdding(false);

      const quickShop = this.closest('quick-shop');
      if (quickShop) {
        await quickShop.hide();
      }

      if (this.notifyOnAdd) {
        await window.theme.cart.store.getState().resetVariantsBeingAdded();
        if (!this.closest('.cart-draw')) theme.mfpOpen('cart');
      } else {
        await window.theme.cart.store.getState().resetLatestAddedProduct();
        await window.theme.cart.store
          .getState()
          .resetVariantsBeingAdded(item.id);
      }
    } catch (e) {
      this._renderError(e.message);
      await this._setIsAdding(false, true);
    }
  }

  _setIsAdding(isAdding = true, error = false) {
    return new Promise((resolve) => {
      if (!this.submitButton) {
        resolve('No submit button');
        return;
      }

      if (error) {
        this.submitButton.classList.remove('is-adding');
        resolve('error');
        return;
      }

      if (isAdding) {
        this.submitButton.classList.remove('is-added');
        this.submitButton.classList.add('is-adding');
        resolve('Adding');
      } else {
        this.submitButton.classList.remove('is-adding');
        this.submitButton.classList.add('is-added');

        this.submitButton.addEventListener('animationend', () => {
          this.submitButton.classList.remove('is-added');
          resolve('Added');
        });
      }
      return;
    });
  }

  _renderError(message) {
    this.removeError();

    if (this.submitButton) {
      const error = document.createElement('div');
      error.classList.add('errors', 'qty-error', 'u-small');
      error.innerHTML = message;
      this.submitButton.before(error);
    }
  }

  removeError() {
    const error = this.querySelector('.errors');
    if (!error) return;

    error.remove();
  }
}
customElements.define('product-form', ProductForm);
