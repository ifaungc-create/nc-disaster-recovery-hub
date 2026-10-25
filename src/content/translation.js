// Translation apps, built-in phone translation and interpreter help. Every link was fetched and read on
// 2026-10-24 (HTTP 200, page title and steps checked). Steps are short summaries of the linked official help
// page; menus change between phone models and software versions, so each section links its source.
// lep.gov is NOT linked: the U.S. Department of Justice suspended it (notice dated July 17, 2025).
// SayHi is NOT listed: its website and Play listing did not load on 2026-10-24.
export const CHECKED = '2026-10-24';
const P = (en, es) => ({ en, es });

export const SOURCES = {
  appleWords: { en: 'Apple: Translate words and phrases on iPhone', es: 'Apple: Traducir frases y palabras en el iPhone', url: 'https://support.apple.com/guide/iphone/translate-words-and-phrases-iphd74cb450f/ios', url_es: 'https://support.apple.com/es-us/guide/iphone/iphd74cb450f/ios' },
  appleConv: { en: 'Apple: Translate in-person conversations with iPhone', es: 'Apple: Traducir conversaciones en persona con el iPhone', url: 'https://support.apple.com/guide/iphone/translate-in-person-conversations-n4pjjxr31uel/ios', url_es: 'https://support.apple.com/es-us/guide/iphone/n4pjjxr31uel/ios' },
  appleCam: { en: 'Apple: Use the camera in the Translate app on iPhone', es: 'Apple: Usar la cámara en la app Traducir en el iPhone', url: 'https://support.apple.com/guide/iphone/translate-with-the-camera-iphea8b95631/ios', url_es: 'https://support.apple.com/es-us/guide/iphone/iphea8b95631/ios' },
  appleSafari: { en: 'Apple: Browse the web using Safari on iPhone (Translate a webpage)', es: 'Apple: Navegar por Internet usando Safari en el iPhone (traducir una página web)', url: 'https://support.apple.com/guide/iphone/browse-the-web-iph1fbef4daa/ios', url_es: 'https://support.apple.com/es-us/guide/iphone/iph1fbef4daa/ios' },
  gLive: { en: 'Google Translate Help: Live translate (Android)', es: 'Ayuda de Google Translate: Traducción instantánea (Android)', url: 'https://support.google.com/translate/answer/6142474?hl=en&co=GENIE.Platform%3DAndroid', url_es: 'https://support.google.com/translate/answer/6142474?hl=es&co=GENIE.Platform%3DAndroid' },
  gImages: { en: 'Google Translate Help: Translate images (Android)', es: 'Ayuda de Google Translate: Traducir imágenes (Android)', url: 'https://support.google.com/translate/answer/6142483?hl=en&co=GENIE.Platform%3DAndroid', url_es: 'https://support.google.com/translate/answer/6142483?hl=es&co=GENIE.Platform%3DAndroid' },
  chrome: { en: 'Google Chrome Help: Translate pages (Android)', es: 'Ayuda de Google Chrome: Traducir páginas (Android)', url: 'https://support.google.com/chrome/answer/173424?hl=en&co=GENIE.Platform%3DAndroid', url_es: 'https://support.google.com/chrome/answer/173424?hl=es&co=GENIE.Platform%3DAndroid' },
  pixel: { en: 'Pixel Phone Help: Translate speech & text on your Pixel', es: 'Ayuda de Teléfono Pixel: Traducir texto y voz en su Pixel', url: 'https://support.google.com/pixelphone/answer/11209263?hl=en', url_es: 'https://support.google.com/pixelphone/answer/11209263?hl=es' },
  samsung: { en: 'Samsung: Live translate calls on your Galaxy phone', es: 'Samsung: Live translate en llamadas con su teléfono Galaxy', url: 'https://www.samsung.com/us/support/answer/ANS10000935/' },
  samsungInt: { en: 'Samsung: Interpreter app on Galaxy phone', es: 'Samsung: aplicación Interpreter en teléfonos Galaxy', url: 'https://www.samsung.com/us/support/troubleshoot/TSG10007488/' },
  fema: { en: 'FEMA: Language Access Services', es: 'FEMA: Language Access Services (servicios de idiomas)', url: 'https://www.fema.gov/about/civil-rights/survivors/language-access-services' },
  cfr: { en: '45 CFR 92.201 (Section 1557): language help in health programs', es: '45 CFR 92.201 (Sección 1557): ayuda con el idioma en programas de salud', url: 'https://www.ecfr.gov/current/title-45/subtitle-A/subchapter-A/part-92/subpart-C/section-92.201' },
  nc211: { en: 'NC 211: About (languages)', es: 'NC 211: About (idiomas)', url: 'https://nc211.org/about/' },
};

