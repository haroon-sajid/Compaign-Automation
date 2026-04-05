<script>
// ================================================================
// FILE: /assets/js/social/create-campaign/05-set-schedule/scheduleSafetyGuard.js
// HOW TO ADD:
// 1. Save this code as /assets/js/social/create-campaign/05-set-schedule/scheduleSafetyGuard.js
// 2. In your HTML, AFTER jQuery and after other step-5 scripts, include:
//    <script src="/assets/js/social/create-campaign/05-set-schedule/scheduleSafetyGuard.js" defer></script>
//
// WHAT THIS MODULE DOES
// - Live "~X posts/day" preview under Frequency fields (Step 5)
// - Per-platform safety caps (based on Settings-selected platforms)
// - If schedule would exceed any platform's safe range:
//      * Show modern warning popup in English
//      * Tell which platforms are at risk
//      * Clear Frequency / Interval inputs + helpful placeholder
// - Blocks navigation to Step 6 until safe
//
// YOU MUST ADAPT IN REAL APP:
// - getSelectedPlatformsFromSettings() to read actual Settings (checkboxes/toggles).
//
// ACCESSIBILITY
// - Popup traps focus, ESC closes
//
// DEPENDENCIES
// - jQuery v3.x
// ================================================================

(function($){

    // --------------------------------
    // 1. Safe posting limits per 24h
    // --------------------------------
    const SAFE_LIMITS_PER_24H = {
        instagram : 80,   // Keep below ~100/day
        x         : 240,  // X/Twitter burst tolerance
        linkedin  : 25,   // Stricter + partner review
        tiktok    : 12,   // Creator spam risk
        facebook  : 50,   // Page anti-spam soft cap
        pinterest : 50    // Avoid pin spam throttling
    };

    // --------------------------------
    // 2. Get user-selected platforms
    // --------------------------------
    // In prod: read your Settings UI.
    // Here: we assume checkboxes in #socialPlatformsPanel.
    function getSelectedPlatformsFromSettings() {
        var arr = [];
        $('#socialPlatformsPanel input[type=checkbox][data-platform]:checked').each(function(){
            arr.push(String($(this).data('platform')).toLowerCase());
        });
        return arr;
    }

    // --------------------------------
    // 3. Live posts/day preview bar (below interval inputs)
    // --------------------------------
    function ensureDailyPreviewRow(){
        if ($('#scheduleDailyPreview').length) return;

        const previewHtml = `
            <div id="scheduleDailyPreview"
                 style="
                    font-size:12.5px;
                    line-height:1.4;
                    font-weight:500;
                    color:#6b6f76;
                    background:#f8f7ff;
                    border:1px solid #e5e1ff;
                    border-radius:8px;
                    padding:8px 10px;
                    margin-top:8px;
                    display:none;
                    transition:all .18s ease;
                 "
                 aria-live="polite">
            </div>
        `;
        $('#freqValueGroup').after(previewHtml);
    }

    function updateDailyPreviewUI(postsPerDay, unsafePlatforms){
        ensureDailyPreviewRow();

        const $box = $('#scheduleDailyPreview');

        if (postsPerDay == null) {
            $box.hide();
            return;
        }

        // Nice rounding
        let rounded = postsPerDay;
        if (rounded >= 10) {
            rounded = Math.round(rounded * 10) / 10; // 1 decimal
        } else {
            rounded = Math.round(rounded * 100) / 100; // 2 decimals
        }

        if (unsafePlatforms.length === 0){
            // safe look
            $box.css({
                background: '#f8f7ff',
                border: '1px solid #e5e1ff',
                color: '#4a4d57'
            });

            $box.text(
                `This schedule will publish ~${rounded} post(s) per day per selected platform. Looks healthy.`
            );

        } else {
            // warning look
            $box.css({
                background: '#fff5f5',
                border: '1px solid #ffb4b4',
                color: '#b02121'
            });

            $box.text(
                `WARNING: ~${rounded} post(s)/day may be too aggressive for: ${unsafePlatforms.join(', ')}.`
            );
        }

        $box.show();
    }

    // --------------------------------
    // 4. Popup UI (modern glass style, FIXED SPACING VERSION)
    // --------------------------------
    function ensureWarningModal(){
        if ($('#scheduleSafetyModal').length) return;

        const modalHtml = `
        <div id="scheduleSafetyModal" class="schedule-modal-overlay"
             role="dialog" aria-modal="true" aria-labelledby="scheduleModalTitle" tabindex="-1">
            <div class="schedule-modal-card">
                <div class="schedule-modal-header"
                     style="
                        display:flex;
                        gap:14px;
                        padding:20px 20px 12px;
                        border-bottom:1px solid rgba(255,255,255,0.07);
                        align-items:flex-start;
                     ">

                    <div class="schedule-modal-icon"
                         style="
                            width:40px;
                            height:40px;
                            flex-shrink:0;
                            border-radius:10px;
                            background:radial-gradient(circle at 20% 20%, #ffdd57 0%, #ff7a57 60%);
                            color:#1a1a1a;
                            font-size:18px;
                            display:flex;
                            align-items:center;
                            justify-content:center;
                            font-weight:700;
                            box-shadow:0 10px 25px rgba(255,122,87,.45);
                         ">
                        !
                    </div>

                    <div class="schedule-modal-headtext"
                         style="
                            flex:1;
                            min-width:0;
                         ">
                        <h3 id="scheduleModalTitle"
                            style="
                                margin:0;
                                color:#fff;
                                font-size:16px;
                                font-weight:600;
                                line-height:1.4;
                            ">
                            Posting frequency may be too aggressive
                        </h3>

                        <p class="schedule-modal-sub"
                           style="
                                margin:4px 0 0;
                                color:#b9b8cd;
                                font-size:13px;
                                line-height:1.4;
                                font-weight:400;
                           ">
                            Your schedule could violate safe posting limits for at least one selected social platform.
                        </p>
                    </div>
                </div>

                <div class="schedule-modal-body"
                     style="
                        padding:16px 20px 8px;
                        max-height:50vh;
                        overflow-y:auto;
                     ">

                    <div class="schedule-modal-section"
                         style="
                            margin-bottom:16px;
                            background:rgba(255,255,255,0.03);
                            border:1px solid rgba(255,255,255,0.05);
                            border-radius:12px;
                            padding:12px 14px;
                         ">
                        <h4 style="
                            margin:0 0 6px;
                            font-size:13px;
                            font-weight:600;
                            color:#fff;
                            line-height:1.4;
                            display:flex;
                            align-items:center;
                            gap:6px;
                        ">
                            High risk for:
                        </h4>
                        <p id="scheduleModalPlatforms"
                           style="
                                margin:0;
                                font-size:13px;
                                line-height:1.5;
                                color:#fff;
                                font-weight:600;
                                word-break:break-word;
                           ">-</p>
                    </div>

                    <div class="schedule-modal-section"
                         style="
                            margin-bottom:16px;
                            background:rgba(255,255,255,0.03);
                            border:1px solid rgba(255,255,255,0.05);
                            border-radius:12px;
                            padding:12px 14px;
                         ">
                        <h4 style="
                            margin:0 0 6px;
                            font-size:13px;
                            font-weight:600;
                            color:#fff;
                            line-height:1.4;
                            display:flex;
                            align-items:center;
                            gap:6px;
                        ">
                            Why this matters
                        </h4>
                        <p style="
                            margin:0;
                            font-size:13px;
                            line-height:1.5;
                            color:#c9c8e0;
                            font-weight:400;
                        ">
                            Platforms can temporarily block, throttle, or shadow-limit your account if you publish too often in a short time window.
                            Keeping a healthy cadence helps avoid spam detection and preserves reach.
                        </p>
                    </div>

                    <div class="schedule-modal-section"
                         style="
                            margin-bottom:16px;
                            background:rgba(255,255,255,0.03);
                            border:1px solid rgba(255,255,255,0.05);
                            border-radius:12px;
                            padding:12px 14px;
                         ">
                        <h4 style="
                            margin:0 0 6px;
                            font-size:13px;
                            font-weight:600;
                            color:#fff;
                            line-height:1.4;
                            display:flex;
                            align-items:center;
                            gap:6px;
                        ">
                            What you can do
                        </h4>
                        <ul style="
                            margin:0;
                            padding-left:18px;
                            color:#c9c8e0;
                            font-size:13px;
                            line-height:1.5;
                        ">
                            <li>Increase the interval between posts (e.g. every few hours instead of every few minutes).</li>
                            <li>Reduce overall daily volume.</li>
                            <li>Stagger content across different days instead of blasting in one day.</li>
                        </ul>
                    </div>

                    <div class="schedule-modal-hint"
                         style="
                            font-size:12px;
                            color:#9d9bc9;
                            line-height:1.5;
                            font-style:italic;
                            padding-top:4px;
                         ">
                        We cleared your Frequency / Interval values. Please enter a slower schedule.
                    </div>
                </div>

                <div class="schedule-modal-footer"
                     style="
                        padding:16px 20px 20px;
                        border-top:1px solid rgba(255,255,255,0.07);
                        display:flex;
                        justify-content:flex-end;
                     ">
                    <button type="button" id="scheduleModalCloseBtn"
                        style="
                            appearance:none;
                            -webkit-appearance:none;
                            border:0;
                            outline:0;
                            cursor:pointer;
                            border-radius:10px;
                            background:linear-gradient(90deg,#6c4ad0 0%,#9b6bff 100%);
                            box-shadow:0 16px 32px rgba(108,74,208,.4);
                            color:#fff;
                            font-weight:600;
                            padding:10px 14px;
                            font-size:13px;
                            line-height:1.2;
                        ">
                        Got it
                    </button>
                </div>
            </div>
        </div>
        `;

        $('body').append(modalHtml);

        // base overlay/card styles if not already injected
        if (!$('#scheduleSafetyModalCSS').length){
            const modalCss = `
            <style id="scheduleSafetyModalCSS">
                .schedule-modal-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(15,16,28,0.45);
                    backdrop-filter: blur(4px);
                    -webkit-backdrop-filter: blur(4px);
                    z-index: 99999;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 24px;
                    font-family:'Inter',system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
                }
                .schedule-modal-card {
                    background: radial-gradient(circle at 0% 0%, rgba(34,32,54,0.9) 0%, rgba(21,20,34,0.9) 100%);
                    border: 1px solid rgba(255,255,255,0.08);
                    box-shadow: 0 30px 80px rgba(0,0,0,.6);
                    border-radius: 16px;
                    max-width: 420px;
                    width: 100%;
                    color:#fff;
                    display:flex;
                    flex-direction:column;
                    animation: modalPop .2s cubic-bezier(.16,1,.3,1);
                }
                @keyframes modalPop {
                    0% {transform: translateY(20px) scale(.96); opacity:0;}
                    100%{transform: translateY(0) scale(1); opacity:1;}
                }
            </style>`;
            $('head').append(modalCss);
        }

        // Close handlers
        $('#scheduleModalCloseBtn').on('click', closeWarningModal);
        $(document).on('keydown.scheduleModalEscape', function(e){
            if (e.key === "Escape") {
                closeWarningModal();
            }
        });
    }

    function openWarningModal(unsafePlatforms){
        ensureWarningModal();

        $('#scheduleModalPlatforms').text(
            unsafePlatforms.length ? unsafePlatforms.join(', ') : '-'
        );

        $('#scheduleSafetyModal')
            .fadeIn(120)
            .attr('aria-hidden','false')
            .focus();

        $('#scheduleModalCloseBtn').trigger('focus');
    }

    function closeWarningModal(){
        $('#scheduleSafetyModal')
            .fadeOut(120)
            .attr('aria-hidden','true');
    }

    // --------------------------------
    // 5. Math helpers
    // --------------------------------
    function estimatePostsPerDay() {
        const unit = $('#frequencySelect').val();
        const rawVal = $('#frequencyValue').val();
        if (!unit || !rawVal) return null;

        const n = parseFloat(rawVal);
        if (isNaN(n) || n <= 0) return null;

        // convert N <unit> to minutes
        let minutesPerInterval;
        switch(unit){
            case 'minutes':
                minutesPerInterval = n;
                break;
            case 'hours':
                minutesPerInterval = n * 60;
                break;
            case 'days':
                minutesPerInterval = n * 24 * 60;
                break;
            case 'weeks':
                minutesPerInterval = n * 7 * 24 * 60;
                break;
            case 'months':
                minutesPerInterval = n * 30 * 24 * 60; // ~30d
                break;
            default:
                return null;
        }

        const MINUTES_PER_DAY = 24 * 60;

        if (minutesPerInterval >= MINUTES_PER_DAY){
            return 1; // ≤1/day
        } else {
            return MINUTES_PER_DAY / minutesPerInterval;
        }
    }

    function getUnsafePlatforms(postsPerDay){
        const activePlatforms = getSelectedPlatformsFromSettings() || [];
        const badOnes = [];

        if (postsPerDay == null || !activePlatforms.length){
            return badOnes;
        }

        for (let i=0; i<activePlatforms.length; i++){
            const key = activePlatforms[i];
            const cap = SAFE_LIMITS_PER_24H[key];
            if (typeof cap === "number" && postsPerDay > cap){
                badOnes.push(key);
            }
        }
        return badOnes;
    }

    // --------------------------------
    // 6. Reset schedule inputs after warning
    // --------------------------------
    function clearScheduleInputs(){
        $('#frequencySelect').val('');
        $('#frequencyValue')
            .val('')
            .attr('placeholder','Try a slower interval (e.g. every 2 hours)');
        $('#freqValueGroup').hide();
    }

    // --------------------------------
    // 7. UI helpers for Step 5
    // --------------------------------
    function updateFreqValueLabel(){
        const unit = $('#frequencySelect').val();
        const $group = $('#freqValueGroup');
        const $label = $('#freqValueLabel');

        if (!unit){
            $group.hide();
            return;
        }

        const niceUnit = unit.charAt(0).toUpperCase() + unit.slice(1);
        $label.text(niceUnit + ' Between Triggers');

        $group.show();
    }

    function validateScheduleSafety(){
        const postsPerDay = estimatePostsPerDay();
        const unsafePlatforms = getUnsafePlatforms(postsPerDay);

        // live preview UI under inputs
        updateDailyPreviewUI(postsPerDay, unsafePlatforms);

        // If NO platform selected in Settings -> don't block
        const activePlatforms = getSelectedPlatformsFromSettings() || [];
        if (!activePlatforms.length){
            return true;
        }

        // If any platform is unsafe -> popup + clear + block
        if (unsafePlatforms.length > 0){
            openWarningModal(unsafePlatforms);
            clearScheduleInputs();
            updateDailyPreviewUI(null, []); // hide preview
            return false;
        }

        return true;
    }

    // --------------------------------
    // 8. Hook events
    // --------------------------------
    $('#frequencySelect').on('change', function(){
        updateFreqValueLabel();
        validateScheduleSafety();
    });

    $('#frequencyValue').on('input', function(){
        validateScheduleSafety();
    });

    // When Settings checkboxes change, re-validate:
    $('#socialPlatformsPanel input[type=checkbox]').on('change', function(){
        validateScheduleSafety();
    });

    // Intercept Step5 → Step6
    $(document).on('click', '.wizard-step[data-step="5"] .next-step', function(e){
        const ok = validateScheduleSafety();
        if (!ok){
            e.stopImmediatePropagation();
            e.preventDefault();
            return false;
        } else {
            // optional toast / proceed
            alert("✅ Safe! You can go to Step 6 now.");
        }
    });

    // Init modal / preview containers on load
    ensureWarningModal();
    $('#scheduleSafetyModal').hide().attr('aria-hidden','true');
    ensureDailyPreviewRow();
    updateDailyPreviewUI(null, []);

})(jQuery);
</script>
