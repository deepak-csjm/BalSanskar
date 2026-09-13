/**
 * Every string the interface shows, in Hindi and English.
 *
 * Hindi is the source language, not a translation: these schools work in Hindi,
 * their registers are in Hindi, and a platform that reads as an English tool
 * with a Hindi option will be used by the block office and ignored by the
 * teachers it is for. English is kept because departmental correspondence and
 * inter-state reporting need it.
 *
 * Held as one typed record rather than loaded from JSON so that a missing key
 * is a compile error rather than a `undefined` on a teacher's screen.
 */

export const strings = {
  hi: {
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

    loading: 'लोड हो रहा है…',
  },

  en: {
    'app.name': 'BalSanskar',
    'app.tagline': 'A shared platform for UP Basic Shiksha Parishad schools',

    'nav.home': 'Home',
    'nav.activities': 'Activities',
    'nav.enrolment': 'Register',

    'class.BALVATIKA': 'Balvatika',
    'class.1': 'Class 1',
    'class.2': 'Class 2',
    'class.3': 'Class 3',
    'class.4': 'Class 4',
    'class.5': 'Class 5',
    'class.6': 'Class 6',
    'class.7': 'Class 7',
    'class.8': 'Class 8',

    'enrolment.title': "The school's register",
    'enrolment.intro': 'How many children in each class. Numbers only, no names.',
    'enrolment.hint':
      'Leave a class blank if your school does not run it. This is filled in once a term.',
    'enrolment.total': 'Children in all',
    'enrolment.asOn': 'Register dated',
    'enrolment.asOnLabel': 'The date of the register these numbers came from',
    'enrolment.asOnHint': 'So an officer asking about a discrepancy knows which register to check.',
    'enrolment.updatedBy': 'Recorded by',
    'enrolment.saved': 'Register saved.',
    'enrolment.privacy':
      "This platform holds no child's name, photograph or guardian details — only counts by class.",

    'village.notFound': 'No such school, or the block office has not confirmed it yet.',
    'village.children': 'Children at the school',
    'village.privacy':
      "This platform holds no child's name, photograph or guardian details — only counts by class.",
    'village.needs': 'What the school needs',
    'village.needsHint': 'Anybody in the village can help with any of these.',
    'village.needsEmpty': 'Nothing has been asked for yet.',
    'village.promised': 'Somebody has offered',
    'village.quantity': 'How many',
    'village.howToHelp':
      'Speak to the head teacher at the school. No money is collected or paid through this platform.',
    'village.thanks': 'Made possible by',
    'village.work': "The school's work",
    'village.workHint': 'Only work the block education officer has checked and cleared.',
    'village.smc': 'School Management Committee',
    'village.smcHeldOn': 'Met on',
    'village.present': 'members present',
    'village.parents': 'parents',
    'village.women': 'women',
    'village.raised': 'Asked of the block office',
    'village.outOfSchool': 'Children not in school',
    'village.found': 'Found by the survey',
    'village.broughtBack': 'Back in school',
    'village.stillOut': 'Still out',
    'village.stillOutHint': 'Reaching these children needs the village. Speak to the head teacher.',
    'village.allBack': 'Every child the survey found is now back in school.',
    'village.surveyPrivacy':
      'Counts only. Nothing about any child or household is held on this platform.',
    'village.somethingWrong': 'Something not right?',
    'village.grievance':
      'Raise it at the School Management Committee meeting, or tell the block education office.',

    'needs.title': 'What the school needs',
    'needs.intro': 'What you need from the village. This shows on the school’s wall page.',
    'needs.add': 'Add something',
    'needs.markMet': 'Mark it met',
    'needs.helper': 'How the helper wishes to be named',
    'needs.empty': 'Nothing asked for yet.',
    'survey.title': 'Children not in school',
    'survey.intro': 'Which hamlet was walked and what was found. Counts only, no names.',
    'survey.habitation': 'Hamlet or settlement',
    'survey.households': 'Households visited',
    'survey.found': 'Children found out of school',
    'survey.enrolled': 'Children back in school',
    'survey.by': 'Who walked it',
    'smc.title': 'Committee meeting',
    'smc.decisions': 'What was decided',

    'scheme.label': 'Which programme does this work count towards',
    'scheme.hint':
      "Pick up to three. This is what makes the block office's monthly scheme-wise report assemble itself.",
    'media.noChildLabel': "No child's face is identifiable in this photograph",
    'media.noChildHint':
      'Photograph the work rather than the children — the reading corner, the garden, the model, the wall chart.',
    'media.noChildConfirm': 'Confirmed — no child is identifiable in this one',
    'nav.review': 'Review',
    'nav.reports': 'Reports',
    'nav.people': 'Teachers',
    'nav.clearance': 'Clearance',
    'nav.claims': 'Claims',
    'nav.showcase': 'Showcase',

    'action.save': 'Save',
    'action.saveDraft': 'Save draft',
    'action.submit': 'Send for review',
    'action.cancel': 'Cancel',
    'action.back': 'Back',
    'action.next': 'Continue',
    'action.retry': 'Try again',
    'action.signIn': 'Sign in',
    'action.signOut': 'Sign out',
    'action.register': 'Register',
    'action.continue': 'Continue',
    'action.approve': 'Approve',
    'action.reject': 'Reject',
    'action.publish': 'Publish',
    'action.verify': 'Verify',
    'action.addPhoto': 'Add photo',
    'action.remove': 'Remove',
    'action.loadMore': 'Show more',
    'action.newActivity': 'New activity',
    'action.addStudent': 'Add child',
    'action.recordConsent': 'Record consent',
    'action.export': 'Download CSV',

    'auth.title': 'Sign in',
    'auth.phoneLabel': 'Mobile number',
    'auth.phoneHint': 'The number the school has on record',
    'auth.sendCode': 'Send code',
    'auth.codeLabel': 'Six-digit code',
    'auth.codeSent': 'A code has been sent to your phone.',
    'auth.resendIn': 'Send again',
    'auth.usePassword': 'Sign in with a password (officers)',
    'auth.useOtp': 'Sign in with a mobile code (teachers)',
    'auth.passwordLabel': 'Password',
    'auth.identifierLabel': 'Mobile number or email',
    'auth.noAccount': 'No account yet?',
    'auth.registerLink': 'Register as a teacher',
    'auth.pending': 'Your account is waiting for approval by your head teacher or block office.',

    'register.title': 'Teacher registration',
    'register.udiseLabel': 'School UDISE code',
    'register.udiseHint': 'Eleven digits, written on the school board',
    'register.findSchool': 'Find school',
    'register.nameLabel': 'Full name',
    'register.designationLabel': 'Designation',
    'register.employeeCodeLabel': 'Employee number',
    'register.submitted': 'Registration sent. You can sign in once it is approved.',

    'activity.title': 'Activity title',
    'activity.titleHint': 'For example: Reading corner set up in class 5',
    'activity.description': 'What happened',
    'activity.descriptionHint': 'What took place, who joined in, what the children learned',
    'activity.category': 'Category',
    'activity.date': 'Date',
    'activity.classes': 'Classes',
    'activity.participants': 'Number taking part',
    'activity.learningOutcome': 'Learning outcome',
    'activity.students': 'Children being recognised',
    'activity.photos': 'Photographs',
    'activity.visibility': 'Who can see this',
    'activity.empty': 'No activities recorded yet.',
    'activity.emptyHint': 'Record the first piece of work from your class.',
    'activity.savedOffline':
      'No network. This activity is saved on your phone and will be sent automatically when the signal returns.',
    'activity.photoHint':
      'Photographs are shrunk on this phone before they are sent, to save your data.',
    'activity.participantsShort': 'children',

    'status.DRAFT': 'Draft',
    'status.PENDING_REVIEW': 'In review',
    'status.PUBLISHED': 'Published',
    'status.REJECTED': 'Rejected',
    'status.ARCHIVED': 'Archived',

    'visibility.SCHOOL': 'School only',
    'visibility.BLOCK': 'Block',
    'visibility.DISTRICT': 'District',
    'visibility.STATE': 'State',
    'visibility.PUBLIC': 'Public',

    'verification.PENDING': 'Awaiting verification',
    'verification.VERIFIED': 'Verified',
    'verification.REJECTED': 'Rejected',

    'review.title': 'Waiting for review',
    'review.empty': 'Nothing is waiting for review.',
    'review.rejectReason': 'Reason for rejecting',
    'review.rejectReasonHint': 'Tell the teacher clearly what to correct',
    'review.blockers': 'These must be resolved before publishing',
    'review.confirmMedia': 'Every child in this photograph is covered by a consent slip',

    'report.overview': 'Overview',
    'report.schools': 'Schools',
    'report.activeSchools': 'Active schools',
    'report.teachers': 'Teachers',
    'report.students': 'Children',
    'report.activities': 'Published activities',
    'report.achievements': 'Verified achievements',
    'report.participation': 'Participation',
    'report.dormant': 'Schools that have sent nothing',
    'report.dormantHint': 'These schools may need support.',
    'report.from': 'From',
    'report.to': 'To',
    'report.districts': 'Districts',

    'people.pending': 'Waiting for approval',
    'people.noPending': 'No registrations are waiting.',
    'people.active': 'Active teachers',

    'error.generic': 'Something went wrong. Please try again.',
    'error.offline': 'No network available.',
    'error.notFound': 'This page is not available.',
    'error.forbidden': 'You do not have access to this.',
    'error.required': 'This is required.',

    'offline.banner': 'No network — your work is saved on this phone.',
    'offline.queued': 'Waiting to send',
    'offline.syncing': 'Sending…',

    'showcase.title': 'The work of our schools',
    'showcase.subtitle': 'Verified activities from UP Basic Shiksha Parishad schools',
    'showcase.empty': 'No public activities yet.',

    'account.mustSetPassword':
      'Your account still uses the password it was created with. Please set your own before using the platform further.',
    'claim.title': 'Claim your school',
    'claim.intro':
      "Enter your school's eleven-digit UDISE code. The block education officer confirms it, and only then does the school appear on the platform.",
    'claim.whyClaim':
      'A school is not created automatically. The code and your details go to the block office, where the officer knows you.',
    'claim.district': 'District',
    'claim.block': 'Block',
    'claim.schoolName': 'School name',
    'claim.schoolType': 'Type of school',
    'claim.village': 'Village or ward',
    'claim.yourName': 'Your name',
    'claim.boardPhoto': 'Photograph of the school board',
    'claim.boardPhotoHint':
      'Keep a photograph of the school board to hand — it carries both the name and the code. The block office may ask for it while confirming.',
    'claim.alreadyOnPlatform':
      'This school is already on the platform. No claim is needed — register as a teacher and the head teacher will approve you.',
    'claim.submit': 'Send the claim',
    'claim.sent': 'Your claim has gone to the block office.',
    'claim.sentDetail':
      'Once the block education officer confirms it, you can sign in with the same mobile number.',
    'claim.alreadyClaimed': 'This school has already been claimed',
    'claim.alreadyClaimedBy': 'Claimed by',
    'claim.alreadyClaimedHint':
      'If that is a colleague at your school, speak to them. Once it is confirmed they can add you as a teacher.',
    'claim.expires': 'This claim is valid until',
    'claim.link': 'School not on the platform yet?',
    'claim.phoneHint':
      'Your own mobile number — the code comes to it, and you will sign in with it',
    'claim.districtNotOpen':
      'The platform has not opened in this district yet. You will be able to claim your school as soon as it does.',

    'claims.title': 'School claims',
    'claims.empty': 'No claims waiting.',
    'claims.claimant': 'Claimed by',
    'claims.inRegister': 'This code is already in the register',
    'claims.notInRegister': 'This code is not in the register — verifying will create the school',
    'claims.registeredAs': 'Name in the register',
    'claims.verify': 'Verify',
    'claims.rejectReason': 'Reason for rejecting',
    'claims.verified': 'The school now exists and the claimant is its head teacher.',
    'claims.correctName': 'Correct the name (optional)',

    'clearance.title': 'Block clearance',
    'clearance.empty': 'Nothing is waiting for clearance.',
    'clearance.why': 'Why this is here',
    'clearance.reasonFLAGGED': 'Flagged',
    'clearance.reasonSAMPLED': 'Sampled',
    'clearance.risk': 'Risk',
    'clearance.clear': 'Clear it',
    'clearance.return': 'Send back to the school',
    'clearance.returnReason': 'What needs correcting',
    'clearance.flaggedOnly': 'Flagged only',
    'clearance.cleared': 'Cleared. It is now visible at its level.',
    'clearance.intro':
      'Work a head teacher has attested and sent beyond their school. Ordered by risk, not by date.',
    'clearance.sampledHint': 'Nothing was flagged. This one was drawn as a sample.',
    'clearance.returnReasonHint': 'The teacher sees this line, so say what needs correcting.',
    'clearance.returned': 'Sent back to the school.',

    'attest.title': "The head teacher's attestation",
    'attest.confirm': 'I confirm the statement above',
    'attest.note': 'Note for the block officer (optional)',
    'attest.publishSchool': 'Publish within the school',
    'attest.publishSchoolHint': "Nobody else's approval is needed for this.",
    'attest.sendOn': 'Attest and send on',
    'attest.by': 'Attested by',
    'attest.awaitingBlock': 'Awaiting block clearance — visible only inside the school until then',
    'attest.sendOnHint':
      'This goes to the block office. Until they clear it, it stays visible only inside the school.',
    'promote.title': 'Show it at a higher level',
    'promote.hint': 'This work has already been cleared. You can raise how far it reaches.',
    'promote.action': 'Raise the level',
    'claims.correctNameHint':
      'This is the name that goes into the register. Leave it blank to keep the claimed name.',

    'clear.NOT_REQUIRED': 'Stays in school',
    'clear.AWAITING_ATTESTATION': 'Awaiting attestation',
    'clear.AWAITING_BLOCK': 'Awaiting block clearance',
    'clear.AUTO_CLEARED': 'Auto-cleared',
    'clear.CLEARED': 'Cleared by the block',
    'clear.RETURNED': 'Returned by the block',

    'tier.NEW': 'New school',
    'tier.STANDARD': 'Standard',
    'tier.TRUSTED': 'Clean record',
    'tier.WATCH': 'Under watch',
    'trust.title': "The school's record",
    'trust.cleared': 'Cleared',
    'trust.returned': 'Sent back',
    'trust.sample': 'Share of work reviewed',
    'update.available': 'A new version is available.',
    'update.reload': 'Update now',

    'promise.title': 'Our promises',
    'promise.headline':
      'This platform measures systems, never people. It can show you the school that has no water and the block where grants stall. It cannot show anyone a list of teachers ranked by anything.',
    'promise.intro':
      'Each promise carries the reason it exists. They are not only written down — any change that breaks one of them fails this platform\u2019s own tests.',
    'promise.enforced': 'Enforced by a test, not by good intentions',
    'promise.neverBuilt': 'What will never be built',
    'promise.neverBuiltIntro':
      'Features that will be asked for sooner or later, and that we refuse. Each one is listed with the sentence it usually arrives as.',
    'promise.arrivesAs': 'Usually asked for as',
    'promise.changing':
      'Changing any of these is a conversation, not a technical decision. If you believe a promise has been broken, write to the grievance officer.',

    'promise.noAttendanceOrLocationTracking':
      'This platform never records where you are or when you arrived.',
    'promise.noAttendanceOrLocationTracking.why':
      'No location, no selfie, no check-in and no \u2018last seen\u2019. It records what the school did, not where you were.',
    'promise.noTeacherRanking': 'No one is ever ranked against another teacher.',
    'promise.noTeacherRanking.why':
      'There is no league table of teachers in this platform, for anybody, at any level.',
    'promise.noIndividualTeacherMetricsAboveSchool':
      'Nobody outside your school ever sees a number attached to your name.',
    'promise.noIndividualTeacherMetricsAboveSchool.why':
      'Officers see what the school did. How that divides between the people in it does not leave the school.',
    'promise.blockedIsAFirstClassAnswer':
      'You can answer an instruction with \u2018we could not, and here is why\u2019.',
    'promise.blockedIsAFirstClassAnswer.why':
      'Money that did not arrive and material that was never delivered are recorded as what they are, against whoever owed them.',
    'promise.constraintsTravelWithAchievements':
      'What your school is missing is shown beside what your school achieved.',
    'promise.constraintsTravelWithAchievements.why':
      'A result read without the vacant posts and the broken hand pump is a judgement of you rather than a description of the school.',
    'promise.everyEscalationHasAClock':
      'When you raise something, the clock runs on the office that owes you an answer.',
    'promise.everyEscalationHasAClock.why':
      'Every escalation carries its age in the open, and the age is the officer\u2019s to explain.',
    'promise.teacherOwnsTheirRecord': 'Your record is yours. Take it with you, or take it away.',
    'promise.teacherOwnsTheirRecord.why':
      'Export everything you have done, whenever you want, without asking. Leave, and your personal details go with you.',
    'promise.recognitionIsNamedAndHuman':
      'Appreciation comes from a person who signed it, never from a machine.',
    'promise.recognitionIsNamedAndHuman.why':
      'No automatic badges and no scores. An officer wrote it and their name is on it.',
    'promise.noChildPersonalData':
      'No child\u2019s name, photograph or details are held here at all.',
    'promise.noChildPersonalData.why':
      'Not with consent either. The platform counts children; it does not know a single one of them.',
    'promise.noAdvertisingNoDataSale': 'No advertising, and nothing here is ever sold to anyone.',
    'promise.noAdvertisingNoDataSale.why':
      'No trackers, no third-party analytics, no data brokerage, at any price.',
    'promise.freeForTeachersAndFamilies':
      'Free for you, for your school, and for every family. Always.',
    'promise.freeForTeachersAndFamilies.why':
      'Nothing on this platform is ever charged to a teacher, a school, a parent or a village.',

    loading: 'Loading…',
  },
} as const;

export type TranslationKey = keyof (typeof strings)['hi'];

/**
 * A compile-time guarantee that the two languages carry the same keys. If a key
 * is added to Hindi and forgotten in English, this line stops the build.
 */
const _sameKeys: Record<TranslationKey, string> = strings.en;
void _sameKeys;
