//test release -- Current


// Utility functions
const log = (prefix, ...args) => console.log(`[${prefix}]`, ...args);
const error = (prefix, ...args) => console.error(`[${prefix}]`, ...args);

// Dependency Management
class DependencyManager {
  static required = {
    'libphonenumber': typeof window.libphonenumber !== 'undefined'
  };

  static check() {
    log('Dependencies', 'Checking dependencies...');
    log('Dependencies', 'Status:', this.required);
    
    const missing = Object.entries(this.required)
      .filter(([, loaded]) => !loaded)
      .map(([name]) => name);
      
    if (missing.length) {
      error('Dependencies', `Missing required scripts: ${missing.join(', ')}`);
      this.loadMissing(missing);
      return false;
    }
    return true;
  }

  static loadMissing(missing) {
    log('Dependencies', 'Attempting to load missing dependencies...');
    
    if (missing.includes('libphonenumber')) {
      log('Dependencies', 'Loading libphonenumber...');
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/libphonenumber-js@1.10.55/bundle/libphonenumber-js.min.js';
      script.async = true;
      script.onerror = () => error('Dependencies', 'Failed to load libphonenumber');
      document.head.appendChild(script);
    }
  }
}

// Country List Management
class CountryListManager {
  static async fetchCountries(preloadLink) {
    const res = await fetch(preloadLink.href, {
      method: 'GET',
      headers: { 'Accept': 'application/json' },
      credentials: 'same-origin'
    });
    
    if (!res.ok) throw new Error(`Failed to fetch country list: ${res.status}`);
    
    const countries = await res.json();
    if (!Array.isArray(countries)) throw new Error('Invalid country list format');
    
    return this.sortCountries(countries);
  }

  static sortCountries(countries) {
    // Move US to top
    const usIdx = countries.findIndex(c => 
      (c.code || '').toUpperCase() === 'US' || /United States/.test(c.name)
    );
    
    if (usIdx > -1) {
      const usCountry = countries.splice(usIdx, 1)[0];
      countries.unshift(usCountry);
    }
    
    // Sort remaining countries
    return countries.sort((a, b) => a.name.localeCompare(b.name));
  }

  static createOption({code, name, flag}) {
    if (!code || !name) return null;
    
    const opt = document.createElement('option');
    opt.value = code;
    opt.textContent = `${flag} ${name} (${code})`;
    opt.setAttribute('label', `${name} (${code})`);
    return opt;
  }
}

// Form Field Management
class FormFieldManager {
  static initializeFields(fields) {
    fields.forEach(field => {
      this.setupRequiredValidation(field);
      this.setupCopyFrom(field);
      this.setupConditionalAttributes(field);
      this.setupLengthValidation(field);
      this.setupTextTransformation(field);
    });
  }

  static setupRequiredValidation(field) {
    if (field.dataset.required) {
      field.setAttribute('required', '');
      field.addEventListener('blur', () => {
        const isValid = field.value.trim().length > 0;
        field.classList.toggle('invalid', !isValid);
        field.classList.toggle('valid', isValid);
      });
    }
  }

  static setupCopyFrom(field) {
    if (field.dataset.copyFrom) {
      const src = document.querySelector(field.dataset.copyFrom);
      if (src) field.value = src.value;
    }
  }

  static setupConditionalAttributes(field) {
    [['disabledIf','disabled'], ['readonlyIf','readOnly']].forEach(([attr,prop]) => {
      if (field.dataset[attr]) {
        const ref = document.querySelector(field.dataset[attr]);
        const toggle = () => field[prop] = !ref.checked;
        ref.addEventListener('change', toggle);
        toggle();
      }
    });

    if (field.dataset.showIf) {
      const [sel,val] = field.dataset.showIf.split(':');
      const ref = document.querySelector(sel);
      const update = () => field.style.display = (ref.value === val ? '' : 'none');
      ref.addEventListener('change', update);
      update();
    }
  }

  static setupLengthValidation(field) {
    const debounceMs = +field.dataset.debounce || 0;
    let timer;

    const validateLength = () => {
      if (field.dataset.maxlength) {
        const max = +field.dataset.maxlength;
        if (field.value.length > max) {
          field.value = field.value.slice(0, max);
        }
      }
    };

    field.addEventListener('input', () => {
      if (debounceMs > 0) {
        clearTimeout(timer);
        timer = setTimeout(validateLength, debounceMs);
      } else validateLength();
    });

    field.addEventListener('blur', () => {
      if (field.dataset.minlength || field.dataset.maxlength) {
        const min = +field.dataset.minlength || 0;
        const max = +field.dataset.maxlength || Infinity;
        const invalid = field.value.length < min || field.value.length > max;
        field.classList.toggle('invalid', invalid);
      }
    });
  }

