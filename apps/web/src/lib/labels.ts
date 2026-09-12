import type {
  AchievementCategory,
  AchievementLevel,
  ActivityCategory,
  Gender,
  RiskFlag,
  SchoolType,
} from '@balsanskar/shared';

/**
 * Bilingual labels for the domain enumerations.
 *
 * Separate from the interface strings because these are the vocabulary of the
 * department rather than of the application: they appear in exports, in
 * printed reports, and in conversations with block officers, so the Hindi has
 * to be the wording those officers already use.
 */

export const CATEGORY_LABELS: Record<'hi' | 'en', Record<ActivityCategory, string>> = {
  hi: {
    CLASSROOM_INNOVATION: 'कक्षा नवाचार',
    LEARNING_OUTCOME: 'अधिगम परिणाम',
    SPORTS: 'खेलकूद',
    ARTS_AND_CULTURE: 'कला एवं संस्कृति',
    SCIENCE_AND_MATH: 'विज्ञान एवं गणित',
    READING_AND_LIBRARY: 'पठन एवं पुस्तकालय',
    COMMUNITY_ENGAGEMENT: 'समुदाय सहभागिता',
    INFRASTRUCTURE_IMPROVEMENT: 'विद्यालय सुधार',
    HEALTH_AND_NUTRITION: 'स्वास्थ्य एवं पोषण',
    DIGITAL_LEARNING: 'डिजिटल शिक्षा',
    TEACHER_DEVELOPMENT: 'शिक्षक प्रशिक्षण',
    ENROLMENT_DRIVE: 'नामांकन अभियान',
    OTHER: 'अन्य',
  },
  en: {
    CLASSROOM_INNOVATION: 'Classroom innovation',
    LEARNING_OUTCOME: 'Learning outcome',
    SPORTS: 'Sports',
    ARTS_AND_CULTURE: 'Arts and culture',
    SCIENCE_AND_MATH: 'Science and mathematics',
    READING_AND_LIBRARY: 'Reading and library',
    COMMUNITY_ENGAGEMENT: 'Community engagement',
    INFRASTRUCTURE_IMPROVEMENT: 'School improvement',
    HEALTH_AND_NUTRITION: 'Health and nutrition',
    DIGITAL_LEARNING: 'Digital learning',
    TEACHER_DEVELOPMENT: 'Teacher development',
    ENROLMENT_DRIVE: 'Enrolment drive',
    OTHER: 'Other',
  },
};

export const ACHIEVEMENT_CATEGORY_LABELS: Record<
  'hi' | 'en',
  Record<AchievementCategory, string>
> = {
  hi: {
    ACADEMIC: 'शैक्षिक',
    SPORTS: 'खेलकूद',
    ARTS: 'कला',
    SCIENCE: 'विज्ञान',
    LITERATURE: 'साहित्य',
    SOCIAL_SERVICE: 'समाज सेवा',
    ATTENDANCE: 'उपस्थिति',
    OTHER: 'अन्य',
  },
  en: {
    ACADEMIC: 'Academic',
    SPORTS: 'Sports',
    ARTS: 'Arts',
    SCIENCE: 'Science',
    LITERATURE: 'Literature',
    SOCIAL_SERVICE: 'Social service',
    ATTENDANCE: 'Attendance',
    OTHER: 'Other',
  },
};

export const ACHIEVEMENT_LEVEL_LABELS: Record<'hi' | 'en', Record<AchievementLevel, string>> = {
  hi: {
    SCHOOL: 'विद्यालय स्तर',
    CLUSTER: 'न्याय पंचायत स्तर',
    BLOCK: 'खंड स्तर',
    DISTRICT: 'जनपद स्तर',
    STATE: 'राज्य स्तर',
    NATIONAL: 'राष्ट्रीय स्तर',
  },
  en: {
    SCHOOL: 'School',
    CLUSTER: 'Cluster',
    BLOCK: 'Block',
    DISTRICT: 'District',
    STATE: 'State',
    NATIONAL: 'National',
  },
};

export const GENDER_LABELS: Record<'hi' | 'en', Record<Gender, string>> = {
  hi: { MALE: 'बालक', FEMALE: 'बालिका', OTHER: 'अन्य' },
  en: { MALE: 'Boy', FEMALE: 'Girl', OTHER: 'Other' },
};

/**
 * The kinds of school the Basic Shiksha Parishad runs.
 *
 * The Hindi is the departmental wording rather than a translation: a head
 * teacher picking their own school's type should recognise the phrase from the
 * board outside the building.
 */
