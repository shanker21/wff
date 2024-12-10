/**
 * mixin for add-to-cart.js
 */

define([
    'jquery',
    'mage/translate',
    'underscore',
    'Magento_Catalog/js/product/view/product-ids-resolver',
    'Magento_Catalog/js/product/view/product-info-resolver',
    'jquery-ui-modules/widget'
], function ($, $t, _, idsResolver, productInfoResolver) {
    'use strict';

    return function (widget) {
        $.widget('mage.catalogAddToCart', widget, {
            options: {
                addToCartButtonText: {
                    added: $t('1 Added'),
                    default: $t('Add')
                },
                selectors: {
                    qtySelector: '[data-amtheme-js="qty-input"]',
                    topSellerFormSelector: '.topseller_addtocart_form',
                    minusQtySelector: '.amtheme-minus.cart-minus',
                    plusQtySelector: '.amtheme-plus.cart-plus',
                    deleteQtySelector: '.amtheme-delete.cart-delete',
                    searchdeleteQtySelector: '.amtheme-delete-search',
                    amthemeQtyBoxSelector: '.amtheme-qty-box',
                    amthemeQtyValueSelector: '.amtheme-qty',
                    successDialogbox: '.success-popup',
                    qntUpdateDialogbox: '.qnt-update-popup'
                },
                // disabledClass: 'disabled',
                // showSpinnerClass: '-show-spinner',
                addedToCartState: '-adding-complete',
                addingToCartClass: 'adding-to-cart',
                delay: 2500
            },

            /**
             * @inheritDoc
             * @return {void}
             */
            _create: function () {
                this._super();

                // eslint-disable-next-line max-len
                this.options.addToCartButtonDisabledClass = this.options.disabledClass + ' ' + this.options.showSpinnerClass + ' ' + this.options.addingToCartClass;
            },

            /**
             * @param {jQuery} form
             */
            ajaxSubmit: function (form) {
                var self = this,
                    productIds = idsResolver(form),
                    productInfo = self.options.productInfoResolver(form),
                    formData;
                   
                //$(self.options.minicartSelector).trigger('contentLoading');
                self.disableAddToCartButton(form);
                formData = new FormData(form[0]);

                $.ajax({
                    url: form.attr('action'),
                    data: formData,
                    type: 'post',
                    dataType: 'json',
                    cache: false,
                    contentType: false,
                    processData: false,

                    /** @inheritdoc */
                    beforeSend: function () {
                        if (self.isLoaderEnabled()) {
                            $('body').trigger(self.options.processStart);
                        }
                        $(".counter.qty .loading-mask").css('display', 'block');
                    },

                    /** @inheritdoc */
                    success: function (res) {
                        var eventData, parameters;

                        $(document).trigger('ajax:addToCart', {
                            'sku': form.data().productSku,
                            'productIds': productIds,
                            'productInfo': productInfo,
                            'form': form,
                            'response': res
                        });

                        if (self.isLoaderEnabled()) {
                            $('body').trigger(self.options.processStop);
                        }

                        if (res.backUrl) {
                            eventData = {
                                'form': form,
                                'redirectParameters': []
                            };
                            // trigger global event, so other modules will be able add parameters to redirect url
                            $('body').trigger('catalogCategoryAddToCartRedirect', eventData);

                            if (eventData.redirectParameters.length > 0 &&
                                window.location.href.split(/[?#]/)[0] === res.backUrl
                            ) {
                                parameters = res.backUrl.split('#');
                                parameters.push(eventData.redirectParameters.join('&'));
                                res.backUrl = parameters.join('#');
                            }
                            $.ajax({
                                type: "POST",
                                url: window.location.origin + "/catalogdata/index/ajaxcall",
                                dataType: 'json',
                                success: function(data) {
                                    self.disableAddToCartButtonAction(form);
                                    var popup = $('<div class="add-to-cart-modal-popup"/>').html($('.page-title span').text() + '<span>'+data.message+'</span>').modal({
                                        modalClass: 'add-to-cart-popup',
                                        title: $.mage.__("We can't add this to your basket..."),
                                        responsive: true,
                                        innerScroll: true,
                                        buttons: [
                                            {
                                                text: 'Close',
                                                click: function () {
                                                    if (data.oos == 0) {
                                                        self._redirect(res.backUrl);
                                                    }
                                                    if (data.oos == 1) {
                                                        this.closeModal();
                                                    }
                                                }
                                            },
                                            {
                                                text: 'View your basket',
                                                click: function () {
                                                    window.location = window.checkout.checkoutUrl
                                                }
                                            }
                                        ]
                                    });
                                    popup.modal('openModal');
                                },
                                error: function (data) {
                                    self._redirect(res.backUrl);
                                }
                            });

                            return;
                        }
                        $(self.options.minicartSelector).trigger('contentLoading');
                        if (res.messages) {
                            $(self.options.messagesSelector).html(res.messages);
                        }

                        if (res.minicart) {
                            $(self.options.minicartSelector).replaceWith(res.minicart);
                            $(self.options.minicartSelector).trigger('contentUpdated');
                        }

                        if (res.product && res.product.statusText) {
                            $(self.options.productStatusSelector)
                                .removeClass('available')
                                .addClass('unavailable')
                                .find('span')
                                .html(res.product.statusText);
                        }
                        /*To hide loader on mini-cart*/
                        $(".counter.qty .loading-mask").css('display', 'none');
                        
                        self.enableAddToCartButton(form);
                        self.afterMiniCartUpdatedAction(form);
                        self.showProductTile(form);
                    },

                    /** @inheritdoc */
                    error: function (res) {
                        $(document).trigger('ajax:addToCart:error', {
                            'sku': form.data().productSku,
                            'productIds': productIds,
                            'productInfo': productInfo,
                            'form': form,
                            'response': res
                        });
                    },

                    /** @inheritdoc */
                    complete: function (res) {
                        if (res.state() === 'rejected') {
                            location.reload();
                        }
                    }
                });
            },

            /**
             * @param {String} form
             * @return {void}
             */
            enableAddToCartButton: function (form) {
                var self = this,
                    addToCartButtonTextAdded = this.options.addToCartButtonTextAdded
                        || this.options.addToCartButtonText.added,
                    addToCartButton = $(form).find(this.options.addToCartButtonSelector);

                addToCartButton
                    .addClass(this.options.addedToCartState)
                    .removeClass(this.options.disabledClass)
                    .removeClass(this.options.addingToCartClass);
                addToCartButton.find('span').text(addToCartButtonTextAdded);
                addToCartButton.attr('title', addToCartButtonTextAdded);

                setTimeout(function () {
                    var addToCartButtonTextDefault = self.options.addToCartButtonTextDefault
                        || self.options.addToCartButtonText.default;

                    addToCartButton
                        .removeClass(self.options.showSpinnerClass)
                        .removeClass(self.options.addedToCartState);
                    addToCartButton.find('span').text(addToCartButtonTextDefault);
                    addToCartButton.attr('title', addToCartButtonTextDefault);
                }, self.options.delay);
            },

            /**
             * @param {String} form
             * @return {void}
             */
            showProductTile: function (form) {
               $(form).find(this.options.addToCartButtonSelector).hide();
               var selectors = this.options.selectors;
               //$(form).closest('li').find(selectors.amthemeQtyBoxSelector).show();
                $(form).find(selectors.amthemeQtyBoxSelector).show();
               var qtyValue = parseInt( $(form).find(selectors.qtySelector).val());
                if(qtyValue == 1){
                    $(form).find(selectors.deleteQtySelector).show();
                    $(form).find(selectors.searchdeleteQtySelector).show();
                }else{
                    $(form).find(selectors.deleteQtySelector).hide();
                    $(form).find(selectors.searchdeleteQtySelector).hide();
                    $(form).find(selectors.minusQtySelector).show();
                }
            },
            /**
             * Empty function for mixins
             *
             * @returns {Object}
             */
            afterMiniCartUpdatedAction: function (form) {
                var qtyValue = parseInt( $(form).find(this.options.selectors.qtySelector).val());
                if(qtyValue == 1)
                {
                    $(form).find(this.options.selectors.successDialogbox).show().html('<p class = "bsk-ItemUnitsTooltip-success">Added to your basket</p>').delay(1500).fadeOut();
                }else{
                    $(form).find(this.options.selectors.qntUpdateDialogbox).show().html('<p class = "bsk-ItemUnitsTooltip-success">Product quantity updated</p>').delay(1500).fadeOut();
                }
                
                return this;
            },
            /**
             * @param {String} form
             * @return {void}
             */
             disableAddToCartButtonAction: function (form) {
                var self = this,
                    addToCartButton = $(form).find(this.options.addToCartButtonSelector);

                    var addToCartButtonTextDefault = self.options.addToCartButtonTextDefault
                        || self.options.addToCartButtonText.default;

                    addToCartButton.removeClass(self.options.showSpinnerClass);
                        //.removeClass(self.options.addedToCartState);
                    addToCartButton.find('span').text(addToCartButtonTextDefault);
                    addToCartButton.attr('title', addToCartButtonTextDefault);
                    
            }
        });

        return $.mage.catalogAddToCart;
    };
});
