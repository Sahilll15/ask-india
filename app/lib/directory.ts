export type Portal = { name: string; hi: string; url: string; what: string };

export type Category = {
  id: string;
  en: string;
  hi: string;
  icon: IconName;
  questions: string[];
  keywords: string[];
  portals: string[];
};

export type IconName =
  | 'id'
  | 'tax'
  | 'support'
  | 'business'
  | 'vehicle'
  | 'law'
  | 'education'
  | 'health'
  | 'phone'
  | 'globe';

// Every URL here was checked with curl (follow redirects, browser UA) and resolved to 200 on an official host.
// Re-check with `npm run verify:links`.
export const PORTALS: Record<string, Portal> = {
  nationalPortal: { name: 'National Portal of India', hi: 'भारत का राष्ट्रीय पोर्टल', url: 'https://www.india.gov.in/', what: 'Index of central and state services' },
  myAadhaar: { name: 'myAadhaar', hi: 'माय आधार', url: 'https://myaadhaar.uidai.gov.in/', what: 'Aadhaar updates, downloads and status' },
  uidai: { name: 'UIDAI', hi: 'यूआईडीएआई', url: 'https://uidai.gov.in/', what: 'Aadhaar rules, documents and FAQs' },
  incomeTax: { name: 'Income Tax e-filing', hi: 'आयकर ई-फाइलिंग', url: 'https://www.incometax.gov.in/iec/foportal/', what: 'ITR filing, e-PAN, PAN-Aadhaar link' },
  passport: { name: 'Passport Seva', hi: 'पासपोर्ट सेवा', url: 'https://www.passportindia.gov.in/psp', what: 'New passport, renewal, appointments' },
  gst: { name: 'GST portal', hi: 'जीएसटी पोर्टल', url: 'https://www.gst.gov.in/', what: 'GST registration and returns' },
  parivahan: { name: 'Parivahan', hi: 'परिवहन', url: 'https://parivahan.gov.in/', what: 'Vehicle registration and permits' },
  sarathi: { name: 'Sarathi', hi: 'सारथी', url: 'https://sarathi.parivahan.gov.in/', what: 'Learner and driving licence services' },
  epfo: { name: 'EPFO', hi: 'ईपीएफओ', url: 'https://www.epfo.gov.in/', what: 'Provident fund, UAN, claims' },
  udyam: { name: 'Udyam Registration', hi: 'उद्यम पंजीकरण', url: 'https://udyamregistration.gov.in/', what: 'MSME registration' },
  voters: { name: 'Voters Service Portal', hi: 'मतदाता सेवा पोर्टल', url: 'https://voters.eci.gov.in/', what: 'Voter registration and EPIC services' },
  eci: { name: 'Election Commission of India', hi: 'भारत निर्वाचन आयोग', url: 'https://www.eci.gov.in/', what: 'Official election procedures' },
  digilocker: { name: 'DigiLocker', hi: 'डिजिलॉकर', url: 'https://www.digilocker.gov.in/', what: 'Official digital copies of documents' },
  sancharSaathi: { name: 'Sanchar Saathi', hi: 'संचार साथी', url: 'https://sancharsaathi.gov.in/', what: 'Block lost phones, check SIMs in your name' },
  cpgrams: { name: 'CPGRAMS', hi: 'सीपीग्राम्स', url: 'https://pgportal.gov.in/', what: 'Public grievances to central ministries' },
  indiaCode: { name: 'India Code', hi: 'इंडिया कोड', url: 'https://www.indiacode.nic.in/', what: 'Text of central and state Acts' },
  pmKisan: { name: 'PM-KISAN', hi: 'पीएम-किसान', url: 'https://pmkisan.gov.in/', what: 'Farmer income support, status' },
  ayushman: { name: 'Ayushman Bharat beneficiary portal', hi: 'आयुष्मान भारत लाभार्थी पोर्टल', url: 'https://beneficiary.nha.gov.in/', what: 'PM-JAY eligibility and card' },
  abha: { name: 'ABHA', hi: 'आभा', url: 'https://abha.abdm.gov.in/', what: 'Ayushman Bharat Health Account ID' },
  scholarships: { name: 'National Scholarship Portal', hi: 'राष्ट्रीय छात्रवृत्ति पोर्टल', url: 'https://scholarships.gov.in/', what: 'Central and state scholarships' },
  oci: { name: 'OCI Services', hi: 'ओसीआई सेवाएं', url: 'https://ociservices.gov.in/', what: 'OCI card applications' },
  madad: { name: 'MADAD', hi: 'मदद', url: 'https://www.madad.gov.in/', what: 'Consular grievances for Indians abroad' },
  mea: { name: 'Ministry of External Affairs', hi: 'विदेश मंत्रालय', url: 'https://www.mea.gov.in/', what: 'Consular and overseas services' },
  cybercrime: { name: 'Cyber Crime Portal', hi: 'साइबर अपराध पोर्टल', url: 'https://cybercrime.gov.in/', what: 'Report online fraud and cyber crime' },
  consumer: { name: 'National Consumer Helpline', hi: 'राष्ट्रीय उपभोक्ता हेल्पलाइन', url: 'https://consumerhelpline.gov.in/', what: 'Consumer complaints' },
  ecourts: { name: 'eCourts Services', hi: 'ई-कोर्ट सेवाएं', url: 'https://services.ecourts.gov.in/', what: 'Case status and cause lists' },
  eshram: { name: 'e-Shram', hi: 'ई-श्रम', url: 'https://eshram.gov.in/', what: 'Registration for unorganised workers' },
  umang: { name: 'UMANG', hi: 'उमंग', url: 'https://web.umang.gov.in/', what: 'Many central services in one app' },
  ceir: { name: 'CEIR', hi: 'सीईआईआर', url: 'https://www.ceir.gov.in/', what: 'Block or trace a lost mobile' },
  mohfw: { name: 'Ministry of Health', hi: 'स्वास्थ्य मंत्रालय', url: 'https://www.mohfw.gov.in/', what: 'Health schemes and advisories' },
};

