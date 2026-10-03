export type GuideSection = { heading: string; steps: string[] };
export type Source = { title: string; url: string };

export type Guide = {
  slug: string;
  title: string;
  description: string;
  summary: string;
  needs: string[];
  sections: GuideSection[];
  documents?: string[];
  notes: string[];
  sources: Source[];
  followUp: string;
  // Exact directory questions this guide answers, so /directory can link to it.
  directoryQuestions: string[];
};

export const LAST_CHECKED_ISO = '2026-10-04';
export const LAST_CHECKED_LABEL = '4 October 2026';

// Every step, document and fee below is taken from the linked official pages as fetched on LAST_CHECKED.
export const GUIDES: Guide[] = [
  {
    slug: 'link-pan-with-aadhaar',
    title: 'How to link PAN with Aadhaar',
    description:
      'Steps to pay the fee and link your PAN with Aadhaar on the Income Tax e-Filing portal, and how to check the link status. Taken from the official user manual.',
    summary:
      'If your PAN was allotted on or before 1 July 2017, linking it with Aadhaar is mandatory. You first pay the fee through e-Pay Tax on the e-Filing portal, then submit the link request. New PAN applicants are linked automatically when they apply.',
    needs: ['A valid PAN', 'Your Aadhaar number', 'A valid mobile number'],
    sections: [
      {
        heading: 'Pay the fee',
        steps: [
          'On the e-Filing portal home page, click Link Aadhaar under Quick Links. If you are logged in, use Link Aadhaar in the Profile section.',
          'Enter your PAN and Aadhaar number.',
          'Click Continue to Pay Through e-Pay Tax.',
          'Enter your PAN, confirm it, enter a mobile number and verify the OTP.',
          'On the e-Pay Tax page, click Proceed on the Income Tax tile.',
          'Select the assessment year and Other Receipts (500) as the type of payment, then click Continue. The amount is filled in for you.',
          'Choose a payment mode and pay on your bank website.',
        ],
      },
      {
        heading: 'Submit the link request',
        steps: [
          'Go back to Link Aadhaar under Quick Links, enter your PAN and Aadhaar, and click Validate.',
          'When the portal says your payment details are verified, click Continue.',
          'Enter the required details and click Link Aadhaar.',
          'Enter the 6-digit OTP sent to your mobile number and click Validate.',
        ],
      },
      {
        heading: 'Check the status',
        steps: ['On the e-Filing portal home page, click Link Aadhaar Status under Quick Links.', 'Enter your PAN and Aadhaar number and click View Link Aadhaar Status.'],
      },
    ],
    notes: [
      'If you see "Payment details not found" after paying, the manual says to wait 4 to 5 working days before you submit the request.',
      'If your PAN is already linked to a different Aadhaar, or your Aadhaar to a different PAN, the manual says to contact your Jurisdictional Assessing Officer to delink it.',
      'If the request is pending with UIDAI for validation, check the status again later.',
    ],
    sources: [
      { title: 'Link Aadhaar user manual, Income Tax Department', url: 'https://www.incometax.gov.in/iec/foportal/help/how-to-link-aadhaar' },
      { title: 'Income Tax e-Filing portal', url: 'https://www.incometax.gov.in/iec/foportal/' },
    ],
    followUp: 'I paid the PAN Aadhaar link fee. What should I do if it says payment details not found?',
    directoryQuestions: ['How do I link my PAN with Aadhaar?'],
  },
  {
    slug: 'apply-for-pan-card',
    title: 'How to get a PAN card online with Instant e-PAN',
    description:
      'Get a free e-PAN using your Aadhaar and the mobile number linked to it on the Income Tax e-Filing portal. Who can use it, the steps, and how to download it.',
    summary:
      'Instant e-PAN gives individuals who do not have a PAN a digitally signed PAN in electronic form, free of cost, using Aadhaar and the mobile number linked to it. This guide covers that route only.',
    needs: [
      'You are an individual who has not been allotted a PAN',
      'A valid Aadhaar with a mobile number linked to it',
      'You are not a minor on the date of the request',
      'You are not a Representative Assessee under section 160 of the Income Tax Act',
    ],
    sections: [
      {
        heading: 'Get a new e-PAN',
        steps: [
          'On the e-Filing portal home page, click Instant e-PAN.',
          'Click Get New e-PAN.',
          'Enter your 12-digit Aadhaar number, tick the I confirm that box and click Continue.',
          'Read the consent terms, agree, and click Continue.',
          'Enter the 6-digit OTP sent to the mobile number linked with Aadhaar, tick the box to validate your Aadhaar details with UIDAI, and click Continue.',
          'On the Validate Aadhaar Details page, tick I Accept that and click Continue. Linking your email ID is optional.',
          'Note the Acknowledgement Number shown on screen. You also get a confirmation message on your mobile.',
        ],
      },
      {
        heading: 'Check status and download the e-PAN',
        steps: [
          'On the e-Filing portal home page, click Instant e-PAN.',
          'Click Continue under Check Status / Download PAN.',
          'Enter your 12-digit Aadhaar number and the OTP sent to your mobile.',
          'If the e-PAN has been allotted, click View e-PAN or Download e-PAN.',
        ],
      },
    ],
    notes: [
      'The OTP is valid for 15 minutes and you get 3 attempts to enter it.',
      'If your Aadhaar is already linked to a PAN, or has no active mobile number linked, the portal shows a message and you cannot continue.',
      'After you get the e-PAN, you can click Create e-Filing Account to register on the portal.',
    ],
    sources: [
      { title: 'Instant e-PAN user manual, Income Tax Department', url: 'https://www.incometax.gov.in/iec/foportal/help/how-to-generate-instant-e-pan' },
      { title: 'Income Tax e-Filing portal', url: 'https://www.incometax.gov.in/iec/foportal/' },
    ],
    followUp: 'My Aadhaar has no mobile number linked. How can I get a PAN?',
    directoryQuestions: ['How do I apply for a new PAN card?'],
  },
  {
    slug: 'renew-passport',
    title: 'How to renew (reissue) your passport in India',
    description:
      'Steps to apply for reissue of an ordinary passport on Passport Seva: register, fill the form, pay, book an appointment and visit the Passport Seva Kendra.',
    summary:
      'Renewing a passport is called reissue on Passport Seva. You apply online, pay and book an appointment, then visit the Passport Seva Kendra (PSK) or Regional Passport Office with your original documents.',
    needs: ['A Passport Seva Online Portal account', 'Original documents and one set of self-attested photocopies of them'],
    sections: [
      {
        heading: 'Apply online',
        steps: [
          'Register on the Passport Seva Online Portal using the Register link, then log in.',
          'Click Apply for Fresh Passport/Re-issue of Passport. If you have ever held an ordinary passport, apply for a new ordinary passport under Reissue.',
          'Fill in the form and submit it. An Application Reference Number (ARN) is generated. You cannot change the application after you submit it.',
        ],
      },
      {
        heading: 'Pay and book an appointment',
        steps: [
          'On View Saved/Submitted Applications, click Pay and Schedule Appointment.',
          'Pay online by credit or debit card, internet banking or UPI. Payment is mandatory to book an appointment.',
          'Pick a PSK or Post Office Passport Seva Kendra and a date. You get an SMS with the appointment details.',
        ],
      },
      {
        heading: 'Visit the Passport Seva Kendra',
        steps: [
          'Go to the PSK or Regional Passport Office on your appointment date with your original documents.',
          'The SMS with your appointment details is accepted as proof of appointment. A printed receipt is no longer required.',
        ],
      },
    ],
    documents: [
      'Use the Document Advisor on Passport Seva to get the list for your case. It asks about application type, age, employment and whether your address has changed.',
      'For adding a spouse name: marriage certificate, or a Joint Photo Declaration signed by husband and wife (Annexure J).',
      'Check your jurisdictional passport office page for any additional documents.',
    ],
    notes: [
      'Passport Seva says application fees were revised from 1 July 2026. Use the Fee Calculator on the site before you pay.',
      'If you do not visit the PSK within 90 days of submitting the form online, you have to submit it again.',
      'To reissue from a different Regional Passport Office than the one that issued your current passport, create a new login ID. You can use the same email ID.',
      'You can reschedule an appointment three times, or once for Tatkaal.',
    ],
    sources: [
      { title: 'Apply for re-issue of ordinary passport, Passport Seva', url: 'https://www.passportindia.gov.in/psp/ApplyReissue' },
      { title: 'Process to apply for fresh or reissue ordinary passport, Passport Seva', url: 'https://www.passportindia.gov.in/psp/Apply' },
      { title: 'Documents required for re-issue of passport, Passport Seva', url: 'https://www.passportindia.gov.in/psp/docAdvisor/reissuePassport' },
    ],
    followUp: 'Which documents do I need to renew my passport if my address has changed?',
    directoryQuestions: [],
  },
  {
    slug: 'update-aadhaar-address',
    title: 'How to update your address in Aadhaar online',
    description:
      'Update the address on your Aadhaar on the myAadhaar portal with a proof of address document or a family member\'s consent. What you need, the fee shown, and other options.',
    summary:
      'You can place an address update request yourself on the myAadhaar portal if your mobile number is registered with Aadhaar. You log in with your Aadhaar number and an OTP, and upload a proof of address document, which is checked later by UIDAI.',
    needs: ['Your Aadhaar number', 'A mobile number registered with Aadhaar, for the OTP', 'A proof of address (POA) document, or a family member who can give consent'],
    sections: [
      {
        heading: 'Update online on myAadhaar',
        steps: [
          'Open the myAadhaar portal and log in with your Aadhaar number and the OTP sent to your registered mobile.',
          'Choose Update Address.',
          'Enter the new address and upload a supporting proof of address document.',
          'Submit the request. UIDAI verifies it against your document at a later stage.',
          'Track it with Check Enrolment / Update Status on myAadhaar.',
        ],
      },
      {
        heading: 'If you have no address proof in your own name',
        steps: [
          'Use the family member (Head of Family) based address update on myAadhaar or the Aadhaar app.',
          'You must live at the same address as that family member, and they give consent.',
          'For an Aadhaar holder under 18, the family member can be the mother, father or legal guardian.',
        ],
      },
    ],
    notes: [
      'The myAadhaar portal shows a fee of Rs 75 for Update Address.',
      'UIDAI accepts a range of proof of address documents. The full list is linked from the UIDAI page on updating data.',
      'If no mobile number is registered with your Aadhaar, UIDAI says to visit a Permanent Enrolment Centre to register it first. You can also update your address at an Aadhaar Enrolment Centre with an operator.',
      'The Aadhaar app also offers address update.',
    ],
    sources: [
      { title: 'Updating data on Aadhaar, UIDAI', url: 'https://uidai.gov.in/en/updating-data-on-aadhaar' },
      { title: 'Your Aadhaar FAQs, UIDAI', url: 'https://uidai.gov.in/en/your-aadhaar' },
      { title: 'myAadhaar portal, UIDAI', url: 'https://myaadhaar.uidai.gov.in/' },
    ],
    followUp: 'Which documents does UIDAI accept as proof of address for an Aadhaar address update?',
    directoryQuestions: ['How do I update my address in Aadhaar online?'],
  },
  {
    slug: 'gst-registration',
    title: 'How to register for GST online',
    description:
      'Steps to apply for new GST registration as a normal taxpayer on the GST portal: Part A, TRN, Part B, Aadhaar authentication and signing. From the official GST tutorial.',
    summary:
      'You apply for GST registration on the GST portal in two parts. Part A checks your PAN, email and mobile and gives you a Temporary Reference Number (TRN). In Part B you fill the full application, complete Aadhaar authentication and sign it. You then get an Application Reference Number (ARN).',
    needs: [
      'PAN of the business or the proprietor (PAN is mandatory)',
      'Email address and Indian mobile number of the primary authorised signatory',
      'Documents to upload in Part B (see below)',
    ],
    sections: [
      {
        heading: 'Part A: get a TRN',
        steps: [
          'On gst.gov.in, click Services, then Registration, then New Registration.',
          'Select Taxpayer in the I am a list, then your state and district.',
          'Enter the legal name of the business as in PAN, the PAN, and the email and mobile number of the primary authorised signatory. Click Proceed.',
          'Enter the separate OTPs sent to the mobile and the email. Each is valid for 10 minutes.',
          'Note the Temporary Reference Number (TRN) shown. It is also sent to your email and mobile.',
        ],
      },
      {
        heading: 'Part B: fill and submit the application',
        steps: [
          'Go to New Registration again, choose Temporary Reference Number (TRN), enter the TRN and verify the OTP.',
          'Under My Saved Applications, click the edit icon.',
          'Fill each tab: business details, promoters or partners, authorised signatory, authorised representative, principal place of business, additional places, goods and services, and state specific information.',
          'On the Aadhaar Authentication tab, choose Yes or No for Aadhaar authentication of promoters and authorised signatories.',
          'On the Verification tab, sign with a Digital Signature Certificate (DSC), E-Signature or EVC. DSC is mandatory for companies and LLPs.',
          'You get the acknowledgement and ARN on your email and mobile within 15 minutes.',
        ],
      },
    ],
    documents: [
      'Photograph of each promoter or partner (PDF or JPEG, up to 100 KB).',
      'Proof of appointment of the authorised signatory (up to 1 MB) and their photograph (up to 100 KB).',
      'Proof of principal place of business (up to 1 MB). Own premises: latest property tax receipt, municipal khata copy or electricity bill. Rented or leased: rent or lease agreement plus a document showing the owner\'s ownership. Other premises: consent letter plus an ownership document of the person giving consent.',
    ],
    notes: [
      'If you do not submit the application within 15 days, the TRN and everything filled against it is deleted.',
      'With Aadhaar authentication, you either get an authentication link on the mobile and email given in the application, or you book a slot for biometric authentication at a designated GST centre (GSK). The ARN is generated only after this is done.',
      'If you choose No for Aadhaar authentication, you have to go through photo capture and document verification at a designated GSK.',
      'E-Signature works only if the authorised signatory has Aadhaar and it is entered in the application.',
    ],
    sources: [
      { title: 'Apply for registration: normal taxpayer, GST tutorial', url: 'https://tutorial.gst.gov.in/userguide/registration/Apply_for_Registration_Normal_Taxpayer.htm' },
      { title: 'GST portal', url: 'https://www.gst.gov.in/' },
    ],
    followUp: 'Do I need GST registration for my small business, and which documents should I keep ready?',
    directoryQuestions: ['How do I register for GST?', 'GST registration ke liye kaun se documents chahiye?'],
  },
  {
    slug: 'check-epf-balance',
    title: 'How to check your EPF balance',
    description:
      'Check your EPF balance by missed call, by SMS or in the EPF passbook with your UAN. The numbers and portals listed on official EPFO pages.',
    summary:
      'EPFO lists three ways to check your provident fund balance: a missed call, an SMS, or logging in to the EPF passbook with your UAN and password. To use online services you need an activated UAN.',
    needs: ['Your UAN (Universal Account Number)', 'For the passbook: an activated UAN and its password'],
    sections: [
      {
        heading: 'By missed call or SMS',
        steps: [
          'Give a missed call to 9966044425.',
          'Or send an SMS in the format EPFOHO UAN <LAN> to 7738299899, with your UAN in place of UAN. The page shows <LAN> for a language code but does not list the codes.',
        ],
      },
      {
        heading: 'In the EPF passbook',
        steps: [
          'Open the EPF Passbook & Claim Status page.',
          'Sign in with your UAN and password to see your balance and transaction history.',
        ],
      },
      {
        heading: 'If your UAN is not active yet',
        steps: ['Use Activate UAN on the EPFO member portal.', 'The member portal says UAN activation can also be done through the UMANG app.'],
      },
    ],
    notes: [
      'The EPFO help desk toll free number shown on the passbook page is 1800118005.',
      'EPFO says it never calls members to ask for Aadhaar, PAN, bank details, OTP or any payment.',
    ],
    sources: [
      { title: 'EPF passbook and claim status, EPFO', url: 'https://passbook.epfindia.gov.in/MemberPassBook/login' },
      { title: 'UAN member portal, EPFO', url: 'https://unifiedportal-mem.epfindia.gov.in/memberinterface/' },
      { title: 'EPFO home', url: 'https://www.epfo.gov.in/' },
    ],
    followUp: 'How do I find my UAN if I do not know it?',
    directoryQuestions: [],
  },
  {
    slug: 'apply-for-voter-id',
    title: 'How to apply for a new voter ID card (Form 6)',
    description:
      'Register as a new voter and get your voter ID (EPIC) by filling Form 6 on the Voters\' Services Portal. Who can apply, what to fill, photo and proof rules.',
    summary:
      'Indian citizens who are 18 or older on the qualifying date apply as new voters with Form 6 on the Voters\' Services Portal of the Election Commission of India. After enrolment the voter ID card (EPIC) is sent to you by speed post, free of cost.',
    needs: [
      'A mobile number to create an account on the portal',
      'A recent passport size colour photo (4.5 cm x 3.5 cm, white background, unsigned)',
      'A self-attested proof of age',
      'A self-attested proof of ordinary residence in your name or a parent\'s or spouse\'s name',
      'Aadhaar number (optional)',
    ],
    sections: [
      {
        heading: 'Apply online',
        steps: [
          'Go to voters.eci.gov.in and sign up with your mobile number, then log in.',
          'Under New Voter Registration, choose Fill Form 6. The portal says to use Form 6 if you are 18 or above, or will turn 18 in a few months.',
          'Enter your name in English and in the official language of your state. If you fill only one, the system transliterates it and spelling mistakes can creep in.',
          'Fill in your relative\'s name, Aadhaar number (or say you do not have one), gender, date of birth and full address with PIN code.',
          'Add your photo and the proof of age and address documents, complete the declaration and submit.',
          'Use Track Application Status on the portal to follow the application.',
        ],
      },
    ],
    notes: [
      'If you have none of the age proofs listed in the form, you can give another document, but you will have to appear in person before the Electoral Registration Officer.',
      'Students can enrol at their parents\' address or at the hostel or mess where they live.',
      'A false statement in the declaration is punishable under section 31 of the Representation of the People Act, 1950.',
      'Indian citizens living abroad use Form 6A instead.',
      'After enrolment you can also download a digital copy from E-EPIC Download on the portal.',
    ],
    sources: [
      { title: 'Voters\' Services Portal, Election Commission of India', url: 'https://voters.eci.gov.in/' },
      { title: 'About the Voters\' Services Portal, Election Commission of India', url: 'https://www.eci.gov.in/voters-services-portal' },
      { title: 'Guidelines for filling Form 6 (PDF), Election Commission of India', url: 'https://voters.eci.gov.in/guidelines/Form-6_en.pdf' },
    ],
    followUp: 'Which documents can I use as proof of address for Form 6?',
    directoryQuestions: ['Naya voter ID card kaise banwayein?'],
  },
  {
    slug: 'download-e-aadhaar',
    title: 'How to download e-Aadhaar',
    description:
      'Download a digitally signed, password protected copy of your Aadhaar (e-Aadhaar) or a masked copy from the myAadhaar portal or the Aadhaar app.',
    summary:
      'Once your Aadhaar is generated, you can download e-Aadhaar online. The myAadhaar portal gives a digitally signed, password protected electronic copy, and needs an OTP on your registered mobile.',
    needs: ['Your Aadhaar details', 'A mobile number registered with Aadhaar, for the OTP'],
    sections: [
      {
        heading: 'On the myAadhaar portal',
        steps: [
          'Open the myAadhaar portal and choose Download Aadhaar.',
          'Enter the details asked for and the OTP sent to your registered mobile.',
          'Save the file. It is password protected, so follow the instructions on the download page to open it.',
        ],
      },
      {
        heading: 'Masked copy',
        steps: ['Choose Download Masked Aadhaar instead if you want a copy that shows only the last 4 digits. The first 8 digits appear as xxxx-xxxx.'],
      },
      {
        heading: 'On the Aadhaar app',
        steps: [
          'Install the Aadhaar app from the Play Store or App Store.',
          'Register: pick a language, enter your Aadhaar number, accept the terms, choose the SIM card, complete face authentication and set a 6-digit PIN.',
          'Use the download e-Aadhaar service in the app.',
        ],
      },
    ],
    notes: [
      'If no mobile number is registered with your Aadhaar, UIDAI says to visit a Permanent Enrolment Centre to register it.',
      'NRIs enrolled with an address outside India receive a password protected e-Aadhaar on the email ID given at enrolment.',
    ],
    sources: [
      { title: 'myAadhaar portal, UIDAI', url: 'https://myaadhaar.uidai.gov.in/' },
      { title: 'Your Aadhaar FAQs, UIDAI', url: 'https://uidai.gov.in/en/your-aadhaar' },
      { title: 'Updating data on Aadhaar, UIDAI', url: 'https://uidai.gov.in/en/updating-data-on-aadhaar' },
    ],
    followUp: 'What is the password to open the e-Aadhaar PDF?',
    directoryQuestions: [],
  },
];

export function getGuide(slug: string) {
  return GUIDES.find((g) => g.slug === slug);
}

export function guideForQuestion(question: string) {
  return GUIDES.find((g) => g.directoryQuestions.includes(question));
}
