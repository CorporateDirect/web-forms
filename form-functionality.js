// Utility functions
const log = (prefix, ...args) => console.log(`[${prefix}]`, ...args);
const error = (prefix, ...args) => console.error(`[${prefix}]`, ...args);

// Dependency Management
class DependencyManager {
  static required = {
    'TomSelect': typeof window.TomSelect !== 'undefined',
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

    if (missing.includes('TomSelect')) {
      log('Dependencies', 'Loading TomSelect...');
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/tom-select@2.2.2/dist/js/tom-select.complete.min.js';
      script.async = true;
      script.onerror = () => error('Dependencies', 'Failed to load TomSelect');
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

  // Initialize country dropdowns
  const countrySelects = document.querySelectorAll('select[data-country-code]');
  log('CountryLoader', `Found ${countrySelects.length} country select elements`);
  
  if (countrySelects.length) {
    try {
      // Look for the preloaded country list in the window object
      const countries = window.countryList;
      log('CountryLoader', 'Looking for preloaded country list...');
      
      if (!countries || !Array.isArray(countries)) {
        throw new Error('Preloaded country list not found or invalid format');
      }
      
      log('CountryLoader', `Found preloaded country list with ${countries.length} countries`);
      
      // Sort countries with US first
      const usIdx = countries.findIndex(c => 
        (c.code || '').toUpperCase() === 'US' || /United States/.test(c.name)
      );
      if (usIdx > -1) {
        const usCountry = countries.splice(usIdx, 1)[0];
        countries.unshift(usCountry);
      }
      
      // Sort remaining countries
      countries.sort((a, b) => a.name.localeCompare(b.name));
      
      countrySelects.forEach((select, index) => {
        log('CountryLoader', `Populating select ${index + 1}/${countrySelects.length}:`, select.id || select.name);
        
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

        // Initialize Tom Select if available
        if (window.TomSelect) {
          log('CountryLoader', 'Initializing TomSelect');
          try {
            new TomSelect(select, {
              sortField: { field: "text", direction: "asc" }
            });
            log('CountryLoader', 'TomSelect initialized successfully');
          } catch (err) {
            error('CountryLoader', 'Failed to initialize TomSelect:', err);
          }
        } else {
          log('CountryLoader', 'TomSelect not available, using native select');
        }

        // Trigger change event to ensure Webflow form updates
        select.dispatchEvent(new Event('change', { bubbles: true }));
        log('CountryLoader', 'Change event dispatched');
      });
    } catch (err) {
      error('CountryLoader', 'Failed to load country list:', err);
    }
  } else {
    log('CountryLoader', 'No select elements found with data-country-code attribute');
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