// Free apps. Store links open the official listing; price "Free"/"0" and iOS requirement read from the listing.
export const APPS = [
  { id: 'gt', name: 'Google Translate', what: { en: 'Type, talk, or point your camera at a sign or letter. Has a two-person conversation mode.', es: 'Escriba, hable o apunte la cámara a un letrero o carta. Tiene un modo de conversación para dos personas.' },
    links: [[P('Google Play (Android)', 'Google Play (Android)'), 'https://play.google.com/store/apps/details?id=com.google.android.apps.translate'], [P('App Store (iPhone)', 'App Store (iPhone)'), 'https://apps.apple.com/us/app/google-translate/id414706506'], [P('Google Translate on the web', 'Google Traductor en la web'), 'https://translate.google.com/']],
    note: { en: 'iPhone version needs iOS 18 or later (App Store listing).', es: 'La versión para iPhone necesita iOS 18 o posterior (según la App Store).' } },
  { id: 'ms', name: 'Microsoft Translator', what: { en: 'Text, voice, camera and conversation translation.', es: 'Traducción de texto, voz, cámara y conversaciones.' },
    links: [[P('Google Play (Android)', 'Google Play (Android)'), 'https://play.google.com/store/apps/details?id=com.microsoft.translator'], [P('App Store (iPhone)', 'App Store (iPhone)'), 'https://apps.apple.com/us/app/microsoft-translator/id1018949559'], [P('Microsoft Translator on the web (Bing)', 'Microsoft Translator en la web (Bing)'), 'https://www.bing.com/translator']],
    note: { en: 'iPhone version needs iOS 17 or later (App Store listing).', es: 'La versión para iPhone necesita iOS 17 o posterior (según la App Store).' } },
  { id: 'apple', name: 'Apple Translate', what: { en: 'Built into iPhone. If you deleted it, get it again free from the App Store.', es: 'Viene en el iPhone. Si lo borró, puede volver a instalarlo gratis desde la App Store.' },
    links: [[P('App Store (iPhone)', 'App Store (iPhone)'), 'https://apps.apple.com/us/app/translate/id1514844618']],
    note: { en: 'Needs iOS 14 or later (App Store listing).', es: 'Necesita iOS 14 o posterior (según la App Store).' } },
  { id: 'lens', name: 'Google Lens', what: { en: 'Point your camera at printed text (forms, signs, labels) to translate it.', es: 'Apunte la cámara a un texto impreso (formularios, letreros, etiquetas) para traducirlo.' },
    links: [[P('Google Play (Android)', 'Google Play (Android)'), 'https://play.google.com/store/apps/details?id=com.google.ar.lens']] },
];

