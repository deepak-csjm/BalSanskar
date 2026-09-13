import type { TranslationKey } from './hi.js';

/**
 * Every string the interface shows, in English.
 *
 * Kept because departmental correspondence and inter-state reporting need it,
 * and loaded only when somebody switches to it: at roughly 7 KB gzipped it is
 * dead weight in the first load for a Hindi-speaking teacher on 2G.
 *
 * Typed as a complete record of the Hindi table's keys, so a string added to
 * Hindi and forgotten here is a compile error rather than an `undefined` on
 * somebody's screen. `import type` is erased at build time, so this annotation
 * costs the bundle nothing and does not drag the Hindi table into this chunk.
 */
export const en: Record<TranslationKey, string> = {
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
  'claim.phoneHint': 'Your own mobile number — the code comes to it, and you will sign in with it',
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

  'nav.waiting': 'Waiting',
  'waiting.title': 'Who is holding this',
  'waiting.intro':
    'Work of yours that has not moved, which office is holding it, and for how long. The clock belongs to whoever owes the answer — not to you.',
  'waiting.owedByYou': 'Waiting on your office',
  'waiting.nothing': 'Nothing is waiting.',
  'waiting.days': 'days',
  'waiting.overdue': 'Longer than usual',
  'waiting.oldest': 'Oldest',
  'waiting.stage.HEAD_TEACHER': 'Head teacher',
  'waiting.stage.BLOCK_OFFICE': 'Block office',
  'waiting.stage.DISTRICT_OFFICE': 'District office',
  'waiting.kind.ACTIVITY': 'Activity',
  'waiting.kind.SCHOOL_CLAIM': 'School claim',
  'waiting.kind.SMC_REQUEST': 'Committee request',
  'waiting.answer': 'Answer',
  'waiting.answerLabel': 'The block office\u2019s answer',
  'waiting.answerHint': 'The committee will see this answer with your name on it.',
  'waiting.answered': 'Answer recorded.',
  'waiting.noPenalty':
    'Late is only late. Nothing here sends a notice, triggers an action, or counts towards any report.',

  'village.register': 'The school register',
  'village.childrenOnRegister': 'Children on the register',
  'village.officialRecord': 'The department\u2019s own record:',

  'nav.duty': 'Duty',
  'duty.title': 'Duty other than teaching',
  'duty.intro':
    'Days that went to the state\u2019s other work rather than to this school. UDISE+ already asks for this count (form field 3.3.25) \u2014 once a year, and it appears nowhere. Here the same number is timely, and it is your own record.',
  'duty.voluntary':
    'Filling this in is not required. Nothing reminds you and nothing follows from leaving it. No officer outside your school ever sees your name against it \u2014 only the school\u2019s total.',
  'duty.add': 'Record a duty',
  'duty.category': 'What kind of duty',
  'duty.description': 'What the duty was',
  'duty.descriptionHint': 'For example: SIR booth level officer, booth 142',
  'duty.orderReference': 'Order number',
  'duty.orderReferenceHint':
    'If you have the order. This platform never records the name of the officer who issued it.',
  'duty.fromDate': 'From',
  'duty.toDate': 'To',
  'duty.daysLost': 'Teaching days lost',
  'duty.daysLostHint': 'Only days the school was open. Do not count Sundays and holidays.',
  'duty.duringSchoolHours': 'Did any of it fall in school hours',
  'duty.duringSchoolHoursHint':
    'The High Court\u2019s Division Bench made this the decisive fact \u2014 teaching days and teaching hours.',
  'duty.honorariumDue': 'Honorarium due (\u20b9)',
  'duty.honorariumReceived': 'Honorarium received (\u20b9)',
  'duty.honorariumHint': 'What was owed and what arrived. The gap between them is the point.',
  'duty.section27': 'Named in section 27 of the Act',
  'duty.notSection27': 'Not among the three the Act names',
  'duty.section27Note':
    'Section 27 of the Right to Education Act permits exactly three \u2014 census, disaster relief and elections. This classification is a statement of law, not an accusation against anyone.',
  'duty.attest': 'Confirm',
  'duty.attested': 'Confirmed',
  'duty.attestedBy': 'Confirmed by',
  'duty.daysTotal': 'Teaching days',
  'duty.daysSection27': 'Section 27 days',
  'duty.daysOther': 'Other days',
  'duty.daysInSchoolHours': 'In school hours',
  'duty.outstanding': 'Honorarium outstanding',
  'duty.empty': 'No duty recorded yet.',
  'duty.saved': 'Recorded.',
  'duty.cat.CENSUS': 'Census',
  'duty.cat.ELECTION': 'Election / electoral roll',
  'duty.cat.DISASTER_RELIEF': 'Disaster relief',
  'duty.cat.SURVEY': 'Survey',
  'duty.cat.DATA_ENTRY': 'Data entry / portal',
  'duty.cat.TRAINING': 'Training',
  'duty.cat.MEETING': 'Meeting',
  'duty.cat.PROVISIONING': 'Provisioning / meals',
  'duty.cat.OTHER': 'Other',

  'nav.orders': 'Orders',
  'order.title': 'Orders',
  'order.intro':
    'The orders in force for this school right now. Anything a later order replaced does not appear here.',
  'order.checkTitle': 'Is this order real?',
  'order.checkIntro':
    'Enter the letter number from something that arrived on WhatsApp. Forged orders bearing officers\u2019 signatures travel the same way.',
  'order.checkLabel': 'Letter number',
  'order.check': 'Check',
  'order.checkFound': 'This order is on the register.',
  'order.checkNotFound':
    'This letter number is not on the register. That does not mean the order is false \u2014 the register only holds orders published here. If in doubt, confirm with the block office.',
  'order.checkSuperseded': 'Note \u2014 a later order has replaced this one.',
  'order.plainSummary': 'What the school must do',
  'order.letterNumber': 'Letter number',
  'order.issuedBy': 'Issuing office',
  'order.dueBy': 'By',
  'order.document': 'See the original order',
  'order.empty': 'Nothing is outstanding right now.',
  'order.respond': 'Answer',
  'order.myAnswer': 'Your answer',
  'order.answeredBy': 'Answered by',
  'order.whatIsMissing': 'What is missing',
  'order.noteOptional': 'Anything else (optional)',
  'order.blockedHelp':
    'Saying what is missing is not an excuse. It is recorded against the office that owed the thing.',
  'order.src.COURT_DIRECTION': 'Court direction',
  'order.src.STATE_ORDER': 'State order',
  'order.src.DISTRICT_ORDER': 'District order',
  'order.src.BLOCK_INSTRUCTION': 'Block instruction',
  'order.state.SEEN': 'Seen',
  'order.state.IN_PROGRESS': 'In progress',
  'order.state.DONE': 'Done',
  'order.state.BLOCKED': 'Could not',
  'order.state.NOT_APPLICABLE': 'Not about our school',
  'order.blocked.FUNDS_NOT_RECEIVED': 'Funds did not arrive',
  'order.blocked.MATERIAL_NOT_RECEIVED': 'Material did not arrive',
  'order.blocked.STAFF_SHORTAGE': 'Not enough staff',
  'order.blocked.BUILDING_OR_FACILITY_UNUSABLE': 'Building or facility unusable',
  'order.blocked.NO_INSTRUCTION_RECEIVED': 'No instruction ever reached us',
  'order.blocked.CONFLICTS_WITH_ANOTHER_ORDER': 'Conflicts with another order',
  'order.blocked.OTHER': 'Something else',

  loading: 'Loading…',
};
