/* =====================================================================
   create-campaign-back-button.js
   ---------------------------------------------------------------------
   • “Back” (#step1BackBtn) başta gizlidir.
   • Prompt (1. adım) içinde kullanıcı bir A K S İ Y O N
     (+ New Prompt / Manage, Next → …) yaparsa görünür.
   • Başka bir adıma geçilince görünmeye devam eder.
   • Herhangi bir yolla tekrar Prompt’a dönülürse tekrar gizlenir.
   • Prompt’ta göründüğü bir anda kullanıcı Back’e basarsa
     (örneğin modal kapatmak veya sayfadan çıkmak yerine) yine gizlenir.
   ------------------------------------------------------------------ */
$(function () {
  /* ─── Değişkenler ───────────────────────────────────────────── */
  const $backBtn   = $('#step1BackBtn').hide();             // ilk hâl
  const $stepper   = $('.wizard-stepper-horizontal');       // yatay stepper
  const FIRST_STEP = 0;                                     // Prompt index
  let   promptAction = false;                               // “aksiyon” flag

  /* ─── Yardımcılar ───────────────────────────────────────────── */
  const showBack = () => $backBtn.show();
  const hideBack = () => $backBtn.hide();

  const getActiveStep = () => $stepper.find('li.active').index();

  /* Aktif adıma göre Back’i yönet */
  function syncBack () {
    const idx = getActiveStep();

    if (idx === FIRST_STEP) {           // Prompt
      promptAction ? showBack() : hideBack();
    } else {                            // Diğer adımlar
      showBack();
      promptAction = false;             // tekrar Prompt’a dönünce gizlenecek
    }
  }

  /* ─── Prompt içindeki aksiyonlar: Back’i aç ────────────────── */
  $('#newPromptBtn, #manageTemplatesBtn').on('click', () => {
    promptAction = true;
    showBack();
  });

  /* Next → : Back’i hemen aç, step değişince tekrar senkronize et */
  $('.btn-next').on('click', () => {
    promptAction = true;
    showBack();
    setTimeout(syncBack, 30);           // step değişimi sonrasında
  });

  /* Genel Back (wizard’ın kendi geri butonu) */
  $('.btn-back').on('click', () => setTimeout(syncBack, 30));

  /* Stepper tıklaması */
  $stepper.on('click', 'li', () => setTimeout(syncBack, 20));

  /* Wizard eklentisi özel event yayıyorsa */
  $(document).on('wizard:stepChanged', syncBack);

  /* Prompt’tayken görünen Back’e basılırsa tekrar gizle */
  $backBtn.on('click', () => {
    if (getActiveStep() === FIRST_STEP) {
      promptAction = false;
      hideBack();
    }
  });

  /* Güvenlik: Sayfa beklenmedik bir adımda açılırsa */
  syncBack();
});
