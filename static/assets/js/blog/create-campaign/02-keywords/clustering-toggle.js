/* 02-keywords/clustering-toggle.js */
$(function () {
  function toggleClustering () {
    const on  = $('#useClustering').is(':checked');
    const $sel = $('#clusterSelect');

    $('body').toggleClass('clustering-on', on);
    $('#clustersBox').toggle(on);

    if (on) {
      setTimeout(function () {
        const $c = $('#clusterSelect').next('.select2-container');
        $c.css({display:'block', width:'100%', visibility:'visible'});
      }, 0);
      if ($sel.hasClass('select2-hidden-accessible')) $sel.select2('destroy');
      $sel.select2({ tags:true, width:'100%', placeholder:'Type & press Enter…' });
    } else {
      if ($sel.hasClass('select2-hidden-accessible')) $sel.select2('destroy');
    }
  }

  $('#useClustering').on('change', toggleClustering);
});