  static setupTextTransformation(field) {
    field.addEventListener('blur', () => {
      let value = field.value;
      if (field.dataset.trim) value = value.trim();
      if (field.dataset.uppercase) value = value.toUpperCase();
      if (field.dataset.lowercase) value = value.toLowerCase();
      if (field.dataset.sentenceCase) value = value.charAt(0).toUpperCase() + value.slice(1).toLowerCase();
      field.value = value;
    });
  }
}

// Phone Number Management
class PhoneNumberManager {
  static initializePhoneFields() {
    if (!window.libphonenumber) {
      log('PhoneHandler', 'libphonenumber not available, skipping phone field initialization');
      return;
    }

    const { AsYouType, parsePhoneNumberFromString } = window.libphonenumber;
    if (!AsYouType || !parsePhoneNumberFromString) {
      log('PhoneHandler', 'Required libphonenumber functions not available');
      return;
    }

    document.querySelectorAll('input[data-validate="phone"][data-phone-country-ref]')
      .forEach(field => this.setupPhoneField(field, AsYouType, parsePhoneNumberFromString));
  }

  static setupPhoneField(field, AsYouType, parsePhoneNumberFromString) {
    const countrySel = document.querySelector(field.dataset.phoneCountryRef);
    if (!countrySel) {
      error('PhoneHandler', `Country selector not found for ${field.id}`);
      return;
    }

    const formatLive = () => {
      const cc = (countrySel?.value || 'US').toUpperCase();
      const digits = field.value.replace(/\D/g, '');
      field.value = new AsYouType(cc).input(digits);
    };

    const validateOnBlur = () => {
      const cc = (countrySel?.value || 'US').toUpperCase();
      const digits = field.value.replace(/\D/g, '');
      const parsed = parsePhoneNumberFromString(digits, cc);
      
      if (parsed) {
        const isValid = parsed.isValid();
        field.classList.toggle('valid', isValid);
        field.classList.toggle('invalid', !isValid);
        
        if (isValid) {
          field.value = parsed.formatNational();
          field.setCustomValidity('');
        } else {
          field.setCustomValidity('Please enter a valid phone number');
        }
      } else {
        field.classList.add('invalid');
        field.classList.remove('valid');
        field.setCustomValidity('Please enter a valid phone number');
      }
    };

    field.addEventListener('input', formatLive);
    field.addEventListener('blur', validateOnBlur);
    countrySel.addEventListener('change', formatLive);
  }
}

