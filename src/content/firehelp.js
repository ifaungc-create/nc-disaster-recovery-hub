// "I just had a home fire": the guided flow opened from the red button at the top of Home.
// English and Spanish side by side ({ en, es }, shown with pick()). Rule, same as resources.js: every phone
// number and link was checked against an official or first-party page on CHECKED (sources listed below).
// Phone numbers reused here (Red Cross, NC 211, NCDOI) are the same verified numbers used elsewhere in the app.
export const CHECKED = '2026-11-04';
const L = (en, es) => ({ en, es });

export const SOURCES = {
  rc: { en: 'American Red Cross: What to Do After a Home Fire', es: 'Cruz Roja Americana: qué hacer después de un incendio en casa', url: 'https://www.redcross.org/get-help/how-to-prepare-for-emergencies/types-of-emergencies/fire/home-fire-recovery.html' },
  ncdoi: { en: 'NC Department of Insurance: Recovery From a Fire', es: 'Departamento de Seguros de NC: recuperación después de un incendio', url: 'https://www.ncdoi.gov/consumers/disaster/recovery-fire' },
  ncdoiScams: { en: 'NC Department of Insurance: Protecting Yourself From Scams', es: 'Departamento de Seguros de NC: cómo protegerse de estafas', url: 'https://www.ncdoi.gov/consumers/disaster/protecting-yourself-scams' },
  lincoln: { en: 'Lincoln County (NC) Fire Marshal: After the Fire (PDF)', es: 'Jefe de Bomberos del Condado de Lincoln (NC): After the Fire (PDF)', url: 'https://www.lincolncountync.gov/DocumentCenter/View/7724' },
  rcDat: { en: 'American Red Cross: Activating a Disaster Action Team Response', es: 'Cruz Roja Americana: cómo se activa un Equipo de Acción en Desastres', url: 'https://www.redcross.org/local/california/northern-california-coastal/about-us/activating-a-red-cross-disaster-action-team-response.html' },
  rcAfter: { en: 'American Red Cross (North Texas): What to Do After a Home Fire', es: 'Cruz Roja Americana (norte de Texas): qué hacer después de un incendio en casa', url: 'https://www.redcross.org/local/texas/north-texas/about-us/news-and-events/news/what-to-do-after-a-home-fire.html' },
  rcRelief: { en: 'American Red Cross: Disaster Relief Services', es: 'Cruz Roja Americana: servicios de ayuda en desastres', url: 'https://www.redcross.org/about-us/our-work/disaster-relief.html' },
  usfa: { en: 'U.S. Fire Administration: After a Fire', es: 'Administración de Incendios de EE. UU.: después de un incendio', url: 'https://usfa.fema.gov/prevention/home-fires/after-a-fire/' },
};

export const PHONES = { redcross: '1-800-733-2767', nc211alt: '1-888-892-1162', ncdoi: '1-855-408-1212' };

