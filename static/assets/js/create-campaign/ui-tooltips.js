/* ui-tooltips.js */
$(function(){
  $('.entry-card[data-tooltip]')
    .on('focus', function () {
      if (!$(this).hasClass('selected')) {
        $(this).addClass('tooltip-show');
      }
    })
    .on('blur', function () {
      $(this).removeClass('tooltip-show');
    });
});