export const CATEGORIES: Category[] = [
  {
    id: 'id-documents',
    en: 'ID & documents',
    hi: 'पहचान और दस्तावेज़',
    icon: 'id',
    questions: [
      'How do I update my address in Aadhaar online?',
      'How do I apply for a new PAN card?',
      'Naya voter ID card kaise banwayein?',
    ],
    keywords: ['aadhaar', 'aadhar', 'आधार', 'pan', 'पैन', 'voter', 'vote', 'election', 'चुनाव', 'epic', 'मतदाता', 'digilocker', 'passport', 'पासपोर्ट', 'birth certificate', 'document'],
    portals: ['myAadhaar', 'uidai', 'voters', 'digilocker', 'passport'],
  },
  {
    id: 'tax',
    en: 'Tax',
    hi: 'कर',
    icon: 'tax',
    questions: [
      'How do I file my income tax return online?',
      'How do I link my PAN with Aadhaar?',
      'आयकर रिफंड की स्थिति कैसे देखें?',
    ],
    keywords: ['tax', 'itr', 'income', 'refund', 'आयकर', 'tds', 'gst', 'return'],
    portals: ['incomeTax', 'gst'],
  },
  {
    id: 'social-support',
    en: 'Social support',
    hi: 'सामाजिक सहायता',
    icon: 'support',
    questions: [
      'Who is eligible for PM-KISAN?',
      'e-Shram card kaise banwayein?',
      'How do I check my PM-KISAN payment status?',
    ],
    keywords: ['kisan', 'किसान', 'pension', 'eshram', 'e-shram', 'shram', 'ration', 'scheme', 'yojana', 'योजना', 'subsidy', 'pf', 'epf', 'uan'],
    portals: ['pmKisan', 'eshram', 'epfo', 'umang'],
  },
  {
    id: 'business',
    en: 'Business',
    hi: 'व्यापार',
    icon: 'business',
    questions: [
      'How do I register my business on Udyam?',
      'How do I register for GST?',
      'GST registration ke liye kaun se documents chahiye?',
    ],
    keywords: ['udyam', 'msme', 'business', 'company', 'gst', 'व्यापार', 'startup', 'shop', 'firm'],
    portals: ['udyam', 'gst'],
  },
  {
    id: 'vehicles',
    en: 'Vehicles & transport',
    hi: 'वाहन और परिवहन',
    icon: 'vehicle',
    questions: [
      "How do I apply for a learner's driving licence?",
      'Driving licence renew kaise karein online?',
      'How do I transfer vehicle ownership?',
    ],
    keywords: ['driving', 'licence', 'license', 'dl', 'vehicle', 'rc', 'car', 'bike', 'challan', 'वाहन', 'लाइसेंस', 'parivahan'],
    portals: ['sarathi', 'parivahan'],
  },
  {
    id: 'law-complaints',
    en: 'Law & complaints',
    hi: 'कानून और शिकायतें',
    icon: 'law',
    questions: [
      'How do I file a grievance on CPGRAMS?',
      'How do I report an online fraud?',
      'उपभोक्ता शिकायत कैसे दर्ज करें?',
    ],
    keywords: ['grievance', 'complaint', 'शिकायत', 'fraud', 'cyber', 'court', 'case', 'consumer', 'act', 'law', 'कानून', 'rti'],
    portals: ['cpgrams', 'cybercrime', 'consumer', 'ecourts', 'indiaCode'],
  },
  {
    id: 'education',
    en: 'Education',
    hi: 'शिक्षा',
    icon: 'education',
    questions: [
      'How do I apply on the National Scholarship Portal?',
      'How can I get my marksheet in DigiLocker?',
      'Scholarship ke liye kaun eligible hai?',
    ],
    keywords: ['scholarship', 'छात्रवृत्ति', 'marksheet', 'student', 'school', 'college', 'exam', 'शिक्षा'],
    portals: ['scholarships', 'digilocker'],
  },
  {
    id: 'health',
    en: 'Health',
    hi: 'स्वास्थ्य',
    icon: 'health',
    questions: [
      'Who is eligible for Ayushman Bharat PM-JAY?',
      'ABHA health ID kaise banayein?',
      'आयुष्मान कार्ड कैसे बनवाएं?',
    ],
    keywords: ['ayushman', 'आयुष्मान', 'pmjay', 'pm-jay', 'abha', 'health', 'hospital', 'स्वास्थ्य', 'insurance'],
    portals: ['ayushman', 'abha', 'mohfw'],
  },
  {
    id: 'phones',
    en: 'Phones & internet',
    hi: 'फ़ोन और इंटरनेट',
    icon: 'phone',
    questions: [
      'How do I block my lost phone on Sanchar Saathi?',
      'How do I check how many SIM cards are in my name?',
      'Mobile chori ho gaya, kya karna chahiye?',
    ],
    keywords: ['phone', 'mobile', 'sim', 'lost', 'stolen', 'chori', 'फ़ोन', 'मोबाइल', 'imei', 'sanchar', 'spam', 'call'],
    portals: ['sancharSaathi', 'ceir', 'cybercrime'],
  },
  {
    id: 'overseas',
    en: 'Overseas Indians',
    hi: 'प्रवासी भारतीय',
    icon: 'globe',
    questions: [
      'How do I apply for an OCI card?',
      'How do I renew my Indian passport from abroad?',
      'How do I raise a consular grievance on MADAD?',
    ],
    keywords: ['oci', 'nri', 'abroad', 'overseas', 'consulate', 'embassy', 'madad', 'प्रवासी', 'visa'],
    portals: ['oci', 'madad', 'mea', 'passport'],
  },
];