export const TEXT = {
  bar: L('I just had a home fire', 'Acabo de tener un incendio en mi casa'),
  barSub: L('Tap here. We will walk you through what to do next.', 'Toque aquí. Le explicamos qué hacer ahora, paso a paso.'),
  title: L('I just had a home fire', 'Acabo de tener un incendio en mi casa'),
  e911: L('Is anyone hurt, or is the fire still burning?', '¿Hay alguien herido o el fuego sigue ardiendo?'),
  e911Body: L('Call 911 now.', 'Llame al 911 ahora.'),
  call911: L('Call 911', 'Llamar al 911'),
  intro: L('We will go one question at a time. Your answers stay on this device.', 'Vamos una pregunta a la vez. Sus respuestas se quedan en este dispositivo.'),
  steps: [L('Place to stay', 'Dónde quedarse'), L('Insurance', 'Seguro'), L('Not yet', 'Todavía no'), L('Checklist', 'Lista')],

  qStay: L('Do you have a safe place to stay tonight?', '¿Tiene un lugar seguro donde quedarse esta noche?'),
  stayYes: L('Yes, I have a safe place', 'Sí, tengo un lugar seguro'),
  stayNo: L('No, I need a place to stay', 'No, necesito un lugar donde quedarme'),

  shelterOnScene: L('Are the firefighters or police still there?', '¿Todavía están ahí los bomberos o la policía?'),
  shelterOnSceneBody: L('Ask them to contact the American Red Cross for you.', 'Pídales que llamen a la Cruz Roja Americana por usted.'),
  shelterGone: L('Have they already left?', '¿Ya se fueron?'),
  shelterGoneBody: L('Call the Red Cross yourself at 1-800-RED-CROSS.', 'Llame usted mismo a la Cruz Roja al 1-800-RED-CROSS.'),
  callRC: L('Call the Red Cross', 'Llamar a la Cruz Roja'),
  shelter211: L('NC 211 also knows which shelters are open near you.', 'NC 211 también sabe qué refugios están abiertos cerca de usted.'),
  call211: L('Call NC 211', 'Llamar a NC 211'),

  // Red Cross page (shown when someone needs a place to stay, and linked from the no-insurance page).
  rcTitle: L('The Red Cross can help you', 'La Cruz Roja puede ayudarle'),
  rcIntro: L('Most people do not know everything the Red Cross can do after a home fire. Here is what to expect.', 'La mayoría de las personas no sabe todo lo que la Cruz Roja puede hacer después de un incendio en casa. Esto es lo que puede esperar.'),
  rcHowTitle: L('How to reach the Red Cross', 'Cómo comunicarse con la Cruz Roja'),
  rcNextTitle: L('What happens next', 'Qué pasa después'),
  rcNext: [
    L('Once the Red Cross is dispatched, a trained team of volunteer disaster responders is activated. They usually reach out to you within 2 hours.', 'Cuando se despacha a la Cruz Roja, se activa un equipo de voluntarios capacitados en respuesta a desastres. Normalmente se comunican con usted en un plazo de 2 horas.'),
    L('The responders will verify your identity. There are several ways to do this, so tell them if your ID was lost in the fire.', 'Los voluntarios verificarán su identidad. Hay varias formas de hacerlo, así que dígales si su identificación se perdió en el incendio.'),
    L('They will verify your home address.', 'Verificarán la dirección de su casa.'),
    L('They will open a case to see what help you may qualify for.', 'Abrirán un caso para ver a qué ayuda puede tener derecho.'),
  ],
  rcCanTitle: L('What the Red Cross can help with', 'Con qué puede ayudar la Cruz Roja'),
  rcCan: [
    { k: 'recover', t: L('Recovering from the fire', 'Recuperarse del incendio'), d: L('They look at your situation and what you qualify for, and help you plan your next steps.', 'Revisan su situación y la ayuda a la que tiene derecho, y le ayudan a planear sus próximos pasos.') },
    { k: 'stay', t: L('A place to stay', 'Un lugar donde quedarse'), d: L('The Red Cross cannot put you in a hotel, but they may be able to give you financial help so you can make your own arrangements.', 'La Cruz Roja no puede ponerle en un hotel, pero puede darle ayuda económica para que usted haga sus propios arreglos.') },
    { k: 'meds', t: L('Lost medicine and medical items', 'Medicinas y artículos médicos perdidos'), d: L('Help replacing prescription medicine and items like eyeglasses, hearing aids and wheelchairs.', 'Ayuda para reponer medicinas recetadas y artículos como lentes, audífonos y sillas de ruedas.') },
    { k: 'mind', t: L('Mental health support', 'Apoyo de salud mental'), d: L('Support from trained, licensed mental health professionals.', 'Apoyo de profesionales de salud mental capacitados y con licencia.') },
    { k: 'faith', t: L('Spiritual care', 'Apoyo espiritual'), d: L('Faith-based spiritual care if you want it.', 'Apoyo espiritual basado en la fe, si usted lo desea.') },
    { k: 'loss', t: L('If you lost a loved one', 'Si perdió a un ser querido'), d: L('Support for families who lost a loved one because of the fire.', 'Apoyo para las familias que perdieron a un ser querido a causa del incendio.') },
    { k: 'refer', t: L('Referrals', 'Referencias'), d: L('Connections to other organizations and services that can help.', 'Contacto con otras organizaciones y servicios que pueden ayudar.') },
  ],
  rcTipsTitle: L('When you talk with the responders', 'Cuando hable con los voluntarios'),
  rcTips: [
    L('Tell them if you lost medicine or medical items. Disaster intake workers do not need to know your medical conditions or the names of your medicines. You will discuss that with a licensed medical professional at the Red Cross when they contact you.', 'Dígales si perdió medicinas o artículos médicos. Los trabajadores que toman su información no necesitan saber sus condiciones médicas ni los nombres de sus medicinas. Usted hablará de eso con un profesional médico con licencia de la Cruz Roja cuando se comunique con usted.'),
    L('Tell them if you would like help from a mental health professional or a spiritual care counselor.', 'Dígales si le gustaría recibir ayuda de un profesional de salud mental o de un consejero espiritual.'),
    L('Tell them if someone in your home died or was hurt in the fire.', 'Dígales si alguien de su hogar murió o resultó herido en el incendio.'),
  ],
  rcMore: L('Everything the Red Cross can do', 'Todo lo que puede hacer la Cruz Roja'),

  qIns: L('Do you have homeowners or renters insurance?', '¿Tiene seguro de vivienda o seguro de inquilino?'),
  insYes: L('Yes', 'Sí'),
  insNo: L('No', 'No'),
  insUnsure: L("I'm not sure", 'No estoy seguro'),

  qPhone: L("Do you have your insurance company's phone number?", '¿Tiene el número de teléfono de su compañía de seguros?'),
  phoneYes: L('Yes, I have it', 'Sí, lo tengo'),
  phoneNo: L('No, help me find it', 'No, ayúdeme a encontrarlo'),
  callNowTitle: L('Call your insurance company now', 'Llame ahora a su compañía de seguros'),
  callNow: [
    L('Tell them you had a fire and ask them to open a claim.', 'Dígales que tuvo un incendio y pida que abran un reclamo.'),
    L('Write down the claim number and the adjuster\'s name and phone number.', 'Anote el número de reclamo y el nombre y teléfono del ajustador.'),
    L('Ask if your policy pays for a hotel and meals while you cannot live at home (Additional Living Expenses).', 'Pregunte si su póliza paga hotel y comidas mientras no pueda vivir en su casa (gastos adicionales de vivienda, "Additional Living Expenses").'),
    L('If you need money right away, ask about an advance on your claim.', 'Si necesita dinero de inmediato, pregunte por un adelanto de su reclamo.'),
  ],
  saveClaim: L('Save the claim number in My Notes', 'Guardar el número de reclamo en Mis notas'),

  findTitle: L("Find your insurance company's number", 'Encuentre el número de su compañía de seguros'),
  findWhere: L('Look for it on:', 'Búsquelo en:'),
  find: [
    L('Your insurance card or policy papers', 'Su tarjeta de seguro o los papeles de su póliza'),
    L('Your insurance company\'s app or emails', 'La app o los correos de su compañía de seguros'),
    L('Your mortgage statement, if your insurance is paid with your mortgage', 'El estado de cuenta de su hipoteca, si el seguro se paga junto con la hipoteca'),
    L('Your bank or card statements (look for a payment to an insurance company)', 'Los estados de cuenta de su banco o tarjeta (busque un pago a una compañía de seguros)'),
    L('Your insurance agent', 'Su agente de seguros'),
  ],
  openList: L('Open the list of insurance claim numbers', 'Abrir la lista de números para reclamos de seguros'),

  unsureTitle: L('How to find out if you have insurance', 'Cómo saber si tiene seguro'),
  unsure: [
    L('If you have a mortgage, your lender usually requires homeowners insurance. Call your mortgage company and ask which company insures your home.', 'Si tiene hipoteca, el prestamista normalmente exige seguro de vivienda. Llame a su compañía hipotecaria y pregunte qué compañía asegura su casa.'),
    L('If you rent, check your lease and your emails for renters insurance. Some leases require it.', 'Si alquila, revise su contrato de alquiler y sus correos para ver si tiene seguro de inquilino. Algunos contratos lo exigen.'),
    L('Check your bank and card statements for payments to an insurance company.', 'Revise los estados de cuenta de su banco y tarjetas para ver si hay pagos a una compañía de seguros.'),
  ],
  ncdoiHelp: L('The NC Department of Insurance can help for free (weekdays 8–5).', 'El Departamento de Seguros de NC puede ayudarle gratis (días de semana, de 8 a 5).'),
  callNcdoi: L('Call NCDOI', 'Llamar a NCDOI'),
  foundIt: L('I found my insurance', 'Encontré mi seguro'),
  noneFound: L("I don't have insurance", 'No tengo seguro'),

  noInsTitle: L('Help when you do not have insurance', 'Ayuda cuando no tiene seguro'),
  noIns: [
    L('The Red Cross can help with urgent needs after a home fire, whether or not you have insurance.', 'La Cruz Roja puede ayudar con necesidades urgentes después de un incendio en casa, tenga o no tenga seguro.'),
    L('NC 211 connects you with local help for housing, food, utilities and more. It is free.', 'NC 211 le conecta con ayuda local para vivienda, comida, servicios públicos y más. Es gratis.'),
    L('Your county Department of Social Services (DSS) may have emergency help. Find it on your county page.', 'El Departamento de Servicios Sociales (DSS) de su condado puede tener ayuda de emergencia. Búsquelo en la página de su condado.'),
    L('FEMA usually cannot help after a single home fire. FEMA help for individuals opens only after a federal disaster declaration.', 'FEMA normalmente no puede ayudar después del incendio de una sola casa. La ayuda de FEMA para personas solo se abre después de una declaración federal de desastre.'),
  ],
  reliefLink: L('Relief organizations', 'Organizaciones de ayuda'),
  countyLink: L('Find your county page', 'Buscar la página de su condado'),

  dontTitle: L('Until you talk with your insurance company, do NOT:', 'Hasta que hable con su compañía de seguros, NO:'),
  dontTitleNoIns: L('Before you sign or throw anything away, do NOT:', 'Antes de firmar o tirar algo, NO:'),
  donts: [
    { t: L('Throw away damaged things.', 'Tire cosas dañadas.'), d: L('Take photos and video of everything first. The adjuster may need to see it.', 'Primero tome fotos y video de todo. Es posible que el ajustador necesite verlo.'), ins: true },
    { t: L('Sign anything from a board-up, cleanup or repair company.', 'Firme nada de una compañía de tapiado, limpieza o reparación.'), d: L('That includes a work authorization, an "assignment of benefits" or a "direction to pay." These can give the company rights to your claim money.', 'Eso incluye una autorización de trabajo, una "cesión de beneficios" o una "orden de pago". Pueden darle a la compañía derechos sobre el dinero de su reclamo.') },
    { t: L('Pay any company in full before the work is done.', 'Pague completo a ninguna compañía antes de que termine el trabajo.'), d: L('Get a written price first.', 'Primero pida un precio por escrito.') },
    { t: L('Start repairs, other than stopping more damage.', 'Empiece reparaciones, aparte de evitar más daños.'), d: L('Covering windows and roof holes is OK. Keep every receipt.', 'Cubrir ventanas y huecos del techo está bien. Guarde todos los recibos.') },
    { t: L('Start cleaning walls, furniture or clothes, or run appliances that got wet.', 'Empiece a limpiar paredes, muebles o ropa, ni use aparatos que se mojaron.'), d: L('Wrong cleaning can make smoke damage worse. Have wet appliances checked first.', 'Limpiar de forma incorrecta puede empeorar el daño del humo. Haga revisar primero los aparatos mojados.') },
    { t: L('Try to open a safe yet.', 'Intente abrir una caja fuerte todavía.'), d: L('The NC Department of Insurance says to wait.', 'El Departamento de Seguros de NC recomienda esperar.') },
  ],
  boardupLink: L('Board-up & cleanup companies: what to know', 'Compañías de tapiado y limpieza: lo que debe saber'),

  listTitle: L('What to do after a home fire', 'Qué hacer después de un incendio en casa'),
  listIntro: L('Check things off as you go. Your checks stay on this device.', 'Marque cada cosa cuando la haga. Sus marcas se quedan en este dispositivo.'),
  done: L('{n} of {total} done', '{n} de {total} hechas'),
  goApp: L('Go to the app', 'Ir a la aplicación'),
  homeCare: L('Cleaning smoke and soot: home care guide', 'Limpiar humo y hollín: guía de cuidado del hogar'),
  restart: L('Start over', 'Empezar de nuevo'),
  sources: L('Sources:', 'Fuentes:'),
  checked: L('Checked {date}. General guidance only; follow your fire department and insurance company.', 'Revisado el {date}. Solo es una guía general; siga las indicaciones de los bomberos y de su compañía de seguros.'),
};

