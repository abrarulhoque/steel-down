function getColorBrightness(rgbColor) {
  var colorValues = rgbColor.match(/[\d\.]+/g).map(Number);
  return 0.2126 * (colorValues[0] / 255) + 0.7152 * (colorValues[1] / 255) + 0.0722 * (colorValues[2] / 255);
}

function isSimilarToBackground(color) {
  var backgroundColor = 'rgb(255, 255, 255)';

  var colorBrightness = getColorBrightness(color);
  var backgroundColorBrightness = getColorBrightness(backgroundColor);

  return (backgroundColorBrightness / colorBrightness) < 1.5;
}

var SwatchColors = (function() {
  function SwatchColors() {
    this.colors = {'dull-black': 'rgb(37, 37, 37)','gloss-black': 'rgb(0, 0, 0)','ash': 'rgb(217, 217, 217)','vintage-brown': 'rgb(154, 99, 36)','khaki': 'rgb(156, 140, 106)','smoked': 'rgb(0, 0, 0)','clear': 'rgb(255, 255, 255)','campaign': 'rgb(156, 0, 19)','gold-star': 'rgb(215, 145, 49)','stripe': 'rgb(20, 111, 226)','fast-as-fuck': 'rgb(215, 145, 49)','free-spirits': 'rgb(0, 0, 0)',};

    this.images = {'2-pack': 'url("//steeltowngarage.com/cdn/shop/files/2-pack_68x.jpg?v=1290577709756847045")','3-pack': 'url("//steeltowngarage.com/cdn/shop/files/3-pack_68x.jpg?v=15009993493385428504")','buffalo-check': 'url("//steeltowngarage.com/cdn/shop/files/buffalocheck_68x.jpg?v=5185970007935674371")','classic': 'url("//steeltowngarage.com/cdn/shop/files/buffalocheck_68x.jpg?v=5185970007935674371")','checkered': 'url("//steeltowngarage.com/cdn/shop/files/buffalocheck_68x.jpg?v=5185970007935674371")','best-seller-pack': 'url("//steeltowngarage.com/cdn/shop/files/3-pack-socks-best_68x.jpg?v=14896082465560731135")','ss24-pack': 'url("//steeltowngarage.com/cdn/shop/files/3-pack-socks-ss24_68x.jpg?v=5851919412741625989")','black-white': 'url("//steeltowngarage.com/cdn/shop/files/buffalocheck_68x.jpg?v=5185970007935674371")',};

    this.triggers = ['color','colour','couleur','farbe','cor',];
  }

  function setSwatchColor(swatch) {
    var swatchId = swatch.getAttribute('swatch-id');

    if (Object.keys(this.colors).includes(swatchId)) {
      swatch.style.setProperty("--background-graphic", this.colors[swatchId]);

      if (isSimilarToBackground(this.colors[swatchId])) swatch.classList.add('is-similar-to-background');
      if (getColorBrightness(this.colors[swatchId]) > 0.5) {
        swatch.style.setProperty('--tick-color', '#000');
      } else {
        swatch.style.setProperty('--tick-color', '#fff');
      }
      swatch.classList.remove('is-blank');
    }

    if (Object.keys(this.images).includes(swatchId)) {
      swatch.style.setProperty("--background-graphic", this.images[swatchId]);
      swatch.classList.add('is-image');
      swatch.classList.remove('is-blank');
    }
  }
  SwatchColors.prototype.setSwatchColor = setSwatchColor;

  return SwatchColors;
}());

window.theme.swatches = new SwatchColors();

function VariantSwatch() {
  return Reflect.construct(HTMLElement, [], this.constructor);
}

VariantSwatch.prototype = Object.create(HTMLElement.prototype);
VariantSwatch.prototype.constructor = VariantSwatch;
Object.setPrototypeOf(VariantSwatch, HTMLElement);

VariantSwatch.prototype.connectedCallback = function() {
  window.theme.swatches.setSwatchColor(this);
};
customElements.define('variant-swatch', VariantSwatch);
