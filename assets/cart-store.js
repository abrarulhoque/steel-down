const { produce, createStore } = window.theme.cart.functions;

/**
 * Shopify API returns an array of items with duplicate keys in case the same
 * item is both discounted, and an initiator of the discount. This function
 * removes the duplicate keys, adding a string of discount value to them.
 *
 * @param {Array} cart Cart object returned from Shopify API
 * @returns Cart object with items with amended keys
 */
const deDupeItemsInCart = (cart) => ({
  ...cart,
  items: cart.items.map((item) => {
    let newItem;
    if (
      item.line_level_discount_allocations &&
      item.line_level_discount_allocations.length > 0
    ) {
      newItem = {
        ...item,
        key: `${item.key}${item.line_level_discount_allocations.reduce(
          (discountsString, discount) => {
            return `${discountsString}_discount-${discount.amount}`;
          },
          '',
        )}`,
      };
    } else {
      newItem = item;
    }

    return newItem;
  }),
});

const fetchCart = async () => {
  try {
    const data = await fetch(`${window.Shopify.routes.root}cart.js`);
    const cart = await data.json();

    return deDupeItemsInCart(cart);
  } catch (e) {
    throw new Error(`Could not update cart: "${e}"`);
  }
};

const clearCart = async () => {
  try {
    const data = await fetch(`${window.Shopify.routes.root}cart/clear.js`, {
      method: 'POST',
    });
    const cart = await data.json();

    return cart;
  } catch (e) {
    throw new Error(`Could not clear cart: "${e}"`);
  }
};

const resetFreeShippingAnimation = () => {
  if (window.theme.cart.store.getState().products.total_price === 0)
    localStorage.removeItem('freeShippingAnimationShown');
};

