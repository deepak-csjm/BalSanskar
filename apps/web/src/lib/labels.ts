import type {
  AchievementCategory,
  AchievementLevel,
  ActivityCategory,
  Gender,
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
