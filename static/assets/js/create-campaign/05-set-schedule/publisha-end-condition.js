/*
  FILE / MODULE NAME
  ------------------
  Suggested filename: publisha-end-condition.js

  WHAT THIS MODULE DOES
  ---------------------
  Controls the "End condition" UI logic.

  It expects 3 elements in your HTML:
    1. <select id="endConditionSelect">
         <option value="never">Never</option>
         <option value="after">After N runs</option>
         <option value="until">Until date</option>
       </select>

    2. <div id="endConditionWrap"> ... </div>
       This block contains the dynamic label + input that only shows
       when "After N runs" or "Until date" is selected.
       Example structure:
            <div id="endConditionWrap" style="display:none;">
                <label id="endConditionLabel" for="endConditionValue" class="field-label">N runs</label>
                <input id="endConditionValue" class="form-control-lg" placeholder="">
            </div>

    3. Inside that wrapper:
         - <label id="endConditionLabel">
         - <input  id="endConditionValue">

  The rules:
    - If user selects "Never":
        * The wrapper is hidden
        * The input is cleared and left inactive
    - If user selects "After N runs":
        * Show wrapper
        * Label text = "N runs"
        * Input becomes numeric (type="number")
        * Placeholder "e.g. 10"
        * We don't force validation here, but you can extend it easily
    - If user selects "Until date":
        * Show wrapper
        * Label text = "Until date"
        * Input becomes free text or date picker depending on how you want
          (in the original flow it's plain text "YYYY-MM-DD")
        * Placeholder "YYYY-MM-DD"

  HOW TO INTEGRATE INTO ANY HTML
  ------------------------------
  1. Add the HTML snippet above (ids must match or pass custom selectors via options).

  2. Include this script file after the markup is in the DOM:
        <script src="/js/publisha-end-condition.js"></script>

  3. Either let it auto-init, or call manually:
        initEndConditionControls({
            selectSelector:        '#endConditionSelect',
            wrapSelector:          '#endConditionWrap',
            labelSelector:         '#endConditionLabel',
            inputSelector:         '#endConditionValue',
            // optional overrides:
            neverHideValue: true   // clear value when "Never" is chosen (default true)
        });

  OPTIONAL BEHAVIOR YOU MAY WANT TO ADD YOURSELF:
    - min="1" validation for "N runs"
    - date picker widget instead of plain text for "Until date"
    - disable the input when "Never" is selected
*/

(function () {
  function qs(sel, root) { return (root || document).querySelector(sel); }

  function initEndConditionControls(options) {
    options = options || {};

    var selEl   = options.selectSelector ? qs(options.selectSelector) : document.getElementById('endConditionSelect');
    var wrapEl  = options.wrapSelector   ? qs(options.wrapSelector)   : document.getElementById('endConditionWrap');
    var labelEl = options.labelSelector  ? qs(options.labelSelector)  : document.getElementById('endConditionLabel');
    var inputEl = options.inputSelector  ? qs(options.inputSelector)  : document.getElementById('endConditionValue');

    // if some element is missing, bail out gracefully
    if (!selEl || !wrapEl || !labelEl || !inputEl) {
      console.warn('[EndConditionControls] Missing one of required elements:',
        { selEl: !!selEl, wrapEl: !!wrapEl, labelEl: !!labelEl, inputEl: !!inputEl }
      );
      return;
    }

    // default config
    var clearOnNever = (options.neverHideValue !== undefined)
      ? !!options.neverHideValue
      : true;

    function applyState() {
      var mode = selEl.value; // "never" | "after" | "until"

      if (mode === 'after') {
        // show wrapper
        wrapEl.style.display = 'block';

        // update label
        labelEl.textContent = 'N runs';

        // make input numeric-ish
        inputEl.type = 'number';
        inputEl.placeholder = 'e.g. 10';
        inputEl.disabled = false;
        inputEl.readOnly = false;
        inputEl.min = '1'; // optional basic validation hint

      } else if (mode === 'until') {
        // show wrapper
        wrapEl.style.display = 'block';

        // update label
        labelEl.textContent = 'Until date';

        // let user type a date string; you can change to type="date" if you want native picker
        inputEl.type = 'text';
        inputEl.placeholder = 'YYYY-MM-DD';
        inputEl.disabled = false;
        inputEl.readOnly = false;
        inputEl.removeAttribute('min');

      } else {
        // mode === 'never'
        wrapEl.style.display = 'none';

        if (clearOnNever) {
          inputEl.value = '';
        }

        // you can also disable it, just to be explicit
        inputEl.disabled = true;
        inputEl.readOnly = true;
      }
    }

    // event hook
    selEl.addEventListener('change', applyState);

    // init immediately once
    applyState();
  }

  // expose globally so you can call manually if you bundle differently
  window.initEndConditionControls = initEndConditionControls;

  // auto-init on DOM ready using default ids above
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      initEndConditionControls();
    });
  } else {
    initEndConditionControls();
  }
})();
