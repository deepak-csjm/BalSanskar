/**
 * The 75 districts of Uttar Pradesh, grouped by their administrative division.
 *
 * Held in the repository rather than fetched at runtime: the list changes at
 * most once in a decade, and a platform that cannot start without an external
 * lookup is a platform that cannot be installed on a government network.
 *
 * Codes are the two-digit district codes used within the state; they are stable
 * identifiers for imports and are not the UDISE prefix.
 */
export interface DistrictSeed {
  code: string;
  nameEn: string;
  nameHi: string;
  division: string;
}

export const UP_DISTRICTS: DistrictSeed[] = [
  { code: '01', nameEn: 'Saharanpur', nameHi: 'सहारनपुर', division: 'Saharanpur' },
  { code: '02', nameEn: 'Muzaffarnagar', nameHi: 'मुजफ्फरनगर', division: 'Saharanpur' },
  { code: '03', nameEn: 'Shamli', nameHi: 'शामली', division: 'Saharanpur' },
  { code: '04', nameEn: 'Bijnor', nameHi: 'बिजनौर', division: 'Moradabad' },
  { code: '05', nameEn: 'Moradabad', nameHi: 'मुरादाबाद', division: 'Moradabad' },
  { code: '06', nameEn: 'Sambhal', nameHi: 'संभल', division: 'Moradabad' },
  { code: '07', nameEn: 'Rampur', nameHi: 'रामपुर', division: 'Moradabad' },
  { code: '08', nameEn: 'Amroha', nameHi: 'अमरोहा', division: 'Moradabad' },
  { code: '09', nameEn: 'Meerut', nameHi: 'मेरठ', division: 'Meerut' },
  { code: '10', nameEn: 'Baghpat', nameHi: 'बागपत', division: 'Meerut' },
  { code: '11', nameEn: 'Ghaziabad', nameHi: 'गाज़ियाबाद', division: 'Meerut' },
  { code: '12', nameEn: 'Hapur', nameHi: 'हापुड़', division: 'Meerut' },
  { code: '13', nameEn: 'Gautam Buddha Nagar', nameHi: 'गौतम बुद्ध नगर', division: 'Meerut' },
  { code: '14', nameEn: 'Bulandshahr', nameHi: 'बुलंदशहर', division: 'Meerut' },
  { code: '15', nameEn: 'Aligarh', nameHi: 'अलीगढ़', division: 'Aligarh' },
  { code: '16', nameEn: 'Hathras', nameHi: 'हाथरस', division: 'Aligarh' },
  { code: '17', nameEn: 'Kasganj', nameHi: 'कासगंज', division: 'Aligarh' },
  { code: '18', nameEn: 'Etah', nameHi: 'एटा', division: 'Aligarh' },
  { code: '19', nameEn: 'Mathura', nameHi: 'मथुरा', division: 'Agra' },
  { code: '20', nameEn: 'Agra', nameHi: 'आगरा', division: 'Agra' },
  { code: '21', nameEn: 'Firozabad', nameHi: 'फ़िरोज़ाबाद', division: 'Agra' },
  { code: '22', nameEn: 'Mainpuri', nameHi: 'मैनपुरी', division: 'Agra' },
  { code: '23', nameEn: 'Etawah', nameHi: 'इटावा', division: 'Kanpur' },
  { code: '24', nameEn: 'Auraiya', nameHi: 'औरैया', division: 'Kanpur' },
  { code: '25', nameEn: 'Farrukhabad', nameHi: 'फ़र्रुख़ाबाद', division: 'Kanpur' },
  { code: '26', nameEn: 'Kannauj', nameHi: 'कन्नौज', division: 'Kanpur' },
  { code: '27', nameEn: 'Kanpur Dehat', nameHi: 'कानपुर देहात', division: 'Kanpur' },
  { code: '28', nameEn: 'Kanpur Nagar', nameHi: 'कानपुर नगर', division: 'Kanpur' },
  { code: '29', nameEn: 'Jalaun', nameHi: 'जालौन', division: 'Jhansi' },
  { code: '30', nameEn: 'Jhansi', nameHi: 'झाँसी', division: 'Jhansi' },
  { code: '31', nameEn: 'Lalitpur', nameHi: 'ललितपुर', division: 'Jhansi' },
  { code: '32', nameEn: 'Hamirpur', nameHi: 'हमीरपुर', division: 'Chitrakoot' },
  { code: '33', nameEn: 'Mahoba', nameHi: 'महोबा', division: 'Chitrakoot' },
  { code: '34', nameEn: 'Banda', nameHi: 'बाँदा', division: 'Chitrakoot' },
  { code: '35', nameEn: 'Chitrakoot', nameHi: 'चित्रकूट', division: 'Chitrakoot' },
  { code: '36', nameEn: 'Fatehpur', nameHi: 'फ़तेहपुर', division: 'Prayagraj' },
  { code: '37', nameEn: 'Pratapgarh', nameHi: 'प्रतापगढ़', division: 'Prayagraj' },
  { code: '38', nameEn: 'Kaushambi', nameHi: 'कौशाम्बी', division: 'Prayagraj' },
  { code: '39', nameEn: 'Prayagraj', nameHi: 'प्रयागराज', division: 'Prayagraj' },
  { code: '40', nameEn: 'Barabanki', nameHi: 'बाराबंकी', division: 'Ayodhya' },
  { code: '41', nameEn: 'Ayodhya', nameHi: 'अयोध्या', division: 'Ayodhya' },
  { code: '42', nameEn: 'Ambedkar Nagar', nameHi: 'अम्बेडकर नगर', division: 'Ayodhya' },
  { code: '43', nameEn: 'Sultanpur', nameHi: 'सुल्तानपुर', division: 'Ayodhya' },
  { code: '44', nameEn: 'Amethi', nameHi: 'अमेठी', division: 'Ayodhya' },
  { code: '45', nameEn: 'Bahraich', nameHi: 'बहराइच', division: 'Devipatan' },
  { code: '46', nameEn: 'Shravasti', nameHi: 'श्रावस्ती', division: 'Devipatan' },
  { code: '47', nameEn: 'Balrampur', nameHi: 'बलरामपुर', division: 'Devipatan' },
  { code: '48', nameEn: 'Gonda', nameHi: 'गोंडा', division: 'Devipatan' },
  { code: '49', nameEn: 'Siddharthnagar', nameHi: 'सिद्धार्थनगर', division: 'Basti' },
  { code: '50', nameEn: 'Basti', nameHi: 'बस्ती', division: 'Basti' },
  { code: '51', nameEn: 'Sant Kabir Nagar', nameHi: 'संत कबीर नगर', division: 'Basti' },
  { code: '52', nameEn: 'Maharajganj', nameHi: 'महराजगंज', division: 'Gorakhpur' },
  { code: '53', nameEn: 'Gorakhpur', nameHi: 'गोरखपुर', division: 'Gorakhpur' },
  { code: '54', nameEn: 'Kushinagar', nameHi: 'कुशीनगर', division: 'Gorakhpur' },
  { code: '55', nameEn: 'Deoria', nameHi: 'देवरिया', division: 'Gorakhpur' },
  { code: '56', nameEn: 'Azamgarh', nameHi: 'आज़मगढ़', division: 'Azamgarh' },
  { code: '57', nameEn: 'Mau', nameHi: 'मऊ', division: 'Azamgarh' },
  { code: '58', nameEn: 'Ballia', nameHi: 'बलिया', division: 'Azamgarh' },
  { code: '59', nameEn: 'Jaunpur', nameHi: 'जौनपुर', division: 'Varanasi' },
  { code: '60', nameEn: 'Ghazipur', nameHi: 'ग़ाज़ीपुर', division: 'Varanasi' },
  { code: '61', nameEn: 'Chandauli', nameHi: 'चंदौली', division: 'Varanasi' },
  { code: '62', nameEn: 'Varanasi', nameHi: 'वाराणसी', division: 'Varanasi' },
  { code: '63', nameEn: 'Bhadohi', nameHi: 'भदोही', division: 'Varanasi' },
  { code: '64', nameEn: 'Mirzapur', nameHi: 'मिर्ज़ापुर', division: 'Mirzapur' },
  { code: '65', nameEn: 'Sonbhadra', nameHi: 'सोनभद्र', division: 'Mirzapur' },
  { code: '66', nameEn: 'Lucknow', nameHi: 'लखनऊ', division: 'Lucknow' },
  { code: '67', nameEn: 'Unnao', nameHi: 'उन्नाव', division: 'Lucknow' },
  { code: '68', nameEn: 'Rae Bareli', nameHi: 'रायबरेली', division: 'Lucknow' },
  { code: '69', nameEn: 'Sitapur', nameHi: 'सीतापुर', division: 'Lucknow' },
  { code: '70', nameEn: 'Hardoi', nameHi: 'हरदोई', division: 'Lucknow' },
  { code: '71', nameEn: 'Lakhimpur Kheri', nameHi: 'लखीमपुर खीरी', division: 'Lucknow' },
  { code: '72', nameEn: 'Bareilly', nameHi: 'बरेली', division: 'Bareilly' },
  { code: '73', nameEn: 'Badaun', nameHi: 'बदायूँ', division: 'Bareilly' },
  { code: '74', nameEn: 'Pilibhit', nameHi: 'पीलीभीत', division: 'Bareilly' },
  { code: '75', nameEn: 'Shahjahanpur', nameHi: 'शाहजहाँपुर', division: 'Bareilly' },
];
