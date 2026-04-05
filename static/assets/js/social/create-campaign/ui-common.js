/* ui-common.js – modal backdrop cleanup */
$(document).on('hidden.bs.modal', '.modal', function () {
  $('.modal-backdrop').remove();
  $('body').removeClass('modal-open');
});
