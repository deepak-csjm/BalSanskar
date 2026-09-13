/**
 * Every string the interface shows, in Hindi.
 *
 * Hindi is the source language, not a translation: these schools work in Hindi,
 * their registers are in Hindi, and a platform that reads as an English tool
 * with a Hindi option will be used by the block office and ignored by the
 * teachers it is for.
 *
 * This table is the one that ships eagerly, because it is the default and it is
 * what almost every user will see. English is fetched only if somebody asks for
 * it — see ../index.tsx.
 */
export const hi = {
  'app.name': 'बालसंस्कार',
  'app.tagline': 'उत्तर प्रदेश बेसिक शिक्षा परिषद का साझा मंच',

  'nav.home': 'मुख्य',
  'nav.activities': 'गतिविधियाँ',
  'nav.enrolment': 'पंजीकरण',

  'class.BALVATIKA': 'बालवाटिका',
  'class.1': 'कक्षा 1',
  'class.2': 'कक्षा 2',
  'class.3': 'कक्षा 3',
  'class.4': 'कक्षा 4',
  'class.5': 'कक्षा 5',
  'class.6': 'कक्षा 6',
  'class.7': 'कक्षा 7',
  'class.8': 'कक्षा 8',

  'enrolment.title': 'विद्यालय का पंजीकरण',
  'enrolment.intro': 'हर कक्षा में कितने बच्चे हैं — बस संख्या, कोई नाम नहीं।',
  'enrolment.hint':
    'जो कक्षा आपके विद्यालय में नहीं चलती, उसे खाली छोड़ दीजिए। यह जानकारी सत्र में एक बार भरनी होती है।',
  'enrolment.total': 'कुल बच्चे',
  'enrolment.asOn': 'रजिस्टर की तिथि',
  'enrolment.asOnLabel': 'यह संख्या किस तिथि के रजिस्टर से ली गई',
  'enrolment.asOnHint': 'ताकि अंतर होने पर अधिकारी सही तिथि के बारे में पूछ सकें।',
  'enrolment.updatedBy': 'भरने वाले',
  'enrolment.saved': 'पंजीकरण सुरक्षित हो गया।',
  'enrolment.privacy':
    'यह मंच किसी बच्चे का नाम, फ़ोटो या अभिभावक का विवरण नहीं रखता — केवल कक्षावार संख्या।',

  'village.notFound': 'यह विद्यालय नहीं मिला, अथवा खंड कार्यालय ने अभी इसकी पुष्टि नहीं की है।',
  'village.children': 'विद्यालय में बच्चे',
  'village.privacy':
    'यह मंच किसी बच्चे का नाम, फ़ोटो या अभिभावक का विवरण नहीं रखता — केवल कक्षावार संख्या।',
  'village.needs': 'विद्यालय को इसकी आवश्यकता है',
  'village.needsHint': 'गाँव का कोई भी व्यक्ति इनमें से किसी में सहयोग कर सकता है।',
  'village.needsEmpty': 'अभी कोई आवश्यकता दर्ज नहीं है।',
  'village.promised': 'सहयोग का वचन मिला',
  'village.quantity': 'संख्या',
  'village.howToHelp':
    'सहयोग हेतु विद्यालय के प्रधानाध्यापक से मिलिए। इस मंच से कोई धनराशि नहीं ली जाती और न ही कोई भुगतान होता है।',
  'village.thanks': 'जिनके सहयोग से यह संभव हुआ',
  'village.work': 'विद्यालय का कार्य',
  'village.workHint': 'वही कार्य जिसे खंड शिक्षा अधिकारी ने जाँचकर स्वीकृत किया है।',
  'village.smc': 'विद्यालय प्रबंध समिति',
  'village.smcHeldOn': 'बैठक की तिथि',
  'village.present': 'सदस्य उपस्थित',
  'village.parents': 'अभिभावक',
  'village.women': 'महिलाएँ',
  'village.raised': 'खंड कार्यालय से माँग',
  'village.outOfSchool': 'विद्यालय से बाहर बच्चे',
  'village.found': 'सर्वेक्षण में मिले',
  'village.broughtBack': 'विद्यालय से जोड़े गए',
  'village.stillOut': 'अभी भी बाहर',
  'village.stillOutHint':
    'इन बच्चों तक पहुँचने के लिए गाँव के सहयोग की आवश्यकता है। प्रधानाध्यापक से सम्पर्क कीजिए।',
  'village.allBack': 'सर्वेक्षण में मिले सभी बच्चे विद्यालय से जुड़ गए हैं।',
  'village.surveyPrivacy':
    'केवल संख्या दर्ज है। किसी बच्चे या परिवार का विवरण इस मंच पर नहीं रखा जाता।',
  'village.somethingWrong': 'कुछ ठीक नहीं लगता?',
  'village.grievance':
    'विद्यालय प्रबंध समिति की बैठक में यह बात रखिए, अथवा खंड शिक्षा अधिकारी कार्यालय को सूचित कीजिए।',

  'needs.title': 'विद्यालय की आवश्यकताएँ',
  'needs.intro': 'गाँव से क्या चाहिए। यह विद्यालय की दीवार वाले पृष्ठ पर दिखता है।',
  'needs.add': 'नई आवश्यकता जोड़ें',
  'needs.markMet': 'पूरा हुआ',
  'needs.helper': 'सहयोग करने वाले का नाम, जैसा वे चाहें',
  'needs.empty': 'अभी कोई आवश्यकता दर्ज नहीं है।',
  'survey.title': 'विद्यालय से बाहर बच्चे',
  'survey.intro': 'किस बस्ती में सर्वेक्षण हुआ और क्या मिला। केवल संख्या, कोई नाम नहीं।',
  'survey.habitation': 'बस्ती अथवा टोला',
  'survey.households': 'कितने घर देखे',
  'survey.found': 'बाहर मिले बच्चे',
  'survey.enrolled': 'जोड़े गए बच्चे',
  'survey.by': 'सर्वेक्षण किसने किया',
  'smc.title': 'प्रबंध समिति की बैठक',
  'smc.decisions': 'क्या तय हुआ',

  'scheme.label': 'यह कार्य किस योजना से जुड़ा है',
  'scheme.hint':
    'अधिकतम तीन चुनिए। इसी से खंड कार्यालय की मासिक योजनावार रिपोर्ट अपने आप बन जाती है।',
  'media.noChildLabel': 'इस फ़ोटो में किसी बच्चे का चेहरा पहचान में नहीं आता',
  'media.noChildHint':
    'बच्चों के चेहरे की फ़ोटो न लगाएँ। कार्य की फ़ोटो लगाइए — पठन कोना, बगिया, माॅडल, दीवार पत्रिका।',
  'media.noChildConfirm': 'पुष्टि हुई — इसमें कोई बच्चा पहचान में नहीं आता',
  'nav.review': 'समीक्षा',
  'nav.reports': 'रिपोर्ट',
  'nav.people': 'शिक्षक',
  'nav.clearance': 'जाँच',
  'nav.claims': 'दावे',
  'nav.showcase': 'प्रदर्शनी',

  'action.save': 'सहेजें',
  'action.saveDraft': 'ड्राफ़्ट सहेजें',
  'action.submit': 'समीक्षा हेतु भेजें',
  'action.cancel': 'रद्द करें',
  'action.back': 'वापस',
  'action.next': 'आगे बढ़ें',
  'action.retry': 'फिर कोशिश करें',
  'action.signIn': 'साइन इन करें',
  'action.signOut': 'साइन आउट',
  'action.register': 'पंजीकरण करें',
  'action.continue': 'आगे बढ़ें',
  'action.approve': 'स्वीकृत करें',
  'action.reject': 'अस्वीकार करें',
  'action.publish': 'प्रकाशित करें',
  'action.verify': 'सत्यापित करें',
  'action.addPhoto': 'फ़ोटो जोड़ें',
  'action.remove': 'हटाएँ',
  'action.loadMore': 'और दिखाएँ',
  'action.newActivity': 'नई गतिविधि',
  'action.addStudent': 'बच्चा जोड़ें',
  'action.recordConsent': 'सहमति दर्ज करें',
  'action.export': 'CSV डाउनलोड करें',

  'auth.title': 'साइन इन करें',
  'auth.phoneLabel': 'मोबाइल नंबर',
  'auth.phoneHint': 'वही नंबर जो विद्यालय के रिकॉर्ड में है',
  'auth.sendCode': 'कोड भेजें',
  'auth.codeLabel': 'छह अंकों का कोड',
  'auth.codeSent': 'कोड आपके फ़ोन पर भेज दिया गया है।',
  'auth.resendIn': 'दोबारा भेजें',
  'auth.usePassword': 'पासवर्ड से साइन इन करें (अधिकारी)',
  'auth.useOtp': 'मोबाइल कोड से साइन इन करें (शिक्षक)',
  'auth.passwordLabel': 'पासवर्ड',
  'auth.identifierLabel': 'मोबाइल नंबर या ईमेल',
  'auth.noAccount': 'खाता नहीं है?',
  'auth.registerLink': 'नया पंजीकरण करें',
  'auth.pending': 'आपका खाता प्रधानाध्यापक अथवा खंड कार्यालय की स्वीकृति की प्रतीक्षा में है।',

  'register.title': 'शिक्षक पंजीकरण',
  'register.udiseLabel': 'विद्यालय का UDISE कोड',
  'register.udiseHint': 'ग्यारह अंकों का कोड, विद्यालय के बोर्ड पर लिखा होता है',
  'register.findSchool': 'विद्यालय खोजें',
  'register.nameLabel': 'पूरा नाम',
  'register.designationLabel': 'पदनाम',
  'register.employeeCodeLabel': 'कर्मचारी संख्या',
  'register.submitted': 'पंजीकरण भेज दिया गया। स्वीकृति मिलते ही आप साइन इन कर सकेंगे।',

  'activity.title': 'गतिविधि का शीर्षक',
  'activity.titleHint': 'जैसे: कक्षा ५ में पठन कोना बनाया गया',
  'activity.description': 'विवरण',
  'activity.descriptionHint': 'क्या हुआ, किसने भाग लिया, बच्चों ने क्या सीखा',
  'activity.category': 'श्रेणी',
  'activity.date': 'दिनांक',
  'activity.classes': 'कक्षाएँ',
  'activity.participants': 'कुल प्रतिभागी',
  'activity.learningOutcome': 'सीखने का परिणाम',
  'activity.students': 'सम्मानित बच्चे',
  'activity.photos': 'फ़ोटो',
  'activity.visibility': 'किसे दिखाई दे',
  'activity.empty': 'अभी कोई गतिविधि दर्ज नहीं है।',
  'activity.emptyHint': 'अपनी कक्षा का पहला कार्य दर्ज करें।',
  'activity.savedOffline':
    'नेटवर्क नहीं है। यह गतिविधि आपके फ़ोन में सुरक्षित है और नेटवर्क आते ही अपने आप भेज दी जाएगी।',
  'activity.photoHint': 'फ़ोटो इसी फ़ोन में छोटी कर दी जाती हैं, ताकि आपका डेटा कम खर्च हो।',
  'activity.participantsShort': 'बच्चे',

  'status.DRAFT': 'ड्राफ़्ट',
  'status.PENDING_REVIEW': 'समीक्षा में',
  'status.PUBLISHED': 'प्रकाशित',
  'status.REJECTED': 'अस्वीकृत',
  'status.ARCHIVED': 'संग्रहीत',

  'visibility.SCHOOL': 'केवल विद्यालय',
  'visibility.BLOCK': 'खंड स्तर',
  'visibility.DISTRICT': 'जनपद स्तर',
  'visibility.STATE': 'राज्य स्तर',
  'visibility.PUBLIC': 'सार्वजनिक',

  'verification.PENDING': 'सत्यापन शेष',
  'verification.VERIFIED': 'सत्यापित',
  'verification.REJECTED': 'अस्वीकृत',

  'review.title': 'समीक्षा हेतु लंबित',
  'review.empty': 'समीक्षा के लिए कुछ भी लंबित नहीं है।',
  'review.rejectReason': 'अस्वीकार करने का कारण',
  'review.rejectReasonHint': 'शिक्षक को स्पष्ट रूप से बताएँ कि क्या सुधारना है',
  'review.blockers': 'प्रकाशन से पहले यह पूरा करना आवश्यक है',
  'review.confirmMedia': 'इस फ़ोटो के सभी बच्चों की सहमति मौजूद है',

  'report.overview': 'सारांश',
  'report.schools': 'विद्यालय',
  'report.activeSchools': 'सक्रिय विद्यालय',
  'report.teachers': 'शिक्षक',
  'report.students': 'बच्चे',
  'report.activities': 'प्रकाशित गतिविधियाँ',
  'report.achievements': 'सत्यापित उपलब्धियाँ',
  'report.participation': 'सहभागिता',
  'report.dormant': 'जिन विद्यालयों ने कुछ नहीं भेजा',
  'report.dormantHint': 'इन विद्यालयों को सहयोग की आवश्यकता हो सकती है।',
  'report.from': 'से',
  'report.to': 'तक',
  'report.districts': 'जनपद',

  'people.pending': 'स्वीकृति हेतु लंबित',
  'people.noPending': 'कोई पंजीकरण लंबित नहीं है।',
  'people.active': 'सक्रिय शिक्षक',

  'error.generic': 'कुछ गड़बड़ हुई। कृपया फिर कोशिश करें।',
  'error.offline': 'नेटवर्क उपलब्ध नहीं है।',
  'error.notFound': 'यह पृष्ठ उपलब्ध नहीं है।',
  'error.forbidden': 'आपको इसकी अनुमति नहीं है।',
  'error.required': 'यह जानकारी आवश्यक है।',

  'offline.banner': 'नेटवर्क नहीं है — आपका काम फ़ोन में सुरक्षित रहेगा।',
  'offline.queued': 'भेजने के लिए प्रतीक्षारत',
  'offline.syncing': 'भेजा जा रहा है…',

  'showcase.title': 'हमारे विद्यालयों का कार्य',
  'showcase.subtitle': 'उत्तर प्रदेश बेसिक शिक्षा परिषद के विद्यालयों की सत्यापित गतिविधियाँ',
  'showcase.empty': 'अभी कोई सार्वजनिक गतिविधि नहीं है।',

  'account.mustSetPassword':
    'आपका खाता अभी भी उसी पासवर्ड पर है जो बनाते समय दिया गया था। कृपया अपना पासवर्ड बदलें।',
  'claim.title': 'अपने विद्यालय का दावा करें',
  'claim.intro':
    'अपने विद्यालय का ग्यारह अंकों का UDISE कोड डालिए। खंड शिक्षा अधिकारी पुष्टि करेंगे, तभी विद्यालय मंच पर आएगा।',
  'claim.whyClaim':
    'विद्यालय अपने आप नहीं बनता। कोड और आपकी जानकारी खंड कार्यालय जाती है, जहाँ अधिकारी आपको पहचानते हैं।',
  'claim.district': 'जनपद',
  'claim.block': 'विकास खंड',
  'claim.schoolName': 'विद्यालय का नाम',
  'claim.schoolType': 'विद्यालय का प्रकार',
  'claim.village': 'गाँव या वार्ड',
  'claim.yourName': 'आपका नाम',
  'claim.boardPhoto': 'विद्यालय के बोर्ड की फ़ोटो',
  'claim.boardPhotoHint':
    'विद्यालय के बोर्ड की फ़ोटो अपने पास रखिए — उस पर नाम और कोड दोनों लिखे होते हैं। खंड कार्यालय पुष्टि करते समय माँग सकता है।',
  'claim.alreadyOnPlatform':
    'यह विद्यालय मंच पर पहले से है। दावे की आवश्यकता नहीं — शिक्षक के रूप में पंजीकरण कीजिए, प्रधानाध्यापक स्वीकृति देंगे।',
  'claim.submit': 'दावा भेजें',
  'claim.sent': 'दावा खंड कार्यालय को भेज दिया गया।',
  'claim.sentDetail':
    'खंड शिक्षा अधिकारी की पुष्टि के बाद आप उसी मोबाइल नंबर से साइन इन कर सकेंगे।',
  'claim.alreadyClaimed': 'इस विद्यालय पर पहले ही दावा किया जा चुका है',
  'claim.alreadyClaimedBy': 'दावा करने वाले',
  'claim.alreadyClaimedHint':
    'यदि यह आपके ही विद्यालय के सहकर्मी हैं तो उनसे बात कीजिए। पुष्टि के बाद वे आपको शिक्षक के रूप में जोड़ सकते हैं।',
  'claim.expires': 'यह दावा इस तिथि तक वैध है',
  'claim.link': 'विद्यालय अभी मंच पर नहीं है?',
  'claim.phoneHint': 'आपका अपना मोबाइल नंबर — इसी पर कोड आएगा और इसी से आप साइन इन करेंगे',
  'claim.districtNotOpen':
    'इस जनपद में यह मंच अभी शुरू नहीं हुआ है। शुरू होते ही आप अपने विद्यालय का दावा कर सकेंगे।',

  'claims.title': 'विद्यालय दावे',
  'claims.empty': 'कोई दावा लंबित नहीं है।',
  'claims.claimant': 'दावा करने वाले',
  'claims.inRegister': 'यह कोड रजिस्टर में पहले से है',
  'claims.notInRegister': 'यह कोड रजिस्टर में नहीं है — पुष्टि पर नया विद्यालय बनेगा',
  'claims.registeredAs': 'रजिस्टर में दर्ज नाम',
  'claims.verify': 'पुष्टि करें',
  'claims.rejectReason': 'अस्वीकार करने का कारण',
  'claims.verified': 'विद्यालय बन गया और दावा करने वाले प्रधानाध्यापक नियुक्त हो गए।',
  'claims.correctName': 'नाम सुधारें (वैकल्पिक)',

  'clearance.title': 'खंड जाँच',
  'clearance.empty': 'जाँच के लिए कुछ भी लंबित नहीं है।',
  'clearance.why': 'यह यहाँ क्यों है',
  'clearance.reasonFLAGGED': 'संकेत मिले हैं',
  'clearance.reasonSAMPLED': 'नमूना जाँच',
  'clearance.risk': 'जोखिम अंक',
  'clearance.clear': 'स्वीकृत करें',
  'clearance.return': 'विद्यालय को वापस करें',
  'clearance.returnReason': 'क्या सुधारना है',
  'clearance.flaggedOnly': 'केवल संकेत वाले',
  'clearance.cleared': 'स्वीकृत। अब यह अपने स्तर पर दिख रहा है।',
  'clearance.intro':
    'ये वे प्रविष्टियाँ हैं जिन्हें प्रधानाध्यापक ने प्रमाणित करके विद्यालय के बाहर भेजा है। जोखिम के क्रम में लगी हैं।',
  'clearance.sampledHint': 'कोई संकेत नहीं मिला। यह नमूना जाँच के लिए चुनी गई है।',
  'clearance.returnReasonHint': 'शिक्षक को यही पंक्ति दिखेगी, इसलिए बताइए कि क्या सुधारना है।',
  'clearance.returned': 'विद्यालय को वापस भेजा गया।',

  'attest.title': 'प्रधानाध्यापक का प्रमाणन',
  'attest.confirm': 'मैं उपरोक्त कथन की पुष्टि करता/करती हूँ',
  'attest.note': 'खंड अधिकारी के लिए टिप्पणी (वैकल्पिक)',
  'attest.publishSchool': 'विद्यालय के भीतर प्रकाशित करें',
  'attest.publishSchoolHint': 'इसके लिए किसी और की स्वीकृति नहीं चाहिए।',
  'attest.sendOn': 'प्रमाणित करके आगे भेजें',
  'attest.by': 'प्रमाणित किया',
  'attest.awaitingBlock': 'खंड जाँच की प्रतीक्षा — तब तक केवल विद्यालय में दिख रहा है',
  'attest.sendOnHint':
    'यह खंड कार्यालय के पास जाएगा। जब तक वे स्वीकृत नहीं करते, यह केवल विद्यालय में दिखेगा।',
  'promote.title': 'ऊपर के स्तर पर दिखाएँ',
  'promote.hint': 'यह कार्य जाँच से स्वीकृत हो चुका है। आप इसे और ऊपर के स्तर पर दिखा सकते हैं।',
  'promote.action': 'स्तर बढ़ाएँ',
  'claims.correctNameHint': 'रजिस्टर में यही नाम दर्ज होगा। खाली छोड़ने पर दावे वाला नाम रहेगा।',

  'clear.NOT_REQUIRED': 'विद्यालय तक ही',
  'clear.AWAITING_ATTESTATION': 'प्रमाणन शेष',
  'clear.AWAITING_BLOCK': 'खंड जाँच लंबित',
  'clear.AUTO_CLEARED': 'स्वतः स्वीकृत',
  'clear.CLEARED': 'खंड से स्वीकृत',
  'clear.RETURNED': 'खंड से वापस',

  'tier.NEW': 'नया विद्यालय',
  'tier.STANDARD': 'सामान्य',
  'tier.TRUSTED': 'भरोसेमंद रिकॉर्ड',
  'tier.WATCH': 'निगरानी में',
  'trust.title': 'विद्यालय का रिकॉर्ड',
  'trust.cleared': 'स्वीकृत',
  'trust.returned': 'वापस हुए',
  'trust.sample': 'कितना काम जाँचा जाता है',
  'update.available': 'नया संस्करण उपलब्ध है।',
  'update.reload': 'अभी अपडेट करें',

  // The promises, in the order a sceptical teacher asks about them. Keyed by
  // the guarantee ids in packages/shared/src/guarantees.ts; a test asserts
  // that the two never drift apart.
  'promise.title': 'हमारे वचन',
  'promise.headline':
    'यह मंच व्यवस्था को नापता है, व्यक्ति को नहीं। यह दिखा सकता है कि किस विद्यालय में पानी नहीं है और किस विकास खंड में अनुदान अटका है। यह किसी को शिक्षकों की वरीयता सूची नहीं दिखा सकता।',
  'promise.intro':
    'हर वचन के साथ यह भी लिखा है कि वह क्यों है। ये वचन केवल लिखे नहीं गए हैं — इन्हें तोड़ने वाला कोई भी बदलाव इसी मंच की जाँच में पकड़ा जाता है।',
  'promise.enforced': 'यह वचन कोड में जाँचा जाता है',
  'promise.neverBuilt': 'जो कभी नहीं बनाया जाएगा',
  'promise.neverBuiltIntro':
    'ऐसी सुविधाएँ जिनकी माँग समय-समय पर उठती रहेगी, और जिन्हें बनाने से हम मना करते हैं। साथ में वह वाक्य भी है जिसके रूप में यह माँग आमतौर पर आती है।',
  'promise.arrivesAs': 'माँग इस रूप में आती है',
  'promise.changing':
    'इनमें से किसी वचन को बदलना एक बातचीत है, कोई तकनीकी बदलाव नहीं। यदि आपको लगता है कि कोई वचन तोड़ा गया है, तो शिकायत अधिकारी को लिखिए।',

  'promise.noAttendanceOrLocationTracking': 'यह मंच कभी नहीं देखता कि आप कहाँ हैं या कब पहुँचे।',
  'promise.noAttendanceOrLocationTracking.why':
    'न लोकेशन, न सेल्फ़ी, न हाज़िरी, न \u2018आख़िरी बार कब खोला\u2019। यहाँ यह दर्ज होता है कि विद्यालय ने क्या किया — यह नहीं कि आप कहाँ थे।',
  'promise.noTeacherRanking': 'किसी शिक्षक की तुलना किसी दूसरे शिक्षक से कभी नहीं की जाती।',
  'promise.noTeacherRanking.why':
    'इस मंच पर शिक्षकों की कोई वरीयता सूची नहीं है — न किसी अधिकारी के लिए, न किसी स्तर पर।',
  'promise.noIndividualTeacherMetricsAboveSchool':
    'विद्यालय के बाहर किसी को आपके नाम के साथ कोई संख्या नहीं दिखती।',
  'promise.noIndividualTeacherMetricsAboveSchool.why':
    'अधिकारी यह देखते हैं कि विद्यालय ने क्या किया। उसमें किसका कितना योगदान रहा, यह विद्यालय से बाहर नहीं जाता।',
  'promise.blockedIsAFirstClassAnswer':
    'आप किसी आदेश का उत्तर यह भी दे सकते हैं कि \u2018नहीं हो पाया, और कारण यह है\u2019।',
  'promise.blockedIsAFirstClassAnswer.why':
    'जो धनराशि नहीं आई और जो सामग्री नहीं पहुँची, वह उसी रूप में दर्ज होती है — और उसी के नाम, जिसकी ज़िम्मेदारी थी।',
  'promise.constraintsTravelWithAchievements':
    'विद्यालय ने क्या किया, यह हमेशा इसके साथ दिखता है कि विद्यालय में क्या नहीं था।',
  'promise.constraintsTravelWithAchievements.why':
    'रिक्त पद और बंद हैंडपंप बताए बिना कोई परिणाम पढ़ना विद्यालय का विवरण नहीं, शिक्षक पर निर्णय है।',
  'promise.everyEscalationHasAClock':
    'आप जो बात उठाते हैं, उस पर घड़ी उस कार्यालय की चलती है जिसे उत्तर देना है।',
  'promise.everyEscalationHasAClock.why':
    'हर माँग और हर शिकायत के साथ उसकी आयु खुले में दिखती है, और वह आयु अधिकारी को बतानी होती है।',
  'promise.teacherOwnsTheirRecord': 'आपका रिकॉर्ड आपका है। साथ ले जाइए, या हटा दीजिए।',
  'promise.teacherOwnsTheirRecord.why':
    'जो कुछ आपने किया, उसे कभी भी बिना किसी से पूछे निर्यात कीजिए। मंच छोड़िए तो आपका व्यक्तिगत विवरण आपके साथ जाता है।',
  'promise.recognitionIsNamedAndHuman':
    'सराहना उस व्यक्ति की ओर से आती है जिसने उस पर अपना नाम लिखा है, मशीन से नहीं।',
  'promise.recognitionIsNamedAndHuman.why':
    'न स्वतः मिलने वाले बैज, न अंक। किसी अधिकारी ने लिखा है और उस पर उनका नाम है।',
  'promise.noChildPersonalData': 'किसी बच्चे का नाम, फ़ोटो या विवरण यहाँ रखा ही नहीं जाता।',
  'promise.noChildPersonalData.why':
    'सहमति के साथ भी नहीं। यह मंच बच्चों की गिनती रखता है, किसी एक बच्चे को जानता नहीं।',
  'promise.noAdvertisingNoDataSale':
    'कोई विज्ञापन नहीं, और यहाँ की कोई जानकारी कभी किसी को बेची नहीं जाती।',
  'promise.noAdvertisingNoDataSale.why':
    'न ट्रैकर, न किसी बाहरी कंपनी का विश्लेषण, न किसी क़ीमत पर डेटा का लेन-देन।',
  'promise.freeForTeachersAndFamilies':
    'आपके लिए, आपके विद्यालय के लिए और हर परिवार के लिए निःशुल्क। हमेशा।',
  'promise.freeForTeachersAndFamilies.why':
    'इस मंच पर किसी शिक्षक, विद्यालय, अभिभावक या गाँव से कभी कोई शुल्क नहीं लिया जाता।',

  // Who is holding this. The one screen whose whole purpose is to tell a
  // teacher that somebody else owes them something.
  'nav.waiting': 'लंबित',
  'waiting.title': 'किसके पास है',
  'waiting.intro':
    'आपका जो काम आगे नहीं बढ़ा, वह किस कार्यालय के पास है और कितने दिनों से। यह घड़ी उस कार्यालय की है जिसे उत्तर देना है — आपकी नहीं।',
  'waiting.owedByYou': 'आपके कार्यालय के पास',
  'waiting.nothing': 'कुछ भी लंबित नहीं है।',
  'waiting.days': 'दिन से',
  'waiting.overdue': 'सामान्य से अधिक समय',
  'waiting.oldest': 'सबसे पुराना',
  'waiting.stage.HEAD_TEACHER': 'प्रधानाध्यापक',
  'waiting.stage.BLOCK_OFFICE': 'खंड कार्यालय',
  'waiting.stage.DISTRICT_OFFICE': 'जनपद कार्यालय',
  'waiting.kind.ACTIVITY': 'गतिविधि',
  'waiting.kind.SCHOOL_CLAIM': 'विद्यालय का दावा',
  'waiting.kind.SMC_REQUEST': 'प्रबंध समिति की माँग',
  'waiting.answer': 'उत्तर दीजिए',
  'waiting.answerLabel': 'खंड कार्यालय का उत्तर',
  'waiting.answerHint': 'समिति को यह उत्तर आपके नाम के साथ दिखेगा।',
  'waiting.answered': 'उत्तर दर्ज हो गया।',
  'waiting.noPenalty':
    'देर होना केवल देर होना है। यहाँ से न कोई सूचना जाती है, न कोई कार्रवाई होती है, न यह किसी रिपोर्ट में गिना जाता है।',

  'village.register': 'विद्यालय का रजिस्टर',
  'village.childrenOnRegister': 'रजिस्टर पर दर्ज बच्चे',
  'village.officialRecord': 'विभाग का आधिकारिक अभिलेख:',

  // The duty ledger. The union's own first demand, and the one feature that
  // returns something to the person filling it in.
  'nav.duty': 'ड्यूटी',
  'duty.title': 'शिक्षण के अलावा लगी ड्यूटी',
  'duty.intro':
    'जो दिन विद्यालय के काम में नहीं, शासन के दूसरे कामों में गए। यह गिनती UDISE+ में पहले से माँगी जाती है (प्रपत्र 3.3.25) — पर साल में एक बार, और कहीं दिखती नहीं। यहाँ वही संख्या समय पर और आपके अपने रिकॉर्ड में रहती है।',
  'duty.voluntary':
    'यह भरना अनिवार्य नहीं है। न कोई याद दिलाएगा, न न भरने पर कुछ होगा। विद्यालय के बाहर किसी अधिकारी को आपका नाम नहीं दिखता — केवल विद्यालय का जोड़।',
  'duty.add': 'ड्यूटी दर्ज कीजिए',
  'duty.category': 'किस प्रकार की ड्यूटी',
  'duty.description': 'ड्यूटी का विवरण',
  'duty.descriptionHint': 'जैसे: SIR बूथ लेवल ऑफिसर, बूथ 142',
  'duty.orderReference': 'आदेश संख्या',
  'duty.orderReferenceHint':
    'यदि आदेश आपके पास है। जिस अधिकारी ने आदेश दिया, उनका नाम यह मंच कहीं दर्ज नहीं करता।',
  'duty.fromDate': 'कब से',
  'duty.toDate': 'कब तक',
  'duty.daysLost': 'कितने शिक्षण दिवस गए',
  'duty.daysLostHint': 'केवल वे दिन जब विद्यालय खुला था। रविवार और अवकाश नहीं गिनने हैं।',
  'duty.duringSchoolHours': 'क्या यह विद्यालय के समय में हुई',
  'duty.duringSchoolHoursHint':
    'उच्च न्यायालय की खंडपीठ के अनुसार निर्णायक तथ्य यही है — शिक्षण दिवस और शिक्षण समय।',
  'duty.honorariumDue': 'देय मानदेय (₹)',
  'duty.honorariumReceived': 'प्राप्त मानदेय (₹)',
  'duty.honorariumHint': 'जो मिलना था और जो मिला — दोनों का अंतर ही असल बात है।',
  'duty.section27': 'अधिनियम की धारा 27 में उल्लिखित',
  'duty.notSection27': 'धारा 27 में उल्लिखित नहीं',
  'duty.section27Note':
    'शिक्षा का अधिकार अधिनियम की धारा 27 तीन कामों की अनुमति देती है — जनगणना, आपदा राहत और चुनाव। यह वर्गीकरण क़ानून का कथन है, किसी पर आरोप नहीं।',
  'duty.attest': 'पुष्टि कीजिए',
  'duty.attested': 'पुष्टि हो गई',
  'duty.attestedBy': 'पुष्टि करने वाले',
  'duty.daysTotal': 'कुल शिक्षण दिवस',
  'duty.daysSection27': 'धारा 27 वाले दिन',
  'duty.daysOther': 'शेष दिन',
  'duty.daysInSchoolHours': 'विद्यालय समय में',
  'duty.outstanding': 'बकाया मानदेय',
  'duty.empty': 'अभी कोई ड्यूटी दर्ज नहीं है।',
  'duty.saved': 'दर्ज हो गया।',
  'duty.cat.CENSUS': 'जनगणना',
  'duty.cat.ELECTION': 'चुनाव / मतदाता सूची',
  'duty.cat.DISASTER_RELIEF': 'आपदा राहत',
  'duty.cat.SURVEY': 'सर्वेक्षण',
  'duty.cat.DATA_ENTRY': 'डेटा प्रविष्टि / पोर्टल',
  'duty.cat.TRAINING': 'प्रशिक्षण',
  'duty.cat.MEETING': 'बैठक',
  'duty.cat.PROVISIONING': 'सामग्री / भोजन व्यवस्था',
  'duty.cat.OTHER': 'अन्य',

  // The register of orders. Two jobs on one screen: what applies to this
  // school, and whether the letter in the WhatsApp group is real.
  'nav.orders': 'आदेश',
  'order.title': 'आदेश',
  'order.intro':
    'इस विद्यालय पर इस समय कौन से आदेश लागू हैं। जो आदेश किसी नए आदेश से बदल चुका है, वह यहाँ नहीं दिखता।',
  'order.checkTitle': 'क्या यह आदेश असली है?',
  'order.checkIntro':
    'व्हाट्सएप पर आए किसी पत्र का पत्रांक यहाँ डालिए। बीएसए के हस्ताक्षर वाले फ़र्ज़ी आदेश भी इसी रास्ते से आते हैं।',
  'order.checkLabel': 'पत्रांक',
  'order.check': 'देखिए',
  'order.checkFound': 'यह आदेश रजिस्टर में दर्ज है।',
  'order.checkNotFound':
    'यह पत्रांक इस रजिस्टर में नहीं है। इसका अर्थ यह नहीं कि आदेश ग़लत है — इस रजिस्टर में केवल वही आदेश हैं जो यहाँ प्रकाशित किए गए हैं। संदेह हो तो खंड कार्यालय से पुष्टि कर लीजिए।',
  'order.checkSuperseded': 'ध्यान दीजिए — यह आदेश बाद के किसी आदेश से बदल चुका है।',
  'order.plainSummary': 'विद्यालय को क्या करना है',
  'order.letterNumber': 'पत्रांक',
  'order.issuedBy': 'निर्गत कार्यालय',
  'order.dueBy': 'अंतिम तिथि',
  'order.document': 'मूल आदेश देखिए',
  'order.empty': 'इस समय कोई आदेश लंबित नहीं है।',
  'order.respond': 'उत्तर दीजिए',
  'order.myAnswer': 'आपका उत्तर',
  'order.answeredBy': 'उत्तर देने वाले',
  'order.whatIsMissing': 'क्या नहीं मिला',
  'order.noteOptional': 'कुछ और कहना हो तो (वैकल्पिक)',
  'order.blockedHelp':
    'यह बताना कि क्या नहीं मिला, कोई सफ़ाई नहीं है। यह उस कार्यालय के नाम दर्ज होता है जिसे वह चीज़ भेजनी थी।',
  'order.src.COURT_DIRECTION': 'न्यायालय का निर्देश',
  'order.src.STATE_ORDER': 'शासनादेश',
  'order.src.DISTRICT_ORDER': 'जनपद स्तरीय आदेश',
  'order.src.BLOCK_INSTRUCTION': 'खंड स्तरीय निर्देश',
  'order.state.SEEN': 'देख लिया',
  'order.state.IN_PROGRESS': 'चल रहा है',
  'order.state.DONE': 'हो गया',
  'order.state.BLOCKED': 'नहीं हो पाया',
  'order.state.NOT_APPLICABLE': 'हमारे विद्यालय पर लागू नहीं',
  'order.blocked.FUNDS_NOT_RECEIVED': 'धनराशि नहीं मिली',
  'order.blocked.MATERIAL_NOT_RECEIVED': 'सामग्री नहीं मिली',
  'order.blocked.STAFF_SHORTAGE': 'शिक्षक/कर्मचारी नहीं हैं',
  'order.blocked.BUILDING_OR_FACILITY_UNUSABLE': 'भवन या सुविधा उपयोग योग्य नहीं',
  'order.blocked.NO_INSTRUCTION_RECEIVED': 'कोई निर्देश ही नहीं मिला',
  'order.blocked.CONFLICTS_WITH_ANOTHER_ORDER': 'किसी दूसरे आदेश से टकराव है',
  'order.blocked.OTHER': 'अन्य कारण',

  loading: 'लोड हो रहा है…',
} as const;

export type TranslationKey = keyof typeof hi;
