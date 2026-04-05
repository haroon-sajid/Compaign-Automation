// Wait for the document to be ready
$(document).ready(function () {

    // Find the organization switcher dropdown by its ID
    const orgSwitcher = $('#organization-switcher');

    // Check if the element actually exists on the page
    if (orgSwitcher.length) {

        // Add an event listener for the 'change' event
        orgSwitcher.on('change', function () {
            // Get the ID of the selected organization
            const selectedOrgId = $(this).val();

            // Get the base URL from the data attribute
            let switchUrlBase = $(this).data('switch-url-base');

            // Create the final URL by replacing the placeholder '0' with the selected ID
            const finalUrl = switchUrlBase.replace('/0/', '/' + selectedOrgId + '/');

            // Redirect the user to the new URL
            window.location.href = finalUrl;
        });
    }

});