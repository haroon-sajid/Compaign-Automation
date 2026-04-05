/* =========================================================
 *  next-step-button.js                         (v1.6 – [Today's Date])
 *  – “Next / Save & Queue” butonlarının mantığı
 *  – ADDED: Media mode selection is now mandatory on Step 4
 * ========================================================= */

(function () {

    /* Erken çıkış: jQuery veya DataTables yoksa pasif kal */
    if (!window.$ || !$.fn || !$.fn.DataTable) {
        console.error('jQuery or DataTables could not be loaded – wizard is inactive.');
        return;
    }

    /* Global lock – prevents double clicks */
    let nextStepLock = false;
    const DEBOUNCE_MS = 800;

    /* Main click handler */
    $(document).on('click', '.next-step', async function () {
        console.log('Next-step button clicked');

        if (nextStepLock) return;   // already running
        nextStepLock = true;

        const $btn = $(this);
        const label = $btn.text();

        /* ------- Yardımcı ------- */
        function release() {
            nextStepLock = false;
            $btn.prop('disabled', false).text(label);
        }

        /* 1) UI: butonu kilitle & spinner göster */
        $btn.prop('disabled', true).html(label + ' ⌛');

        /* 2) Aktif adımı tespit et */
        const curr = $('.wizard-step.active').data('step');

        /* 3) Adıma özel kontroller -------------------------------- */
        // if (curr === 2 && typeof syncKeywords === 'function') {
        //     syncKeywords();
        // }
        if (curr === 2) {
            if (typeof syncKeywords === 'function') {
                syncKeywords();
            }

            // NEW: Required field validation
            const keywordCount = $('#kwTable').DataTable().rows().count();
            if (keywordCount === 0) {
                alert('Please add at least one keyword to continue.');
                return release();
            }
        }

        if (curr === 1 && $('#cardNew').hasClass('selected')
            && typeof saveNewTemplate === 'function') {
            const ok = saveNewTemplate();
            if (!ok) return release();
        }

        if (curr === 1) {
            // Existing template validation
            if ($('#cardNew').hasClass('selected') && typeof saveNewTemplate === 'function') {
                const ok = saveNewTemplate();
                if (!ok) return release();
            }

            // NEW: Required field validation
            const campaignName = $('#campaignName').val().trim();
            if (!campaignName) {
                alert('Campaign name is required.');
                return release();
            }

            const userPrompt = $('#userPromptText').val().trim();
            if (!userPrompt) {
                alert('Please provide a prompt to continue.');
                return release();
            }

            const selectedTemplate = $('.template-card.selected').length;
            // if (!selectedTemplate) {
            //     alert('Please select a template to continue.');
            //     return release();
            // }
        }

        if (curr === 3) {
            // ====================================================================
            // ▼▼▼ VALIDATION CHECKS FOR STEP 3 ▼▼▼
            // ====================================================================
            const wordCount = parseInt($('#wordCount').val(), 10);
            if (isNaN(wordCount) || wordCount < 1 || wordCount > 2500) {
                alert('Please enter a valid word count between 1 and 2500.');
                return release();
            }

            const tone = $('#toneHidden').val();
            if (!tone) {
                alert('Please select a tone of voice to continue.');
                return release();
            }

            const tagCount = $('#tagCountInput').val();
            if (!tagCount){
                alert('Please select a tag count to continue.');
                return release();
            }

            const category = $('#category-selector').val();
            if (!category){
                alert('Please select a category first.');
                return release();
            }

            const temp = $('#useTempAdjust').val()
            if (!temp){
                alert('Please select a category first.');
                return release();
            }

        }

        // ====================================================================
        // ▼▼▼ VALIDATION CHECKS FOR STEP 4 ▼▼▼
        // ====================================================================
        // if (curr === 4) {
        //     const mediaMode = $('#sourceHidden').val();

        //     // --- CHECK 1: Is a media mode selected? ---
        //     if (mediaMode === '') {
        //         alert('Please choose a media option ("Auto Search" or "Manually Add") to continue.');
        //         return release(); // Stop the function
        //     }

        //     // --- CHECK 2: If a mode IS selected, is there a Featured Image? ---
        //     const hasFeaturedImage = $('#cardCover').hasClass('has-image');
        //     if (!hasFeaturedImage) {
        //         alert('A Featured Image is required when adding media. Please select one to continue.');
        //         return release(); // Stop the function
        //     }
        // }
        // ▼▼▼ ADD THIS NEW LOGIC FOR STEP 4 ▼▼▼
        // if (curr === 4) {
        //     console.log('Finalizing Step 4 data...');
        //     try {
        //         // Get the main campaign draft
        //         const draftKey = 'campaignDraftV2';
        //         let draft = JSON.parse(localStorage.getItem(draftKey) || '{}');
        //         if (!draft.media) draft.media = {};

        //         // Get the image assignments map
        //         const imgMapKey = 'imgMap::' + getScopeKey(); // Use the same scope key as match-images.js
        //         const imgMap = JSON.parse(localStorage.getItem(imgMapKey) || '{}');

        //         // Merge the image map into the main draft
        //         draft.media.imageAssignments = imgMap;

        //         // Save the complete, final draft back to local storage
        //         localStorage.setItem(draftKey, JSON.stringify(draft));

        //         console.log('Successfully merged image map into campaign draft.');

        //     } catch (e) {
        //         console.error('Error while merging Step 4 media data:', e);
        //         // Decide if you want to stop the user here or not
        //         // For now, we'll let them continue.
        //     }
        // }



        if (curr === 4) {
            const mediaMode = $('#sourceHidden').val();

            // CHECK 1: Is a media mode selected?
            if (mediaMode === '') {
                alert('Please choose a media option ("Auto Search" or "Manually Add") to continue.');
                return release();
            }

            // CHECK 2: If manual mode, validate required images
            if (mediaMode === 'manual') {
                const hasFeaturedImage = $('#cardCover').hasClass('has-image');
                if (!hasFeaturedImage) {
                    alert('A Featured Image is required. Please select one to continue.');
                    return release();
                }

                // Check for unmatched keywords
                const unmatched = $('#miContentList .thumb-box[data-matched="0"]').length;
                if (unmatched) {
                    const proceed = confirm(
                        `There are ${unmatched} keywords without an associated image.
Are you sure you want to proceed without matching them?`);
                    if (!proceed) return release();
                }
            }
        }
        // ▲▲▲ END OF NEW LOGIC ▲▲▲
        // ====================================================================
        // ▲▲▲ END OF STEP 4 VALIDATION ▲▲▲
        // ====================================================================


        /* --- Original Step-4 validation for manual matching --- */
        if (curr === 4) {
            const mode = $('#sourceHidden').val();
            if (mode === 'manual') {
                const unmatched =
                    $('#miContentList .thumb-box[data-matched="0"]').length;
                if (unmatched) {
                    const proceed = confirm(
                        `There are ${unmatched} keywords without an associated image.
Are you sure you want to proceed without matching them?`);
                    if (!proceed) return release();
                }
            }
        }
// ====================================================================
// ▼▼▼ VALIDATION CHECKS FOR STEP 5 - SCHEDULE CADENCE WARNING ▼▼▼
// ====================================================================
if (curr === 5) {
    const frequencyValue = parseInt($('#frequencyValue').val(), 10);
    const frequencyUnit = $('#frequencySelect').val();
    
    // Basic required field validation
    if (!frequencyValue || frequencyValue < 1) {
        alert('Please enter a valid frequency value (minimum 1).');
        return release();
    }
    
    if (!frequencyUnit) {
        alert('Please select a frequency unit.');
        return release();
    }
    
    // Additional validation for first publish date
    const scheduleDate = $('#scheduleDate').val();
    if (!scheduleDate) {
        alert('Please select a first publish date and time.');
        return release();
    }
    
    // Validate that the date is not in the past
    const selectedDate = new Date(scheduleDate);
    const now = new Date();
    now.setSeconds(0, 0); // Round down to nearest minute
    
    if (selectedDate < now) {
        alert('You cannot select a past date or time for the first publish.');
        return release();
    }
    
    // Cadence warning check - Use the modal instead of confirm()
    let hoursBetweenRuns;
    
    if (frequencyUnit === 'minutes') {
        hoursBetweenRuns = frequencyValue / 60;
    } else if (frequencyUnit === 'hours') {
        hoursBetweenRuns = frequencyValue;
    } else {
        // days/weeks/months - no warning needed
        hoursBetweenRuns = 999; // large number to skip warning
    }
    
    // Show warning if posts are more frequent than every 12 hours
    if (hoursBetweenRuns < 12) {
        // Show the modal and wait for user response
        const modalPromise = new Promise((resolve) => {
            const modalEl = document.getElementById('cadenceModal');
            const modalCloseEl = document.getElementById('cadenceModalClose');
            
            if (!modalEl || !modalCloseEl) {
                resolve(true); // If modal doesn't exist, proceed
                return;
            }
            
            // Show modal
            modalEl.style.display = 'flex';
            
            // Create custom event handlers
            const handleClose = () => {
                cleanup();
                resolve(true); // User clicked "Got it" - proceed
            };
            
            const handleCancel = (e) => {
                if (e.target === modalEl) {
                    cleanup();
                    resolve(false); // User clicked outside - cancel
                }
            };
            
            const cleanup = () => {
                modalEl.style.display = 'none';
                modalCloseEl.removeEventListener('click', handleClose);
                modalEl.removeEventListener('click', handleCancel);
            };
            
            // Add event listeners
            modalCloseEl.addEventListener('click', handleClose);
            modalEl.addEventListener('click', handleCancel);
        });
        
        // Wait for modal response
        const shouldProceed = await modalPromise;
        if (!shouldProceed) {
            return release(); // User cancelled
        }
    }
}
// ====================================================================
// ▲▲▲ END OF STEP 5 VALIDATION ▲▲▲
// ====================================================================

        /* 4) Adım geçişi */
        if (typeof showStep === 'function') showStep(curr + 1);
        if (curr + 1 === 4 && typeof refreshMiContentList === 'function') {
            refreshMiContentList();
        }

        /* 4. adım (Media) hariç tablo/medya kutularını gizle */
        if (curr + 1 !== 4) {
            $('#mediaUploadBox, #matchImagesPanel').hide();
        }

        /* 5) Debounce: belirlenen süre sonra butonu serbest bırak */
        setTimeout(release, DEBOUNCE_MS);

    });

})();