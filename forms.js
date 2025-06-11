/**
 * Custom Webflow Forms Controller
 * Works alongside videsigns and finsweet form libraries
 * Minimal foundation for case-by-case functionality
 * Version: 1.0.0
 */

(function() {
    'use strict';

    // Custom Forms Controller
    const CustomFormsController = {
        // Configuration
        config: {
            debug: false,
            selectors: {
                textCase: '[data-form-case]',
                customAction: '[data-custom-action]'
            }
        },

        // Handlers registry for custom functionality
        handlers: new Map(),

        // Initialize the controller
        init() {
            this.log('Initializing Custom Forms Controller...');
            
            // Wait for other form libraries to initialize first
            setTimeout(() => {
                this.bindEvents();
                this.initializeFields();
                this.log('Custom Forms Controller initialized');
            }, 100);
        },

        // Bind events
        bindEvents() {
            // Text case field events
            $(document).on('change input blur focus', this.config.selectors.textCase, (e) => {
                this.handleTextCase(e);
            });

            // Custom action events
            $(document).on('click', this.config.selectors.customAction, (e) => {
                this.handleCustomAction(e);
            });
        },

        // Initialize form enhancement fields
        initializeFields() {
            // Initialize text case fields
            $(this.config.selectors.textCase).each((index, field) => {
                this.setupTextCaseField($(field));
            });
        },

        // Setup text case field
        setupTextCaseField($field) {
            const caseType = $field.data('form-case');
            
            if (!caseType) return;

            // Store case type for reference
            $field.data('text-case-type', caseType);
            this.log(`Text case field initialized: ${caseType}`);
        },

        // Handle text case events
        handleTextCase(e) {
            const $field = $(e.target);
            const eventType = e.type;

            // Apply formatting on input and blur events
            if (eventType === 'input' || eventType === 'blur') {
                this.applyTextCase($field);
            }
        },

        // Handle custom actions
        handleCustomAction(e) {
            const $button = $(e.target);
            const action = $button.data('custom-action');

            if (!action || !this.handlers.has(action)) return;

            e.preventDefault();
            const handler = this.handlers.get(action);
            if (handler.execute) {
                handler.execute($button, e);
            }
        },

        // Register new functionality
        registerHandler(name, handler) {
            this.handlers.set(name, handler);
            this.log(`Handler registered: ${name}`);
        },

        // Apply text case formatting
        applyTextCase($field) {
            const caseType = $field.data('form-case');
            let value = $field.val();
            
            if (!caseType || !value) return;

            let formattedValue = value;
            
            switch(caseType.toLowerCase()) {
                case 'upper':
                case 'uppercase':
                    formattedValue = value.toUpperCase();
                    break;
                    
                case 'lower':
                case 'lowercase':
                    formattedValue = value.toLowerCase();
                    break;
                    
                case 'sentence':
                case 'capitalize':
                    formattedValue = value.toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
                    break;
                    
                case 'title':
                case 'titlecase':
                    formattedValue = value.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
                    break;
                    
                case 'camel':
                case 'camelcase':
                    formattedValue = value.toLowerCase()
                        .replace(/[\s-_]+(.)?/g, (match, chr) => chr ? chr.toUpperCase() : '');
                    break;
                    
                default:
                    // No formatting for unrecognized case types
                    return;
            }
            
            // Only update if the value actually changed to avoid cursor jumping
            if (formattedValue !== value) {
                const cursorPos = $field[0].selectionStart;
                $field.val(formattedValue);
                
                // Restore cursor position (adjust for length difference)
                const lengthDiff = formattedValue.length - value.length;
                const newCursorPos = Math.max(0, cursorPos + lengthDiff);
                
                // Set cursor position back (if field is still focused)
                if ($field.is(':focus')) {
                    $field[0].setSelectionRange(newCursorPos, newCursorPos);
                }
            }
        },

        // Utility: Get field value
        getFieldValue($field) {
            if ($field.is(':checkbox')) {
                return $field.is(':checked') ? $field.val() : '';
            } else if ($field.is(':radio')) {
                return $field.filter(':checked').val() || '';
            }
            return $field.val();
        },

        // Debug logging
        log(message) {
            if (this.config.debug && console && console.log) {
                console.log(`[CustomForms] ${message}`);
            }
        },

        // Enable debug mode
        enableDebug() {
            this.config.debug = true;
            this.log('Debug mode enabled');
        }
    };

    // Initialize when DOM is ready
    $(document).ready(() => {
        CustomFormsController.init();
    });

    // Expose to global scope
    window.CustomFormsController = CustomFormsController;

})();