/** Portals shown in the "go straight to a service" grid. */
export const FEATURED_PORTALS = [
  'myAadhaar', 'incomeTax', 'passport', 'gst', 'sarathi', 'parivahan', 'epfo', 'udyam',
  'voters', 'digilocker', 'sancharSaathi', 'cpgrams', 'pmKisan', 'ayushman', 'scholarships', 'oci',
  'cybercrime', 'indiaCode',
];

const FALLBACK = ['nationalPortal', 'umang', 'cpgrams'];
const ELECTION = /\b(vote|voter|voting|election|elections|poll|polling|party|candidate|evm|epic)\b|चुनाव|मतदान|मतदाता|वोट/i;

/** Best-guess directory links for a question, used when no official answer was found. */
export function relatedPortals(question: string, max = 3): Portal[] {
  const q = question.toLowerCase();
  const scored = CATEGORIES.map((c) => ({
    c,
    score: c.keywords.filter((k) => new RegExp(`(^|[^a-z])${k.replace(/[-]/g, '\\-')}([^a-z]|$)`).test(q)).length,
  }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
  const lead = ELECTION.test(q) ? ['voters', 'eci'] : [];
  const keys = [...new Set([...lead, ...scored.flatMap((s) => s.c.portals), ...FALLBACK])].slice(0, max);
  return keys.map((k) => PORTALS[k]);
}

export const SAMPLES = [
  'How do I update my address in Aadhaar online?',
  'पासपोर्ट का नवीनीकरण कैसे करें?',
  'Lost phone ko Sanchar Saathi par block kaise karein?',
];