const initiateStore = () => {
  const initialCartDataJson = document.getElementById('cart-data');
  const initialCartData = initialCartDataJson
    ? JSON.parse(initialCartDataJson.textContent)
    : {};

  const giftWrappingDataJson = document.getElementById(
    'cart-gift-wrapping-data',
  );
  const giftWrappingData = {
    giftWrapping: {
      ...(giftWrappingDataJson
        ? {
            ...JSON.parse(giftWrappingDataJson.textContent),
          }
        : {
            productId: null,
            wrapIndividually: false,
          }),
      statusBeingUpdated: false,
      messageBeingUpdated: false,
    },
  };

  window.theme.cart.store = createStore((set, get) => ({
    ...giftWrappingData,
    lineItemsBeingUpdated: [],
    latestAddedProduct: null,
    noteBeingUpdated: false,
    ongoingUpdates: {
      items: {},
      note: null,
      giftWrappingMessage: null,
    },
    products: deDupeItemsInCart(initialCartData),
    recommendations: {
      enabled: false,
      intent: 'related',
      items: {},
    },
    productVariantsBeingAdded: [],
    clear: async () => {
      const products = await clearCart();

      set(
        produce((draft) => {
          draft.lineItemsBeingUpdated = [];
          draft.latestAddedProduct = null;
          draft.products = products;
          draft.recommendations = {};
          draft.productVariantsBeingAdded = [];
        }),
      );
    },
    add: async (variants) => {
      if (!variants) throw new Error('Variant(s) must be specified');

      const items = (Array.isArray(variants) ? variants : [variants]).map(
        (item) => {
          if (Object.keys(item).find((key) => key.includes('properties'))) {
            return Object.entries(item).reduce((newItem, [key, value]) => {
              if (key.includes('properties') && value !== '') {
                if (!newItem.properties) newItem.properties = {};
                newItem.properties[
                  key.replace('properties[', '').replace(']', '')
                ] = value;
              } else {
                newItem[key] = value;
              }

              return newItem;
            }, {});
          }
          return item;
        },
      );

      set(
        produce((draft) => {
          draft.productVariantsBeingAdded = items.map((item) => item.id);
        }),
      );

      const addedResponseData = await fetch(
        `${window.Shopify.routes.root}cart/add.js`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ items }),
        },
      );
      const addedResponse = await addedResponseData.json();
      const products = await fetchCart();

      const prevItemsCount = get().products.item_count;

      set(
        produce((draft) => {
          draft.latestAddedProduct = addedResponse.items
            ? addedResponse.items[0]
            : null;
          draft.products = products;
        }),
      );

      if (prevItemsCount !== products.item_count) {
        await get().updateGiftWrapping();
      }
      await get().updateRecommendations();

      if (addedResponse.status) throw new Error(addedResponse.description);
    },
    change: async (key, quantity = 0) => {
      if (!key) throw new Error('Line item key must be specified');

      if (get().ongoingUpdates.items[key]) {
        get().ongoingUpdates.items[key].abort();
        set(
          produce((draft) => {
            draft.ongoingUpdates.items[key] = null;
          }),
        );
      }

      const controller = new AbortController();
      const signal = controller.signal;

      set(
        produce((draft) => {
          if (!get().lineItemsBeingUpdated.includes(key)) {
            draft.lineItemsBeingUpdated.push(key);
          }
          draft.ongoingUpdates.items[key] = controller;
        }),
      );

      // Need to use line and not the key due to Shopify
      // returning duplicate keys for same discounted items
      // TODO: Monitor API status, if the bug gets solved, replace with keys,
      // and remove dedupe function
      const line =
        get().products.items.findIndex((item) => item.key === key) + 1;
      const changedResponseData = await fetch(
        `${window.Shopify.routes.root}cart/change.js`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            // id: key,
            line,
            quantity,
          }),
          signal,
        },
      );
      const changedResponse = await changedResponseData.json();
      let products;

      if (changedResponse.status === 422) {
        products = await fetchCart();
      } else {
        products = changedResponse;
      }

      const prevItemsCount = get().products.item_count;

      // Sometimes change.js returns random line items with quantity of 0
      // in the items array (in particular when discounts are applied),
      // so we need to filter them out
      products = {
        ...products,
        items: products.items.filter((item) => item.quantity > 0),
      };

      products = deDupeItemsInCart(products);

      set(
        produce((draft) => {
          draft.lineItemsBeingUpdated = draft.lineItemsBeingUpdated.filter(
            (k) => k !== key,
          );
          draft.products = products;
          draft.ongoingUpdates.items[key] = null;
        }),
      );

      if (prevItemsCount !== products.item_count) {
        await get().updateGiftWrapping();
      }
      await get().updateRecommendations();

      if (changedResponse.status === 422)
        throw new Error(changedResponse.description);
    },
    enableRecommendations: async (intent = 'related') => {
      if (get().recommendations.enabled) return;

      set(
        produce((draft) => {
          draft.recommendations.enabled = true;
          draft.recommendations.intent = intent;
        }),
      );

      await get().updateRecommendations();
    },
    resetLatestAddedProduct: () => {
      set(
        produce((draft) => {
          draft.latestAddedProduct = null;
        }),
      );
    },
    resetVariantsBeingAdded: (variantId = '') => {
      set(
        produce((draft) => {
          draft.productVariantsBeingAdded = variantId
            ? draft.productVariantsBeingAdded.filter((id) => id !== variantId)
            : [];
        }),
      );
    },
    setGiftWrapping: async (enable = true) => {
      const giftWrappingProductId = get().giftWrapping.productId;
      if (!giftWrappingProductId) return;

      const cart = get().products;
      const giftWrappingIndividual = get().giftWrapping.wrapIndividually;
      if (enable) {
        set(
          produce((draft) => {
            draft.giftWrapping.statusBeingUpdated = true;
          }),
        );

        const savedGiftWrappingProductId =
          get().products.attributes['_gift-wrapping-product-id'];
        const giftWrappingResponseData = await fetch(
          `${window.Shopify.routes.root}cart/update.js`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              attributes: {
                ...(savedGiftWrappingProductId !== giftWrappingProductId
                  ? {
                      '_gift-wrapping-product-id': giftWrappingProductId,
                    }
                  : {}),
                'gift-wrapping': enable,
                'gift-wrapping-message': '',
              },
              updates: {
                [giftWrappingProductId]: giftWrappingIndividual
                  ? cart.items.reduce(
                      (nonGiftWrappingQuantity, item) =>
                        item.variant_id !== giftWrappingProductId
                          ? nonGiftWrappingQuantity + item.quantity
                          : nonGiftWrappingQuantity,
                      0,
                    )
                  : 1,
              },
            }),
          },
        );
        const products = await giftWrappingResponseData.json();

        set(
          produce((draft) => {
            draft.giftWrapping.statusBeingUpdated = false;
            draft.products = deDupeItemsInCart(products);
          }),
        );
      } else {
        let signal = null;
        let key = null;
        const giftWrappingItem = get().products.items.find(
          (item) => item.variant_id === giftWrappingProductId,
        );

        set(
          produce((draft) => {
            draft.giftWrapping.statusBeingUpdated = true;
          }),
        );

        if (giftWrappingItem) {
          key = giftWrappingItem.key;

          if (get().ongoingUpdates.items[key]) {
            get().ongoingUpdates.items[key].abort();
            set(
              produce((draft) => {
                draft.ongoingUpdates.items[key] = null;
              }),
            );
          }

          const controller = new AbortController();
          signal = controller.signal;

          set(
            produce((draft) => {
              if (!get().lineItemsBeingUpdated.includes(key)) {
                draft.lineItemsBeingUpdated.push(key);
              }
              draft.ongoingUpdates.items[key] = controller;
            }),
          );
        }

        const giftWrappingResponseData = await fetch(
          `${window.Shopify.routes.root}cart/update.js`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              attributes: {
                '_gift-wrapping-product-id': null,
                'gift-wrapping': enable,
                'gift-wrapping-message': '',
              },
              updates: {
                [giftWrappingProductId]: 0,
              },
            }),
            signal,
          },
        );
        const products = await giftWrappingResponseData.json();

        set(
          produce((draft) => {
            if (key) {
              draft.lineItemsBeingUpdated = draft.lineItemsBeingUpdated.filter(
                (k) => k !== key,
              );
            }
            draft.giftWrapping.statusBeingUpdated = false;
            draft.products = deDupeItemsInCart(products);
          }),
        );
      }
    },
    syncGiftWrapping: async () => {
      const giftWrappingProductId = get().giftWrapping.productId;
      const savedGiftWrappingProductId =
        get().products.attributes['_gift-wrapping-product-id'];

      if (
        savedGiftWrappingProductId &&
        savedGiftWrappingProductId !== giftWrappingProductId
      ) {
        const savedGiftWrappingProduct = get().products.items.find(
          (item) => item.id === savedGiftWrappingProductId,
        );

        if (savedGiftWrappingProduct) {
          if (get().ongoingUpdates.items[savedGiftWrappingProduct.key]) {
            get().ongoingUpdates.items[savedGiftWrappingProduct.key].abort();
            set(
              produce((draft) => {
                draft.ongoingUpdates.items[savedGiftWrappingProduct.key] = null;
              }),
            );
          }

          const controller = new AbortController();
          const signal = controller.signal;

          set(
            produce((draft) => {
              if (
                !get().lineItemsBeingUpdated.includes(
                  savedGiftWrappingProduct.key,
                )
              ) {
                draft.lineItemsBeingUpdated.push(savedGiftWrappingProduct.key);
              }
              draft.ongoingUpdates.items[savedGiftWrappingProduct.key] =
                controller;
            }),
          );

          const giftWrappingResponseData = await fetch(
            `${window.Shopify.routes.root}cart/update.js`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                attributes: {
                  '_gift-wrapping-product-id': null,
                },
                updates: {
                  [savedGiftWrappingProductId]: 0,
                },
              }),
              signal,
            },
          );
          const products = await giftWrappingResponseData.json();

          set(
            produce((draft) => {
              draft.lineItemsBeingUpdated = draft.lineItemsBeingUpdated.filter(
                (k) => k !== savedGiftWrappingProduct.key,
              );
              draft.giftWrapping.statusBeingUpdated = false;
              draft.products = deDupeItemsInCart(products);
            }),
          );
        }
      }

      if (!giftWrappingProductId) return;

      const giftWrappingEnabled = Boolean(
        get().products.attributes['gift-wrapping'],
      );
      const giftWrappingIndividual = get().giftWrapping.wrapIndividually;
      const giftWrappingItem = get().products.items.find(
        (item) => item.variant_id === giftWrappingProductId,
      );

      if (!giftWrappingEnabled && giftWrappingItem) {
        await get().setGiftWrapping(false);
      }

      if (giftWrappingEnabled && !giftWrappingItem) {
        await get().setGiftWrapping(true);
      }

      if (
        giftWrappingEnabled &&
        giftWrappingItem &&
        giftWrappingIndividual &&
        giftWrappingItem.quantity === 1
      ) {
        await get().updateGiftWrapping();
      }

      if (
        giftWrappingEnabled &&
        giftWrappingItem &&
        !giftWrappingIndividual &&
        giftWrappingItem.quantity > 1
      ) {
        await get().updateGiftWrapping();
      }
    },
    updateGiftWrapping: async () => {
      const giftWrappingProductId = get().giftWrapping.productId;
      if (!giftWrappingProductId) return;

      const giftWrappingIndividual = get().giftWrapping.wrapIndividually;
      const giftWrappingItem = get().products.items.find(
        (item) => item.variant_id === giftWrappingProductId,
      );

      if (
        !giftWrappingItem ||
        (get().products.items_count > 1 &&
          !giftWrappingIndividual &&
          giftWrappingItem)
      )
        return;

      const key = giftWrappingItem.key;

      if (get().ongoingUpdates.items[key]) {
        get().ongoingUpdates.items[key].abort();
        set(
          produce((draft) => {
            draft.ongoingUpdates.items[key] = null;
          }),
        );
      }

      const controller = new AbortController();
      const signal = controller.signal;

      set(
        produce((draft) => {
          if (!get().lineItemsBeingUpdated.includes(key)) {
            draft.lineItemsBeingUpdated.push(key);
          }
          draft.ongoingUpdates.items[key] = controller;
        }),
      );

      let giftWrappingQuantity = giftWrappingIndividual
        ? get().products.items.reduce(
            (nonGiftWrappingQuantity, item) =>
              item.variant_id !== giftWrappingProductId
                ? nonGiftWrappingQuantity + item.quantity
                : nonGiftWrappingQuantity,
            0,
          )
        : 1;

      if (
        giftWrappingItem &&
        get().products.items.filter((i) => i.id !== giftWrappingProductId)
          .length === 0
      ) {
        giftWrappingQuantity = 0;
      }

      const giftWrappingAttributeUpdate =
        giftWrappingQuantity === 0
          ? {
              attributes: {
                'gift-wrapping': false,
                'gift-wrapping-message': '',
              },
            }
          : {};

      const data = await fetch(`${window.Shopify.routes.root}cart/update.js`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...giftWrappingAttributeUpdate,
          updates: {
            [giftWrappingProductId]: giftWrappingQuantity,
          },
        }),
        signal,
      });
      const cart = await data.json();

      set(
        produce((draft) => {
          draft.lineItemsBeingUpdated = draft.lineItemsBeingUpdated.filter(
            (k) => k !== key,
          );
          draft.products = deDupeItemsInCart(cart);
        }),
      );
    },
    updateGiftWrappingMessage: async (message) => {
      if (
        get().giftWrapping.messageBeingUpdated &&
        get().ongoingUpdates.giftWrappingMessage
      ) {
        get().ongoingUpdates.giftWrappingMessage.abort();
        set(
          produce((draft) => {
            draft.ongoingUpdates.giftWrappingMessage = null;
            draft.giftWrapping.messageBeingUpdated = false;
          }),
        );
      }

      const controller = new AbortController();
      const signal = controller.signal;

      set(
        produce((draft) => {
          draft.ongoingUpdates.giftWrappingMessage = controller;
          draft.giftWrapping.messageBeingUpdated = true;
        }),
      );

      const updatedMessageResponse = await fetch(
        `${window.Shopify.routes.root}cart/update.js`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            attributes: {
              'gift-wrapping-message': message,
            },
          }),
          signal,
        },
      );
      const products = await updatedMessageResponse.json();

      set(
        produce((draft) => {
          draft.ongoingUpdates.giftWrappingMessage = null;
          draft.giftWrapping.messageBeingUpdated = false;
          draft.products = deDupeItemsInCart(products);
        }),
      );
    },
    updateNote: async (note) => {
      if (get().noteBeingUpdated && get().ongoingUpdates.note) {
        get().ongoingUpdates.note.abort();
        set(
          produce((draft) => {
            draft.ongoingUpdates.note = null;
            draft.noteBeingUpdated = false;
          }),
        );
      }

      const controller = new AbortController();
      const signal = controller.signal;

      set(
        produce((draft) => {
          draft.ongoingUpdates.note = controller;
          draft.noteBeingUpdated = true;
        }),
      );

      const updatedNoteResponse = await fetch(
        `${window.Shopify.routes.root}cart/update.js`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            note,
          }),
          signal,
        },
      );
      const products = await updatedNoteResponse.json();

      set(
        produce((draft) => {
          draft.ongoingUpdates.note = null;
          draft.noteBeingUpdated = false;
          draft.products = deDupeItemsInCart(products);
        }),
      );
    },
    updateRecommendations: async () => {
      // TODO: Use local storage to cache recommendations
      if (!get().recommendations.enabled) return;

      // Can be either 'proportional' or 'equal'
      const weightDistribution = 'equal';
      const intent = get().recommendations.intent;
      const newRecommendations = {};
      const existingRecommendations = get().recommendations.items;
      const existingRecommendationsIds = Object.keys(existingRecommendations);
      const productIds = get().products.items.reduce((ids, item) => {
        // TODO: Also exclude gift wrapping product id
        if (!item.gift_card && !ids.includes(item.product_id.toString()))
          ids.push(item.product_id.toString());

        return ids;
      }, []);

      const remainingProductIds = existingRecommendationsIds.filter(
        (productId) => productIds.includes(productId),
      );

      const remainingRecommendations = remainingProductIds.reduce(
        (recommendations, productId) => {
          return {
            ...recommendations,
            [productId]: existingRecommendations[productId],
          };
        },
        {},
      );

      const newProductIds = productIds.filter(
        (productId) => !existingRecommendationsIds.includes(productId),
      );

      // Products in the cart are excluded from the recommendations
      // so when the product is removed from the cart, the recommendations
      // should be updated, together with fetching ones for new products
      await Promise.all(
        [
          ...(remainingProductIds.length < existingRecommendationsIds.length
            ? remainingProductIds
            : []),
          ...newProductIds,
        ].map(async (productId) => {
          const data = await fetch(
            `${window.Shopify.routes.root}recommendations/products.json?product_id=${productId}&intent=${intent}`,
          );
          const recommendations = await data.json();

          if (remainingProductIds.includes(productId)) {
            remainingRecommendations[productId] = recommendations;
          } else {
            newRecommendations[productId] = recommendations;
          }
        }),
      );

      const finalRecommendations = {
        ...remainingRecommendations,
        ...newRecommendations,
      };

      // Calculate and set weight
      const calculateWeight = (productId) => {
        const totalPrice = get()
          .products.items.filter(
            (item) => item.product_id.toString() === productId,
          )
          .reduce((total, item) => {
            return total + item.line_price;
          }, 0);

        return totalPrice / get().products.total_price;
      };

      set(
        produce((draft) => {
          draft.recommendations.items = Object.keys(
            finalRecommendations,
          ).reduce((recommendations, productId) => {
            recommendations[productId] = {
              weight:
                weightDistribution === 'proportional'
                  ? calculateWeight(productId)
                  : 1 /
                    get().products.items.reduce((items, item) => {
                      if (!items.includes(item.id)) items.push(item.id);

                      return items;
                    }, []).length,
              products: finalRecommendations[productId].products,
            };

            return recommendations;
          }, {});
        }),
      );
    },
  }));
};

initiateStore();
resetFreeShippingAnimation();

await window.theme.cart.store.getState().syncGiftWrapping();