// Built-in phone translation, step by step.
export const HOWTO = [
  { id: 'iphone', title: P('iPhone: Translate app', 'iPhone: app Traducir'), steps: [
    P('Open the Translate app.', 'Abra la app Traducir.'),
    P('Tap the language buttons at the top to choose the two languages.', 'Toque los botones de idioma de arriba para elegir los dos idiomas.'),
    P('Type, or tap the microphone and speak. Tap the play button to hear the translation.', 'Escriba, o toque el micrófono y hable. Toque el botón de reproducir para escuchar la traducción.'),
    P('You can download languages so translation works without internet.', 'Puede descargar idiomas para que la traducción funcione sin internet.'),
  ], src: ['appleWords'] },
  { id: 'iphone-conv', title: P('iPhone: talk with someone face to face', 'iPhone: hablar en persona con alguien'), steps: [
    P('Open the Translate app and tap Conversation.', 'Abra la app Traducir y toque Conversación.'),
    P('Tap the microphone, then say a phrase. Each person takes turns.', 'Toque el micrófono y diga una frase. Cada persona habla por turnos.'),
    P('So each person can read the conversation from their own side, switch to the Face to Face view (tap View, then Face to Face).', 'Para que cada persona lea la conversación desde su lado, cambie a la vista cara a cara.'),
    P('Conversations work without internet for languages you downloaded.', 'Las conversaciones funcionan sin internet en los idiomas que descargó.'),
  ], src: ['appleConv'] },
  { id: 'iphone-cam', title: P('iPhone: translate a letter, form or sign with the camera', 'iPhone: traducir una carta, formulario o letrero con la cámara'), steps: [
    P('Open the Translate app and tap Camera.', 'Abra la app Traducir y toque Cámara.'),
    P('Hold the phone so the text is on the screen. The translation appears over the text.', 'Sostenga el teléfono para que el texto aparezca en la pantalla. La traducción aparece sobre el texto.'),
    P('Tap the shutter button to freeze the image and read it closely.', 'Toque el botón del obturador para congelar la imagen y leerla con calma.'),
  ], src: ['appleCam'] },
  { id: 'android-conv', title: P('Android: Google Translate conversation', 'Android: conversación con Google Translate'), steps: [
    P('Open the Google Translate app.', 'Abra la app Google Traductor (Google Translate).'),
    P('At the bottom, tap Live translate.', 'Abajo, toque Traducción instantánea.'),
    P('Choose the mode (for example Conversation) and the two languages, then start speaking.', 'Elija el modo (por ejemplo, Conversación) y los dos idiomas, y empiece a hablar.'),
  ], src: ['gLive'] },
  { id: 'android-cam', title: P('Android: translate a letter, form or sign with the camera', 'Android: traducir una carta, formulario o letrero con la cámara'), steps: [
    P('Open the Google Translate app and choose the languages.', 'Abra la app Google Traductor (Google Translate) y elija los idiomas.'),
    P('Tap Camera and point it at the text, or choose a photo you already took.', 'Toque Cámara y apúntela al texto, o elija una foto que ya tomó.'),
    P('Small or blurry text may be translated wrong. Check important words with a person.', 'El texto pequeño o borroso puede traducirse mal. Confirme las palabras importantes con una persona.'),
  ], src: ['gImages'] },
  { id: 'pixel', title: P('Google Pixel: Live Translate', 'Google Pixel: Traducción instantánea'), steps: [
    P('Open Settings, tap System, then Live Translate, and turn on Use Live Translate (Pixel 6 and later).', 'Abra Ajustes, toque Sistema, luego Traducción instantánea, y active Usar Traducción instantánea (Pixel 6 y posteriores).'),
    P('It can translate text messages in some chat apps. Translation during phone calls needs a Pixel 10 or later.', 'Puede traducir mensajes de texto en algunas apps de chat. La traducción durante llamadas necesita un Pixel 10 o posterior.'),
  ], src: ['pixel'] },
  { id: 'samsung', title: P('Samsung Galaxy: Interpreter and Live translate', 'Samsung Galaxy: Interpreter y Live translate'), steps: [
    P('Interpreter (for talking in person): swipe down to open Quick settings and tap Interpreter. English and Spanish come installed; other languages are a free download.', 'Interpreter (para hablar en persona): deslice hacia abajo para abrir la Configuración rápida y toque Interpreter. El inglés y el español vienen instalados; los otros idiomas se descargan gratis.'),
    P('Live translate (for phone calls): open Settings, tap Galaxy AI, then Call assist, then Live translate, and turn it on.', 'Live translate (para llamadas): abra Configuración, toque Galaxy AI, luego Call assist, luego Live translate, y actívelo.'),
    P('Only on select Galaxy phones and tablets with One UI 6.1 or later.', 'Solo en algunos teléfonos y tabletas Galaxy con One UI 6.1 o posterior.'),
  ], src: ['samsungInt', 'samsung'] },
  { id: 'web', title: P('Translate a web page', 'Traducir una página web'), steps: [
    P('iPhone (Safari): open the page, tap the page menu button at the left of the address bar, then tap Translate to [language] if it is offered.', 'iPhone (Safari): abra la página, toque el botón del menú de la página a la izquierda de la barra de direcciones y luego toque Traducir a [idioma] si aparece.'),
    P('Android (Chrome): open the page and tap the language at the top of the screen, or tap More (⋮), then Translate.', 'Android (Chrome): abra la página y toque el idioma en el aviso de la parte de arriba de la pantalla, o toque Más (⋮) y luego Traducir.'),
  ], src: ['appleSafari', 'chrome'] },
];

