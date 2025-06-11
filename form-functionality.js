// Utility functions
const log = (prefix, ...args) => console.log(`[${prefix}]`, ...args);
const error = (prefix, ...args) => console.error(`[${prefix}]`, ...args);

// Check if required scripts are loaded
function checkDependencies() {
  const required = {
    'MultiStep': typeof window.MultiStep !== 'undefined',
    'TomSelect': typeof window.TomSelect !== 'undefined',
    'libphonenumber': typeof window.libphonenumber !== 'undefined'
  };
  
  const missing = Object.entries(required)
    .filter(([, loaded]) => !loaded)
    .map(([name]) => name);
    
  if (missing.length) {
    error('Dependencies', `Missing required scripts: ${missing.join(', ')}`);
    return false;
  }
  return true;
}

document.addEventListener('DOMContentLoaded', async () => {
  log('FormScript', 'Initializing...');
  
  if (!checkDependencies()) {
    error('FormScript', 'Required dependencies not loaded. Form functionality may be limited.');
    return;
  }

  // ————————————————————————————————
  // 1) COUNTRY DROPDOWN POPULATOR
  // ————————————————————————————————
  const countrySelects = document.querySelectorAll('select[data-country-code]');
  console.log('[DEBUG] Found country selects:', countrySelects.length);
  
  if (countrySelects.length) {
    try {
      // Use the preloaded country list
      const preloadLink = document.querySelector('link[href*="country-list.json"]');
      console.log('[DEBUG] Preload link found:', !!preloadLink, preloadLink?.href);
      
      if (!preloadLink) {
        throw new Error('Country list preload link not found');
      }

      // Get the country list from the preload
      console.log('[DEBUG] Attempting to fetch country list...');
      const res = await fetch(preloadLink.href, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        },
        credentials: 'same-origin'
      });
      
      console.log('[DEBUG] Fetch response status:', res.status);
      if (!res.ok) throw new Error(`Failed to fetch country list: ${res.status}`);
      
      const countries = await res.json();
      console.log('[DEBUG] Countries loaded:', countries?.length);
      if (!Array.isArray(countries)) throw new Error('Invalid country list format');
      
      // Sort countries with US first
      const usIdx = countries.findIndex(c => 
        (c.code || '').toUpperCase() === 'US' || /United States/.test(c.name)
      );
      if (usIdx > -1) {
        const usCountry = countries.splice(usIdx, 1)[0];
        countries.unshift(usCountry);
      }
      
      // Sort remaining countries alphabetically
      countries.sort((a, b) => a.name.localeCompare(b.name));
      
      // Populate selects
      console.log('[DEBUG] Starting to populate select elements...');
      countrySelects.forEach((select, index) => {
        console.log(`[DEBUG] Populating select ${index + 1}/${countrySelects.length}`);
        
        // Clear existing options
        select.innerHTML = '<option value="">Select a country…</option>';
        
        // Add countries
        countries.forEach(({code, name, flag}) => {
          if (!code || !name) return;
          
          const opt = document.createElement('option');
          opt.value = code;
          opt.textContent = `${flag} ${name} (${code})`;
          opt.setAttribute('label', `${name} (${code})`);
          select.appendChild(opt);
        });
        
        // Initialize Tom Select if available
        if (window.TomSelect) {
          console.log('[DEBUG] Initializing TomSelect');
          new TomSelect(select, {
            sortField: {
              field: "text",
              direction: "asc"
            }
          });
        }

        // Trigger change event to ensure Webflow form updates
        select.dispatchEvent(new Event('change', { bubbles: true }));
        console.log('[DEBUG] Change event dispatched');
      });

      console.log('[DEBUG] Country population complete');
    } catch (err) {
      console.error('[DEBUG] Error in country population:', err);
      // Fallback to basic country list
      countrySelects.forEach(select => {
        select.innerHTML = `
          <option value="">Select a country…</option>
          <option value="US">🇺🇸 United States (US)</option>
          <option value="CA">🇨🇦 Canada (CA)</option>
        `;
      });
    }
  }

  // ————————————————————————————————
  // 2) GENERIC DATA-ATTRIBUTE HANDLERS
  // ————————————————————————————————
  const allFields = document.querySelectorAll(
    '[data-validate], [data-trim], [data-uppercase], [data-lowercase],' +
    '[data-sentence-case], [data-copy-from], [data-disabled-if],' +
    '[data-readonly-if], [data-show-if], [data-minlength], [data-maxlength],' +
    '[data-debounce], [data-required]'
  );

  allFields.forEach(field => {
    // Add required field validation
    if (field.dataset.required) {
      field.setAttribute('required', '');
      field.addEventListener('blur', () => {
        const isValid = field.value.trim().length > 0;
        field.classList.toggle('invalid', !isValid);
        field.classList.toggle('valid', isValid);
      });
    }

    console.log(`[dataHandler] Init field id="${field.id}" name="${field.name}"`);

    if (field.dataset.copyFrom) {
      console.log(`[dataHandler] copy-from from ${field.dataset.copyFrom}`);
      const src = document.querySelector(field.dataset.copyFrom);
      if (src) field.value = src.value;
    }

    [['disabledIf','disabled'], ['readonlyIf','readOnly']].forEach(([attr,prop]) => {
      if (field.dataset[attr]) {
        console.log(`[dataHandler] ${attr} toggling ${prop} based on ${field.dataset[attr]}`);
        const ref = document.querySelector(field.dataset[attr]);
        const toggle = () => field[prop] = !ref.checked;
        ref.addEventListener('change', toggle);
        toggle();
      }
    });

    if (field.dataset.showIf) {
      const [sel,val] = field.dataset.showIf.split(':');
      console.log(`[dataHandler] show-if ${sel} == ${val}`);
      const ref = document.querySelector(sel);
      const update = () => field.style.display = (ref.value === val ? '' : 'none');
      ref.addEventListener('change', update);
      update();
    }

    const debounceMs = +field.dataset.debounce || 0;
    let timer;
    const runLive = () => {
      if (field.dataset.maxlength) {
        const m = +field.dataset.maxlength;
        if (field.value.length > m) {
          console.log(`[dataHandler][live] Enforce maxlength=${m} on ${field.id}`);
          field.value = field.value.slice(0, m);
        }
      }
    };
    field.addEventListener('input', () => {
      if (debounceMs > 0) {
        clearTimeout(timer);
        timer = setTimeout(runLive, debounceMs);
      } else runLive();
    });

    field.addEventListener('blur', () => {
      let v = field.value;
      if (field.dataset.trim)         v = v.trim();
      if (field.dataset.uppercase)    v = v.toUpperCase();
      if (field.dataset.lowercase)    v = v.toLowerCase();
      if (field.dataset.sentenceCase) v = v.charAt(0).toUpperCase() + v.slice(1).toLowerCase();
      console.log(`[dataHandler][blur] ${field.id} normalized="${v}"`);
      field.value = v;

      if (field.dataset.minlength || field.dataset.maxlength) {
        const min = +field.dataset.minlength || 0;
        const max = +field.dataset.maxlength || Infinity;
        const invalid = v.length < min || v.length > max;
        console.log(`[dataHandler][blur] ${field.id} length invalid=${invalid}`);
        field.classList.toggle('invalid', invalid);
      }
    });
  });

  // ————————————————————————————————
  // 3) PHONE FORMATTING & VALIDATION
  // ————————————————————————————————
  const { AsYouType, parsePhoneNumberFromString } = window.libphonenumber;
  
  if (AsYouType && parsePhoneNumberFromString) {
    document.querySelectorAll('input[data-validate="phone"][data-phone-country-ref]')
      .forEach(field => {
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
      });
  }

  // ————————————————————————————————
  // 4) CA‐CONDITIONAL VISIBILITY
  // ————————————————————————————————
  const stateSel = document.querySelector('.form_input.is-select-input select#holding-company-state');
  const caEls   = document.querySelectorAll('.ca-conditional-visibility');
  console.log(`[CA visibility] stateSel=${!!stateSel}, caEls=${caEls.length}`);
  if (stateSel) {
    const toggleCA = () => {
      const show = stateSel.value === 'CA';
      console.log(`[CA visibility] State="${stateSel.value}", showCA=${show}`);
      caEls.forEach(el => el.style.display = show ? 'flex' : 'none');
    };
    toggleCA();
    stateSel.addEventListener('change', toggleCA);
  }

  // ————————————————————————————————
  // 5) FORM SUBMISSION HANDLING
  // ————————————————————————————————
  const form = document.querySelector('form');
  if (form) {
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      // Validate all required fields
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
      
      // Handle form submission
      try {
        const formData = new FormData(form);
        // Add your form submission logic here
        log('FormSubmit', 'Form submitted successfully');
      } catch (err) {
        error('FormSubmit', err);
      }
    });
  }
});