// Main Initialization
document.addEventListener('DOMContentLoaded', async () => {
  log('FormScript', 'Initializing...');
  
  if (!DependencyManager.check()) {
    error('FormScript', 'Required dependencies not loaded. Form functionality may be limited.');
  }

  // Function to initialize country dropdowns
  const initializeCountryDropdowns = () => {
    log('CountryLoader', 'Starting country dropdown initialization...');
    
    // Debug: Let's see what select elements exist on the page
    const allSelects = document.querySelectorAll('select');
    log('CountryLoader', `Found ${allSelects.length} total select elements on page`);
    
    allSelects.forEach((select, index) => {
      log('CountryLoader', `Select ${index + 1}:`, {
        element: select,
        id: select.id,
        name: select.name,
        classes: select.className,
        attributes: Array.from(select.attributes).map(attr => `${attr.name}="${attr.value}"`),
        hasDataCountryCode: select.hasAttribute('data-country-code'),
        parentClasses: select.parentElement?.className
      });
    });
    
    // Try different selectors to find the country dropdown
    const selectors = [
      'select[data-country-code]',
      '.form_input select[data-country-code]',
      '.form_input select',
      'select'
    ];
    
    let countrySelects = null;
    let usedSelector = null;
    
    for (const selector of selectors) {
      const elements = document.querySelectorAll(selector);
      log('CountryLoader', `Selector "${selector}" found ${elements.length} elements`);
      
      if (selector === 'select[data-country-code]' && elements.length > 0) {
        countrySelects = elements;
        usedSelector = selector;
        break;
      } else if (selector === '.form_input select[data-country-code]' && elements.length > 0) {
        countrySelects = elements;
        usedSelector = selector;
        break;
      } else if (selector === '.form_input select' && elements.length > 0) {
        // Check if any of these selects should be the country dropdown
        const potentialCountrySelects = Array.from(elements).filter(select => 
          select.hasAttribute('data-country-code') || 
          select.id.toLowerCase().includes('country') ||
          select.name.toLowerCase().includes('country')
        );
        if (potentialCountrySelects.length > 0) {
          countrySelects = potentialCountrySelects;
          usedSelector = selector + ' (filtered for country)';
          break;
        }
      }
    }
    
    if (!countrySelects) {
      // Fallback: look for any select that might be a country dropdown
      countrySelects = document.querySelectorAll('select');
      const potentialCountrySelects = Array.from(countrySelects).filter(select => 
        select.hasAttribute('data-country-code') || 
        select.id.toLowerCase().includes('country') ||
        select.name.toLowerCase().includes('country') ||
        select.className.toLowerCase().includes('country')
      );
      
      if (potentialCountrySelects.length > 0) {
        countrySelects = potentialCountrySelects;
        usedSelector = 'fallback country detection';
      } else {
        countrySelects = [];
      }
    }
    
    log('CountryLoader', `Using selector: ${usedSelector}`);
    log('CountryLoader', `Found ${countrySelects.length} country select elements`);
    
    if (countrySelects.length) {
      try {
        // Look for the preloaded country list in the window object
        log('CountryLoader', 'Checking window.countryList:', window.countryList);
        const countries = window.countryList;
        
        if (!countries) {
          log('CountryLoader', 'window.countryList is undefined');
          throw new Error('Preloaded country list not found');
        }
        
        if (!Array.isArray(countries)) {
          log('CountryLoader', 'window.countryList is not an array:', typeof countries);
          throw new Error('Invalid country list format');
        }
        
        log('CountryLoader', `Found preloaded country list with ${countries.length} countries`);
        log('CountryLoader', 'First few countries:', countries.slice(0, 3));
        
        // Sort countries with US first
        const usIdx = countries.findIndex(c => 
          (c.code || '').toUpperCase() === 'US' || /United States/.test(c.name)
        );
        if (usIdx > -1) {
          const usCountry = countries.splice(usIdx, 1)[0];
          countries.unshift(usCountry);
          log('CountryLoader', 'Moved US to top of list');
        }
        
        // Sort remaining countries
        countries.sort((a, b) => a.name.localeCompare(b.name));
        
        countrySelects.forEach((select, index) => {
          log('CountryLoader', `Populating select ${index + 1}/${countrySelects.length}:`, select.id || select.name);
          log('CountryLoader', 'Select element:', select);
          
          // Clear existing options
          select.innerHTML = '<option value="">Select a country…</option>';
          
          // Add countries
          let addedCount = 0;
          countries.forEach(country => {
            const opt = CountryListManager.createOption(country);
            if (opt) {
              select.appendChild(opt);
              addedCount++;
            }
          });
          log('CountryLoader', `Added ${addedCount} countries to select`);
          log('CountryLoader', 'Select options after population:', select.options.length);

          // Trigger change event to ensure Webflow form updates
          select.dispatchEvent(new Event('change', { bubbles: true }));
          log('CountryLoader', 'Change event dispatched');
        });
        
        return true; // Success
      } catch (err) {
        error('CountryLoader', 'Failed to load country list:', err);
        error('CountryLoader', 'Error details:', err.message);
        return false;
      }
    } else {
      log('CountryLoader', 'No select elements found with data-country-code attribute');
      return false;
    }
  };

  // Try to initialize immediately
  let success = initializeCountryDropdowns();
  
  // If it failed, try again after Webflow has had time to initialize
  if (!success) {
    log('CountryLoader', 'Initial attempt failed, waiting for Webflow to initialize...');
    
    setTimeout(() => {
      log('CountryLoader', 'Retrying country dropdown initialization after delay...');
      success = initializeCountryDropdowns();
      
      if (!success) {
        log('CountryLoader', 'Second attempt failed, trying once more...');
        setTimeout(() => {
          log('CountryLoader', 'Final retry attempt...');
          initializeCountryDropdowns();
        }, 2000);
      }
    }, 1000);
  }

  // Initialize form fields
  const allFields = document.querySelectorAll(
    '[data-validate], [data-trim], [data-uppercase], [data-lowercase],' +
    '[data-sentence-case], [data-copy-from], [data-disabled-if],' +
    '[data-readonly-if], [data-show-if], [data-minlength], [data-maxlength],' +
    '[data-debounce], [data-required]'
  );
  FormFieldManager.initializeFields(allFields);

  // Initialize phone fields
  PhoneNumberManager.initializePhoneFields();

  // Handle CA conditional visibility
  const stateSel = document.querySelector('.form_input.is-select-input select#holding-company-state');
  const caEls = document.querySelectorAll('.ca-conditional-visibility');
  if (stateSel) {
    const toggleCA = () => {
      const show = stateSel.value === 'CA';
      caEls.forEach(el => el.style.display = show ? 'flex' : 'none');
    };
    toggleCA();
    stateSel.addEventListener('change', toggleCA);
  }

  // Handle form submission
  const form = document.querySelector('form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const requiredFields = form.querySelectorAll('[data-required]');
      let isValid = true;
      
      requiredFields.forEach(field => {
        if (!field.value.trim()) {
          field.classList.add('invalid');
          isValid = false;
        }
      });
      
      if (!isValid) {
        error('FormSubmit', 'Please fill in all required fields');
        return;
      }
      
      try {
        const formData = new FormData(form);
        log('FormSubmit', 'Form submitted successfully');
      } catch (err) {
        error('FormSubmit', err);
      }
    });
  }
}); 