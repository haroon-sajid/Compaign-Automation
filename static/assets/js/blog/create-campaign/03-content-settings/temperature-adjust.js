// /assets/js/temperature-adjust.js
$(function(){

  const defaultTemp = 1.00;
  const $container  = $('#temperatureContainer');

  // Slider grubunu enjekte et
  const html = `
    <div id="tempSliderGroup" class="temp-box" style="display:none;">
      <div class="d-flex justify-content-between align-items-center">
        <h4 class="temp-title">Temperature: <span id="tempValue">${defaultTemp.toFixed(2)}</span></h4>
        <a href="#" id="resetTemperature" class="temp-reset">Reset to default</a>
      </div>
      <p class="slider-description">
        Higher values like 1.5 will make the output more random, while lower values like 0.5 will make it more focused and deterministic.
      </p>

      <div class="temp-range-wrap">
        <input type="range" id="temperatureSlider" min="0" max="2" step="0.01" value="${defaultTemp.toFixed(2)}">
        <output id="tempBubble">${defaultTemp.toFixed(2)}</output>
      </div>

      <div class="temp-scale">
        <span>Precise</span>
        <span>Neutral</span>
        <span>Creative</span>
      </div>
    </div>
  `;
  $container.append(html);

  // Checkbox aç/kapa
  $('#useTempAdjust').on('change', function(){
    if (this.checked) {
      $('#tempSliderGroup').slideDown(180);
    } else {
      $('#tempSliderGroup').slideUp(180);
      // gizlendiğinde değeri hidden inputtan da temizleyebilirsin (opsiyonel)
      // $('#temperatureHidden').val('').trigger('change');
    }
  });

  // Slider hareket edince UI + hidden alan
  $('#temperatureSlider').on('input change', function(){
    const val = parseFloat(this.value).toFixed(2);
    $('#tempValue').text(val);
    $('#tempBubble').text(val);
    $('#temperatureHidden').val(val).trigger('change'); // autosave & summary için

    // Bubble pozisyonu (%)
    const percent = (this.value - this.min) / (this.max - this.min) * 100;
    $('#tempBubble').css('left', `calc(${percent}% )`);
  }).trigger('input'); // başlangıç pozisyonu

  // Reset linki
  $('#tempSliderGroup').on('click', '#resetTemperature', function(e){
    e.preventDefault();
    $('#temperatureSlider').val(defaultTemp.toFixed(2)).trigger('input');
  });

});
