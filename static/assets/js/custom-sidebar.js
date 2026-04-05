// static/assets/js/custom-sidebar.js

$(document).ready(function () {
    var $menuItems = $('.sidebar-menu .main-menu .has-sub > a');

    $menuItems.on('click', function (e) {
        e.preventDefault();
        var $parentLi = $(this).parent('li');
        var $submenu = $parentLi.children('ul');
        var isOpen = $parentLi.hasClass('opened');

        if (isOpen) {
            $submenu.slideUp(200);
            $parentLi.removeClass('opened');
        } else {
            $submenu.slideDown(200);
            $parentLi.addClass('opened');
        }
    });
    $('#organization-switcher').on('change', function () {
        // Get the ID of the selected organization from the <option>'s value attribute.
        var selectedOrgId = $(this).val();

        // Check if a valid option was selected (not a placeholder).
        if (selectedOrgId) {
            // Get the base URL we stored in the data-switch-url-base attribute.
            var baseUrl = $(this).data('switch-url-base');

            // Replace the '0' placeholder with the actual selected organization ID.
            var finalUrl = baseUrl.replace('0', selectedOrgId);

            // Redirect the browser to the new URL.
            window.location.href = finalUrl;
        }
    });
});