// The checklist. `ins` / `noIns` give a different line for people with and without insurance.
// link: [label {en, es}, href]
export const CHECKLIST = [
  { id: 'safe', text: L('Stay out of your home until the fire department says it is safe to go in.', 'No entre a su casa hasta que los bomberos digan que es seguro.'), src: ['rc', 'ncdoi'] },
  { id: 'utilities', text: L('Put your utilities on hold. Call your power, gas, water, phone and internet companies and tell them where you are staying. Do not turn anything back on yourself; an electrician should check the wiring first.', 'Ponga en pausa sus servicios. Llame a las compañías de luz, gas, agua, teléfono e internet y dígales dónde se está quedando. No vuelva a conectar nada usted mismo; un electricista debe revisar primero los cables.'), src: ['ncdoi', 'lincoln'] },
  { id: 'items', text: L('Ask the fire department to help you get important things if it is safe: medicine, glasses or hearing aids, wallet and ID, phone, keys, bank cards and insurance papers. Tell them where these things were. Firefighters can often look for them.', 'Pida a los bomberos que le ayuden a sacar cosas importantes si es seguro: medicinas, lentes o audífonos, cartera e identificación, teléfono, llaves, tarjetas del banco y papeles del seguro. Dígales dónde estaban. Muchas veces los bomberos pueden buscarlas.'), src: ['ncdoi', 'lincoln'] },
  { id: 'secure', ins: L('Work with your insurance company to choose a board-up company. Covering windows, doors and roof holes protects your home from rain, theft and more damage.', 'Trabaje con su compañía de seguros para elegir una compañía de tapiado. Cubrir ventanas, puertas y huecos del techo protege su casa de la lluvia, los robos y más daños.'), noIns: L('Get your home secured: board up windows and doors and cover roof holes. Get a written price first, and ask relief groups about free help.', 'Asegure su casa: tape ventanas y puertas y cubra los huecos del techo. Primero pida un precio por escrito y pregunte a los grupos de ayuda si hay ayuda gratis.'), link: [L('Before you sign with a company', 'Antes de firmar con una compañía'), '#resources/boardup'], src: ['ncdoi', 'ncdoiScams'] },
  { id: 'police', text: L('Ask the police to keep an eye on your home while it is empty.', 'Pida a la policía que vigile su casa mientras esté vacía.'), src: ['ncdoi', 'lincoln'] },
  { id: 'neighbors', text: L('Give your neighbors your phone number so they can reach you if they see someone at your home or if mail or packages arrive.', 'Dé su número de teléfono a sus vecinos para que puedan avisarle si ven a alguien en su casa o si llega correo o paquetes.') },
  { id: 'landlord', text: L('If you rent, tell your landlord or property manager. If you own, tell your mortgage company, and keep paying your mortgage unless the lender agrees otherwise in writing.', 'Si alquila, avise al dueño o administrador. Si es dueño, avise a su compañía hipotecaria y siga pagando la hipoteca, a menos que el prestamista acepte otra cosa por escrito.'), src: ['ncdoi', 'lincoln'] },
  { id: 'report', text: L('Ask the fire department for a copy of the fire report.', 'Pida a los bomberos una copia del informe del incendio.'), link: [L('How to get a fire report', 'Cómo obtener un informe de incendio'), '#resources/fire-report'], src: ['lincoln'] },
  { id: 'receipts', ins: L('Keep every receipt: hotel, meals, clothes and supplies. Your insurance may pay some of these back.', 'Guarde todos los recibos: hotel, comidas, ropa y artículos. Su seguro puede devolverle parte de esos gastos.'), noIns: L('Keep every receipt. You may need them for help programs or your taxes.', 'Guarde todos los recibos. Puede necesitarlos para programas de ayuda o para sus impuestos.'), src: ['lincoln'] },
  { id: 'food', text: L('Throw away food, drinks and medicine that were near the heat, smoke or soot. Take photos first. Ask your pharmacist or doctor about replacing medicine.', 'Tire la comida, las bebidas y las medicinas que estuvieron cerca del calor, el humo o el hollín. Primero tome fotos. Pregunte a su farmacéutico o médico cómo reponer sus medicinas.'), src: ['rc', 'lincoln'] },
  { id: 'pets', text: L('Take your pets to a veterinarian, even if they seem fine. Smoke injuries are not always easy to see.', 'Lleve sus mascotas al veterinario, aunque parezcan estar bien. Las lesiones por humo no siempre se ven.'), src: ['rc', 'lincoln'] },
  { id: 'mail', text: L('Hold or forward your mail with the Post Office.', 'Detenga o reenvíe su correo con el Servicio Postal.'), link: [L('USPS: forward your mail', 'USPS: reenviar su correo'), 'https://www.usps.com/manage/forward.htm'], src: ['ncdoi'] },
  { id: 'tell', text: L("Tell your employer and your children's schools.", 'Avise a su empleador y a las escuelas de sus hijos.'), src: ['ncdoi'] },
  { id: 'docs', text: L('Start replacing lost documents: ID, Social Security card, birth certificate and bank cards.', 'Empiece a reemplazar los documentos perdidos: identificación, tarjeta de Seguro Social, acta de nacimiento y tarjetas del banco.'), link: [L('Replacing documents', 'Reemplazar documentos'), '#resources/documents'], src: ['rc'] },
  { id: 'care', text: L('Take care of yourself and your family. Stress after a fire is normal. If you need someone to talk to, call or text 988.', 'Cuídese usted y a su familia. Sentir estrés después de un incendio es normal. Si necesita hablar con alguien, llame o envíe un texto al 988.'), src: ['rc'] },
];