export const SCHOOL_TYPE_LABELS: Record<'hi' | 'en', Record<SchoolType, string>> = {
  hi: {
    PRIMARY: 'प्राथमिक विद्यालय',
    UPPER_PRIMARY: 'उच्च प्राथमिक विद्यालय',
    COMPOSITE: 'कम्पोजिट विद्यालय',
    KASTURBA_GANDHI: 'कस्तूरबा गांधी बालिका विद्यालय',
    OTHER: 'अन्य',
  },
  en: {
    PRIMARY: 'Primary school',
    UPPER_PRIMARY: 'Upper primary school',
    COMPOSITE: 'Composite school',
    KASTURBA_GANDHI: 'Kasturba Gandhi Balika Vidyalaya',
    OTHER: 'Other',
  },
};

/**
 * What each risk flag actually means, for the officer deciding whether to look.
 *
 * The API sends a prose sentence per flag as well; these short labels are for
 * the list, where an officer scanning forty items needs to tell at a glance
 * which one is a borrowed photograph and which is merely a Sunday.
 */
export const RISK_FLAG_LABELS: Record<'hi' | 'en', Record<RiskFlag, string>> = {
  hi: {
    PHOTO_REUSED_OTHER_SCHOOL: 'फ़ोटो किसी दूसरे विद्यालय में भी है',
    PHOTO_REUSED_OWN_SCHOOL: 'फ़ोटो इसी विद्यालय में पहले भी लगी है',
    COUNT_EXCEEDS_ROSTER: 'बताए गए बच्चे नामांकन से अधिक',
    COUNT_EXCEEDS_CLASSES: 'बताए गए बच्चे इन कक्षाओं की संख्या से अधिक',
    TEXT_REUSED: 'विवरण पहले के विवरण जैसा',
    BURST: 'थोड़े समय में बहुत सारी प्रविष्टियाँ',
    CONSENT_GAPS: 'कुछ बच्चों की सहमति नहीं है',
    LONG_BACKDATED: 'घटना के बहुत बाद दर्ज',
    NON_WORKING_DAY: 'अवकाश के दिन की गतिविधि',
    NO_EVIDENCE: 'कोई फ़ोटो नहीं',
    FIRST_SUBMISSION: 'विद्यालय की पहली प्रविष्टि',
  },
  en: {
    PHOTO_REUSED_OTHER_SCHOOL: 'Photo also appears at another school',
    PHOTO_REUSED_OWN_SCHOOL: 'Photo used before at this school',
    COUNT_EXCEEDS_ROSTER: 'More children than are enrolled',
    COUNT_EXCEEDS_CLASSES: 'More children than the named classes hold',
    TEXT_REUSED: 'Write-up close to an earlier one',
    BURST: 'Many entries in a short window',
    CONSENT_GAPS: 'Some children have no consent',
    LONG_BACKDATED: 'Filed long after the event',
    NON_WORKING_DAY: 'Dated on a holiday',
    NO_EVIDENCE: 'No photograph',
    FIRST_SUBMISSION: "The school's first entry",
  },
};

/**
 * The reasons a publish is blocked, in words a head teacher can act on.
 *
 * The server returns a prose sentence too, but these codes let the interface
 * show a checklist next to the thing that needs fixing rather than a paragraph
 * at the top of the page.
 */
export const BLOCKER_LABELS: Record<'hi' | 'en', Record<string, string>> = {
  hi: {
    NOT_SUBMITTED: 'यह गतिविधि अभी समीक्षा हेतु नहीं भेजी गई है।',
    DESCRIPTION_TOO_SHORT: 'विवरण बहुत छोटा है।',
    STUDENT_CONSENT_MISSING: 'किसी बच्चे की अभिभावक सहमति दर्ज नहीं है।',
    MEDIA_CONSENT_MISSING: 'किसी फ़ोटो की सहमति की पुष्टि नहीं हुई है।',
    VISIBILITY_ABOVE_ROLE: 'इस स्तर पर प्रकाशन का अधिकार आपके पास नहीं है।',
    VISIBILITY_ABOVE_REQUEST: 'शिक्षक ने इससे कम स्तर का अनुरोध किया था।',
  },
  en: {
    NOT_SUBMITTED: 'This activity has not been sent for review.',
    DESCRIPTION_TOO_SHORT: 'The description is too short.',
    STUDENT_CONSENT_MISSING: 'Guardian consent is missing for a named child.',
    MEDIA_CONSENT_MISSING: 'A photograph has not been confirmed against a consent slip.',
    VISIBILITY_ABOVE_ROLE: 'Your role cannot approve at that visibility.',
    VISIBILITY_ABOVE_REQUEST: 'The teacher asked for a narrower visibility.',
  },
};