// Google Translate's web page translator. Opened only when the person taps the button.
// Language codes are Google Translate's; names are written in their own language.
export const GT_LANGS = [
  ['es', 'Español'], ['vi', 'Tiếng Việt'], ['zh-CN', '中文 (简体)'], ['zh-TW', '中文 (繁體)'], ['ko', '한국어'], ['ar', 'العربية'],
  ['hmn', 'Hmoob'], ['fr', 'Français'], ['ht', 'Kreyòl ayisyen'], ['pt', 'Português'], ['ru', 'Русский'], ['uk', 'Українська'],
  ['hi', 'हिन्दी'], ['gu', 'ગુજરાતી'], ['tl', 'Tagalog'], ['my', 'မြန်မာ'], ['ne', 'नेपाली'], ['sw', 'Kiswahili'], ['am', 'አማርኛ'], ['ja', '日本語'], ['de', 'Deutsch'], ['en', 'English'],
];
const RTL = ['ar'];
export const langDir = (code) => (RTL.includes(code) ? 'rtl' : 'ltr');
export const gtLangTag = (code) => code;
export const gtUrl = (pageUrl, lang) => `https://translate.google.com/translate?sl=auto&tl=${encodeURIComponent(lang)}&u=${encodeURIComponent(pageUrl)}`;

// Free interpreters: only what the linked source says.
export const RIGHTS = [
  { id: 'fema', title: P('FEMA disaster assistance', 'Asistencia de FEMA por desastre'), points: [
    P('FEMA provides free written translation of documents and free oral interpretation from qualified interpreters to disaster survivors with limited English.', 'FEMA ofrece gratis la traducción escrita de documentos y la interpretación oral con intérpretes calificados a los sobrevivientes de desastres que hablan poco inglés.'),
    P('Call the FEMA Helpline and press 3 for other languages (1 is English, 2 is Spanish).', 'Llame a la Línea de Ayuda de FEMA y marque 3 para otros idiomas (1 es inglés, 2 es español).'),
    P('If you use video relay, a captioned phone or another relay service, give FEMA the number for that service.', 'Si usa un servicio de video relevo, un teléfono con subtítulos u otro servicio de relevo, dele a FEMA el número de ese servicio.'),
  ], phone: [P('FEMA Helpline', 'Línea de Ayuda de FEMA'), '1-800-621-3362'], src: ['fema'] },
  { id: 'health', title: P('Hospitals, clinics and health programs', 'Hospitales, clínicas y programas de salud'), points: [
    P('Health programs covered by Section 1557 of the Affordable Care Act (for example, those that receive federal health funding) must give language help free of charge and offer a qualified interpreter when one is needed.', 'Los programas de salud cubiertos por la Sección 1557 de la Ley de Cuidado de Salud a Bajo Precio (por ejemplo, los que reciben fondos federales de salud) deben dar ayuda con el idioma gratis y ofrecer un intérprete calificado cuando se necesite.'),
    P('They may not make you bring your own interpreter or pay for one.', 'No pueden obligarle a traer su propio intérprete ni a pagar por uno.'),
    P('Ask at the front desk: "I need an interpreter in [your language]."', 'Pida en la recepción: "Necesito un intérprete en [su idioma]".'),
  ], src: ['cfr'] },
  { id: '211', title: P('NC 211 (shelter, food and local help)', 'NC 211 (refugio, comida y ayuda local)'), points: [
    P('NC 211 says it is available in most languages. The call is free and confidential, and it is open 24 hours a day, 7 days a week.', 'NC 211 dice que atiende en la mayoría de los idiomas. La llamada es gratis y confidencial, y está abierto las 24 horas, los 7 días de la semana.'),
  ], phone: [P('NC 211', 'NC 211'), '211'], phone2: [P('NC 211 (if 211 does not connect)', 'NC 211 (si el 211 no conecta)'), '1-888-892-1162'], src: ['nc211'] },
];
