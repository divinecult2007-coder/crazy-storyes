import type { Novel, Chapter, MembershipPlan, SiteSettings, User } from './types.ts';

export const initialSettings: SiteSettings = {
  websiteName: 'Crazy Storyes',
  tagline: 'प्रीमियम हिंदी उपन्यास और ऑडियोबुक्स – Premium Hindi Novels & Audiobooks',
  adminEmail: 'divinecult2007@gmail.com', // Website owner email
  upiId: 'crazystoryes@upi',
  upiQrCodeUrl: '',
  announcement: '🎉 Crazy Storyes में आपका स्वागत है! नए उपन्यास और ऑडियोबुक्स जोड़े गए हैं। सुनिए और आनंद लीजिये!',
  announcementActive: true,
  supportEmail: 'divinecult2007@gmail.com',
  supportPhone: '+91 8290188433',
  enableAiAssistant: true
};

export const initialPlans: MembershipPlan[] = [
  {
    id: 'plan_monthly',
    name: 'Monthly VIP',
    hindiName: 'मासिक वीआईपी',
    originalPrice: 99,
    price: 99,
    durationDays: 30,
    discountType: 'none',
    discountPercentage: 0,
    discountAmount: 0,
    description: 'सभी प्रीमियम उपन्यास और 3x ऑडियो स्पीड का पूरा आनंद लें।',
    features: [
      'सभी VIP अध्यायों तक असीमित पहुँच',
      '3x ऑडियो प्लेयर स्पीड सपोर्ट',
      'कोई विज्ञापन नहीं (Ad-Free)',
      'ऑफ़लाइन डाउनलोड और बुकमार्क्स',
      'Crazy AI सहायक से असीमित चैट'
    ],
    isActive: true,
    badgeText: 'POPULAR'
  },
  {
    id: 'plan_quarterly',
    name: 'Quarterly VIP',
    hindiName: 'त्रैमासिक वीआईपी',
    originalPrice: 249,
    price: 249,
    durationDays: 90,
    discountType: 'none',
    discountPercentage: 0,
    discountAmount: 0,
    description: '3 महीने की सदस्यता भारी छूट के साथ। लगातार पढ़ने का आनंद।',
    features: [
      '90 दिनों तक सभी VIP अध्यायों की छूट',
      '3x ऑडियो प्लेयर स्पीड',
      'प्राथमिकता हेल्प एंड सपोर्ट',
      'नए उपन्यासों का एक्सक्लूसिव अर्ली एक्सेस',
      'Crazy AI सहायक से असीमित सारांश'
    ],
    isActive: true,
    badgeText: 'BEST VALUE'
  },
  {
    id: 'plan_yearly',
    name: 'Yearly VIP',
    hindiName: 'वार्षिक वीआईपी',
    originalPrice: 799,
    price: 799,
    durationDays: 365,
    discountType: 'none',
    discountPercentage: 0,
    discountAmount: 0,
    description: 'पूरे साल का असीमित मनोरंजन। केवल ₹66 प्रति माह!',
    features: [
      'पूरे 365 दिन VIP एक्सेस',
      'सभी ऑडियोबुक्स और अध्यायों की असीमित स्ट्रीमिंग',
      'गोल्ड VIP बैज आपकी प्रोफ़ाइल पर',
      'वीआईपी कम्युनिटी और लेखक संवाद',
      '24/7 वीआईपी ग्राहक सहायता'
    ],
    isActive: true,
    badgeText: 'ULTIMATE'
  }
];

export const initialNovels: Novel[] = [
  {
    id: 'novel_1',
    title: 'Immortal Rebirth: The Sovereign Returns',
    hindiTitle: 'अमर पुनर्जन्म: सम्राट की वापसी',
    author: 'आदित्य राज (Aditya Raj)',
    description: 'लाखों वर्षों तक अमर साम्राज्य पर शासन करने के बाद, सम्राट रुद्र को उसके सबसे करीबी शिष्यों ने धोखा दिया। लेकिन ब्रह्मांडीय नियम ने उसे आधुनिक दिल्ली के एक सामान्य युवक के शरीर में पुनर्जीवित कर दिया! अब वह अपनी प्राचीन दैवीय शक्तियों और आधुनिक युग की तकनीकों से फिर से दुनिया को फतह करने निकला है।',
    coverImage: '/src/assets/images/novel_cover_immortal_rebirth_1794460891135.jpg',
    categories: ['Rebirth', 'Cultivation', 'Action', 'Modern'],
    tags: ['Rebirth', 'OP MC', 'Cultivation', 'Revenge', 'Action'],
    isPremium: true,
    isPublished: true,
    isFeatured: true,
    isTrending: true,
    isPopular: true,
    views: 48200,
    rating: 4.9,
    totalChapters: 4,
    createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'novel_2',
    title: 'The Divine Martial God of Himalayan Peaks',
    hindiTitle: 'हिमालय का दैवीय युद्ध देवता',
    author: 'विक्रम शेखावत (Vikram Shekhawat)',
    description: 'हिमालय की बर्फीली चोटियों में एक प्राचीन गुफा से निकली शक्ति ने सामान्य अनाथ बालक कबीर को मार्शल आर्ट्स का सर्वोच्च गुरु बना दिया। जब दानव कुल ने भारत की सीमा पर आक्रमण किया, तो कबीर ने अपनी स्वर्णिम तलवार उठाई। एक रोमांचक मार्शल आर्ट्स यात्रा!',
    coverImage: '/src/assets/images/novel_cover_himalayan_martial_1794460892442.jpg',
    categories: ['Martial Arts', 'Action', 'Fantasy'],
    tags: ['Martial Arts', 'Sword God', 'Himalayas', 'Epic'],
    isPremium: false,
    isPublished: true,
    isFeatured: true,
    isTrending: true,
    isPopular: true,
    views: 35100,
    rating: 4.8,
    totalChapters: 3,
    createdAt: new Date(Date.now() - 25 * 86400000).toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'novel_3',
    title: 'System of the Infinite Emperor',
    hindiTitle: 'अनंत सम्राट की प्रणाली',
    author: 'रोहित वर्मा (Rohit Verma)',
    description: 'जब दुनिया में रहस्यमयी दरारें खुलीं और डंगियन जीव बाहर आने लगे, तब अर्जुन को मिला "इन्फिनिट लेवल-अप सिस्टम"। हर सेकंड उसकी शक्ति दोगुनी हो रही थी। क्या वह पृथ्वी का रक्षक बनेगा या अकेले ही पूरी आकाशगंगा पर राज करेगा?',
    coverImage: '/src/assets/images/novel_cover_infinite_emperor_1794460892281.jpg',
    categories: ['System', 'Adventure', 'Action', 'Supernatural'],
    tags: ['System', 'Level Up', 'Monsters', 'Awakening'],
    isPremium: true,
    isPublished: true,
    isFeatured: true,
    isTrending: true,
    isPopular: false,
    views: 29800,
    rating: 4.7,
    totalChapters: 3,
    createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'novel_4',
    title: 'Shadows of Varanasi: The Aghori Mystery',
    hindiTitle: 'वाराणसी की छाया: अघोरी का रहस्य',
    author: 'प्रिया शर्मा (Priya Sharma)',
    description: 'काशी के मणिकर्णिका घाट पर आधी रात को घटती विचित्र घटनाएं और प्राचीन तंत्र मंत्र का रहस्य। एक युवा पत्रकार रिया जब इस रहस्य की पड़ताल करने जाती है, तो उसका सामना एक 500 साल पुराने अघोरी साधक से होता है जो समय के पार देख सकता है।',
    coverImage: '/src/assets/images/novel_cover_varanasi_shadows_1794460893380.jpg',
    categories: ['Mystery', 'Supernatural', 'Fantasy'],
    tags: ['Varanasi', 'Mystery', 'Supernatural', 'Aghori'],
    isPremium: false,
    isPublished: true,
    isFeatured: false,
    isTrending: false,
    isPopular: true,
    views: 41200,
    rating: 4.9,
    totalChapters: 3,
    createdAt: new Date(Date.now() - 15 * 86400000).toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'novel_5',
    title: 'Romance Under Delhi Metro Lights',
    hindiTitle: 'दिल्ली मेट्रो की रोशनी में प्यार',
    author: 'सिमरन कौर (Simran Kaur)',
    description: 'राजीव चौक की आपाधापी में एक छूटी हुई डायरी ने दो अजनबियों की किस्मत बांध दी। अरव एक महत्वाकांक्षी टेक उद्यमी और अनन्या एक चित्रकार। दिल को छू लेने वाली एक भावुक और आधुनिक प्रेम कहानी।',
    coverImage: '/src/assets/images/novel_cover_delhi_romance_1794460893612.jpg',
    categories: ['Romance', 'Modern', 'Comedy'],
    tags: ['Romance', 'Delhi', 'Modern Love', 'Heartwarming'],
    isPremium: false,
    isPublished: true,
    isFeatured: false,
    isTrending: true,
    isPopular: true,
    views: 26400,
    rating: 4.6,
    totalChapters: 2,
    createdAt: new Date(Date.now() - 12 * 86400000).toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'novel_6',
    title: 'Reborn in the Cyberpunk Multiverse',
    hindiTitle: 'साइबरपंक ब्रह्मांड में पुनर्जन्म',
    author: 'करण मल्होत्रा (Karan Malhotra)',
    description: 'वर्ष 2099 में जब कॉर्पोरेशंस का राज है और इंसान साइबरनेटिक अंगों से युक्त हैं, एक विद्रोही हैकर की मौत के बाद वह एक प्राचीन वैदिक ज्ञान वाले रोबोटिक शरीर में जागता है। साइंस और प्राचीन रहस्यों का अनूठा संगम!',
    coverImage: '/src/assets/images/novel_cover_cyberpunk_multiverse_1794460893280.jpg',
    categories: ['Action', 'Adventure', 'Modern', 'System'],
    tags: ['Cyberpunk', 'SciFi', 'Action', 'Hacking'],
    isPremium: true,
    isPublished: true,
    isFeatured: true,
    isTrending: false,
    isPopular: false,
    views: 18900,
    rating: 4.7,
    totalChapters: 2,
    createdAt: new Date(Date.now() - 8 * 86400000).toISOString(),
    updatedAt: new Date().toISOString()
  }
];

export const initialChapters: Chapter[] = [
  // Chapters for novel_1 (Immortal Rebirth)
  {
    id: 'ch_1_1',
    novelId: 'novel_1',
    chapterNumber: 1,
    title: 'अध्याय 1: सम्राट का पतन और दिल्ली में जागरण',
    content: `लाखों तारों के बीच चमकते हुए स्वर्गीय राजसिंहासन पर सम्राट रुद्र लहूलुहान खड़े थे। उनके नौ सबसे वफ़ादार शिष्यों ने उन्हें चारों तरफ से घेर रखा था।

"गुरुदेव, आपका युग समाप्त हो चुका है!" सबसे ज्येष्ठ शिष्य कालभैरव की आवाज़ में घमंड गूंज रहा था। "आपके स्वर्गीय अमर सूत्र अब हमारे होंगे!"

रुद्र ने अपने होठों से बहते रक्त को पोंछा और एक ठंडी मुस्कान बिखेरी। "तुम मूर्खों को लगता है कि तुम मेरे अस्तित्व को मिटा सकते हो? मैंने समय के प्रवाह को स्वयं बांधा है। जब मैं लौटूंगा, तो ब्रह्मांड कांप उठेगा!"

एक भीषण धमाके के साथ उनकी अमर आत्मा ने अपने शरीर को नष्ट कर दिया।

...

"अरे भाई! उठ जा, वरना कॉलेज की पहली क्लास छूट जाएगी!"

एक ज़ोरदार झटके के साथ रुद्र की आँखें खुलीं। लेकिन यह स्वर्गीय महल नहीं था। चारों तरफ सीमेंट की दीवारें, एक पुराना पंखा जो चरमराहट के साथ घूम रहा था, और सामने एक चश्मे वाला लड़का खड़ा था।

रुद्र ने अपने हाथों को देखा। ये किसी सामान्य, कमज़ोर 20 वर्षीय लड़के के हाथ थे। 

"मैं... कहाँ हूँ?" रुद्र ने भारी आवाज़ में पूछा।

"कहाँ क्या मतलब? अपने पीजी के कमरे में, करोल बाग, दिल्ली!" लड़के ने हैरान होकर कहा। "कल रात तूने इतनी पढ़ाई की कि तेरी याददाश्त ही चली गई क्या?"

रुद्र ने तुरंत अपनी आँखें बंद कीं और अपने अंतर्मन में देखा। उनकी आत्मा के केंद्र में वही प्राचीन 'अमर सम्राट सूत्र' मंद रोशनी में तैर रहा था।

'तो यह मेरी नई दुनिया है...' रुद्र के चेहरे पर एक तीखी मुस्कान आई। 'कमज़ोर शरीर है, पर आत्मा वही है। इस दुनिया के नियम जो भी हों, सम्राट हमेशा सर्वोच्च रहेगा!'`,
    isPremium: false,
    isPublished: true,
    audioDurationSeconds: 180,
    telegramMessageLink: 'https://t.me/CrazyStoryesOfficial/101',
    telegramMessageId: 101,
    telegramDestinationType: 'channel',
    telegramAudioAccessType: 'free',
    telegramAudioConfigured: true,
    createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'ch_1_2',
    novelId: 'novel_1',
    chapterNumber: 2,
    title: 'अध्याय 2: प्राचीन साँस और पहली शक्ति',
    content: `करोल बाग की उस छोटी सी बालकनी में, सुबह के चार बजे, जब पूरी दिल्ली सो रही थी, रुद्र पद्मासन में बैठे हुए थे।

चारों ओर फैली हवा में भले ही प्रदूषण था, लेकिन भोर के समय वायु में एक अत्यंत सूक्ष्म ब्रह्मांडीय ऊर्जा तैर रही थी जिसे वे 'प्राण ऊर्जा' कहते थे।

रुद्र ने अपने फेफड़ों में गहरी साँस खींची। अमर सूत्र के प्राचीन छंद उनके दिमाग में गूँजने लगे:

"प्राणं ब्रह्म, मनो ब्रह्म, ज्योतिर्मयम् अनंतम्।"

धीमे-धीमे, उनके कमज़ोर शरीर की नसें फैलने लगीं। जो मांसपेशियाँ कल तक दर्द कर रही थीं, उनमें एक गर्म लहर दौड़ने लगी। उनकी रीढ़ की हड्डी के नीचे से एक सुनहरी चमक उठी और सीधे उनके मस्तिष्क तक पहुंची।

"पहला स्तर: काया शोधन!" रुद्र ने बुदबुदाया।

तभी नीचे सड़क पर चीखने-चिल्लाने की आवाज़ आई।

तीन गुंडे एक बुजुर्ग सब्ज़ी वाले को घेर कर डरा रहे थे। "बुड्ढे! हफ्ते के पाँच हज़ार निकालेगा या तेरी दुकान तोड़ दें?"

रुद्र बालकनी से नीचे देख रहे थे। उनकी आँखों में वही स्वर्गीय सम्राट की ठंडी आग चमक उठी।

"साम्राज्य छोटा हो या बड़ा, अन्याय मेरे सामने कभी सहन नहीं होगा।"

वे बिना किसी हिचकिचाहट के बालकनी की रेलिंग लांघ कर सीधे नीचे कूद गए...`,
    isPremium: false,
    isPublished: true,
    audioDurationSeconds: 165,
    telegramMessageLink: 'https://t.me/CrazyStoryesOfficial/102',
    telegramMessageId: 102,
    telegramDestinationType: 'channel',
    telegramAudioAccessType: 'free',
    telegramAudioConfigured: true,
    createdAt: new Date(Date.now() - 28 * 86400000).toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'ch_1_3',
    novelId: 'novel_1',
    chapterNumber: 3,
    title: 'अध्याय 3 [VIP]: सम्राट का पहला मुक्का',
    content: `धम्म!

जब रुद्र दूसरी मंज़िल से सीधे कंक्रीट की सड़क पर उतरे, तो धूल का एक गुबार उठा। गुंडों का मुखिया, जिसे सब 'बिल्ला' कहते थे, हक्का-बक्का रह गया।

"तू कौन है बे? सुपरमैन बनने चला है?" बिल्ला ने लोहे की रॉड घुमाते हुए कहा।

रुद्र ने उसकी ओर एक नज़र भी नहीं देखा। वे सीधे सब्ज़ी वाले के पास गए और उसे सहारा देकर उठाया। "चाचा, आप ठीक हैं?"

"बेटा भाग जा, ये बहुत खतरनाक लोग हैं..." बूढ़े की आवाज़ कांप रही थी।

"अबे सुनता नहीं क्या!" बिल्ला ने गुस्से में लोहे की रॉड सीधे रुद्र के सिर पर दे मारी।

हवा में तेज़ आवाज़ गूंजी। लेकिन अगले ही पल जो हुआ, उसने तीनों गुंडों के होश उड़ा दिए।

रुद्र ने सिर्फ दो उंगलियों से उस भारी लोहे की रॉड को बीच हवा में पकड़ लिया था!

"तुम कीड़ों को पता भी नहीं कि तुम किसके सामने खड़े हो," रुद्र की आवाज़ किसी प्राचीन सिंह की दहाड़ जैसी थी।

उन्होंने बस अपनी उंगलियों को हल्का सा मोड़ा, और भारी लोहे की रॉड मक्खन की तरह मुड़ गई।

बिल्ला के हाथ कांपने लगे। "तू... तू इंसान है या राक्षस?"

"मैं वह हूँ जिसे मौत भी नहीं रोक सकी," रुद्र ने एक कदम आगे बढ़ाया। उनका एक मुक्का हवा को चीरते हुए बिल्ला के पेट पर लगा। एक सेकंड के अंदर बिल्ला हवा में पाँच फीट उछला और सीधे कूड़ेदान में जा गिरा।

बाकी दोनों गुंडे अपनी चप्पलें छोड़कर उल्टे पैर भागे।

रुद्र ने मुड़े हुए लोहे को सड़क पर फेंका। यह तो बस शुरुआत थी। उन्हें जल्द ही इस शहर के असली धुरंधरों से मिलना था।`,
    isPremium: true,
    isPublished: true,
    audioDurationSeconds: 210,
    telegramMessageLink: 'https://t.me/c/2147483648/103',
    telegramMessageId: 103,
    telegramChatId: '-1002147483648',
    telegramDestinationType: 'channel',
    telegramAudioAccessType: 'premium',
    telegramAudioConfigured: true,
    createdAt: new Date(Date.now() - 26 * 86400000).toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'ch_1_4',
    novelId: 'novel_1',
    chapterNumber: 4,
    title: 'अध्याय 4 [VIP]: दिल्ली का गुप्त अंडरवर्ल्ड',
    content: `बिल्ला को पीटने की खबर आग की तरह पूरे इलाके में फैल गई। लेकिन रुद्र के लिए यह कोई बड़ी बात नहीं थी।

उन्हें अपनी आध्यात्मिक साधना के लिए दुर्लभ जड़ी-बूटियों और रत्नों की आवश्यकता थी। और इसके लिए उन्हें पैसे चाहिए थे।

"चांदनी चौक का कटरिया बाज़ार..." रुद्र ने अपने फोन में मैप देखा। इंटरनेट सचमुच एक अद्भुत चीज़ थी। प्राचीन काल में उन्हें गुप्त बाज़ारों का पता लगाने के लिए महीनों भटकना पड़ता था।

जब वे कटरिया बाज़ार की एक पुरानी हवेली में पहुंचे, तो वहां एक गुप्त नीलामी चल रही थी।

वहां दिल्ली के बड़े-बड़े रईस, प्राचीन कलाकृतियों के तस्कर और कुछ ऐसे लोग भी मौजूद थे जिनके शरीर से हल्की तांत्रिक ऊर्जा निकल रही थी।

नीलामी के मंच पर एक कांच का बक्सा रखा गया। उसमें एक काला पत्थर था जिस पर लाल रेखाएं चमक रही थीं।

नीलामीकर्ता ने कहा, "यह पत्थर कैलाश मानसरोवर की तलहटी से मिला है। इसकी शुरुआती बोली एक करोड़ रुपये है!"

भीड़ में हलचल मच गई।

लेकिन रुद्र की आँखें चौड़ी हो गईं। वह कोई साधारण पत्थर नहीं था। वह था 'ब्रह्मांडीय रक्त रत्न'—एक ऐसा रत्न जिसकी मदद से वे अपने शरीर को सीधे तीसरे स्तर पर ले जा सकते थे!

पर समस्या यह थी कि रुद्र की जेब में सिर्फ 250 रुपये थे...`,
    isPremium: true,
    isPublished: true,
    audioDurationSeconds: 195,
    createdAt: new Date(Date.now() - 24 * 86400000).toISOString(),
    updatedAt: new Date().toISOString()
  },

  // Chapters for novel_2 (Divine Martial God)
  {
    id: 'ch_2_1',
    novelId: 'novel_2',
    chapterNumber: 1,
    title: 'अध्याय 1: कड़कड़ाती ठंड और गुफा का रहस्य',
    content: `बर्फ़ानी तूफ़ान ऐसा था कि एक हाथ आगे कुछ दिखाई नहीं दे रहा था। सत्रह वर्षीय कबीर अपनी जान बचाने के लिए एक संकरी दरार में घुस गया।

वहाँ अचानक ज़मीन धंस गई और कबीर सैकड़ों फीट नीचे एक प्राचीन भूमिगत कक्ष में जा गिरा।

जब उसे होश आया, तो उसके सामने भगवान शिव की एक विशाल मूर्ति थी जिसके हाथ में एक नीले रंग का त्रिशूल था जो अलौकिक ज्योति से जल रहा था।

मूर्ति के चरणों में एक तांबे का पात्र था जिसमें एक प्राचीन भोजपत्र रखा हुआ था।

कबीर ने कांपते हाथों से उस पत्र को उठाया। उस पर संस्कृत में लिखा था: "रुद्र-मार्शल आर्ट्स—परम मुक्ति और अजेय बल।"

जैसे ही कबीर ने उसे छुआ, वह भोजपत्र स्वर्णिम प्रकाश में बदल गया और सीधे उसकी छाती में समा गया!`,
    isPremium: false,
    isPublished: true,
    audioDurationSeconds: 150,
    createdAt: new Date(Date.now() - 25 * 86400000).toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'ch_2_2',
    novelId: 'novel_2',
    chapterNumber: 2,
    title: 'अध्याय 2: अजेय वज्र मुट्ठी',
    content: `तीन महीने बीत चुके थे। कबीर उस गुफा में साधना कर रहा था।

जब वह बाहर निकला, तो उसकी आँखें बिजली की तरह चमक रही थीं। उसने सामने खड़े एक विशाल पाषाण खंड की ओर देखा।

उसने अपनी मुट्ठी बांधी। उसकी नसों में नीली बिजली दौड़ने लगी।

"वज्र प्रहार!"

कबीर का घूसा उस दस टन के पत्थर से टकराया। एक सेकंड की शांति के बाद, वह पूरा पत्थर बारूद की तरह टुकड़ों-टुकड़ों में बिखर गया!

"अब समय आ गया है गाँव लौटने का..." कबीर ने मुस्कराते हुए कहा।`,
    isPremium: false,
    isPublished: true,
    audioDurationSeconds: 140,
    createdAt: new Date(Date.now() - 23 * 86400000).toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'ch_2_3',
    novelId: 'novel_2',
    chapterNumber: 3,
    title: 'अध्याय 3 [VIP]: घाटी पर दानवों का हमला',
    content: `जब कबीर अपने गाँव की घाटी में पहुंचा, तो धुआं और चीखें आसमान छू रही थीं।

उत्तरी दर्रे से आए जंगली भेड़िया-राक्षसों ने गाँव की रक्षा दीवार तोड़ दी थी। गाँव के मुखिया अपने कुल्हाड़े से लड़ते हुए लहूलुहान हो चुके थे।

"कोई नहीं बचेगा!" राक्षस सरदार ने अट्टहास किया।

तभी आसमान से नीली बिजली का एक कौंधा गिरा। कबीर सरदार और मुखिया के बीच प्रकट हुआ।

सरदार ने अपनी खूनी तलवार चलाई, लेकिन कबीर की एक उंगली के छूने मात्र से वह तलवार तिनके की तरह टूट गई।

"मेरी जन्मभूमि पर कदम रखने की हिम्मत कैसे हुई तुम्हारी?" कबीर की आँखें दहक उठीं...`,
    isPremium: true,
    isPublished: true,
    audioDurationSeconds: 175,
    createdAt: new Date(Date.now() - 21 * 86400000).toISOString(),
    updatedAt: new Date().toISOString()
  },

  // Chapters for novel_3 (System of Infinite Emperor)
  {
    id: 'ch_3_1',
    novelId: 'novel_3',
    chapterNumber: 1,
    title: 'अध्याय 1: नीली स्क्रीन का प्रकट होना',
    content: `[डिंग! बधाई हो होस्ट! आपको 'अनंत सम्राट प्रणाली' (Infinite Emperor System) प्राप्त हुई है!]
[होस्ट का नाम: अर्जुन]
[स्तर: 1]
[शक्ति: 10]
[गति: 8]
[विशेष क्षमता: निष्क्रिय आय — प्रति मिनट +10 अनुभव अंक]

अर्जुन ने अपनी आँखें मलीं। क्या वह बहुत ज्यादा वीडियो गेम खेल रहा था?

पर जब उसने सामने पड़े भारी टेबल को एक हाथ से उठा लिया, तो उसे समझ आ गया कि यह कोई सपना नहीं था। दुनिया बदलने वाली थी, और वह सबसे आगे था!`,
    isPremium: false,
    isPublished: true,
    audioDurationSeconds: 130,
    createdAt: new Date(Date.now() - 20 * 86400000).toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'ch_3_2',
    novelId: 'novel_3',
    chapterNumber: 2,
    title: 'अध्याय 2: पहला कालकोठरी मिशन',
    content: `[अलर्ट! आपके क्षेत्र से 500 मीटर की दूरी पर 'ई-रैंक' कालकोठरी खुली है!]
[मिशन: 10 गोबलिन को समाप्त करें।]
[इनाम: इस्पात की तलवार, 500 अनुभव अंक, 10,000 नकद रुपये।]

अर्जुन ने अपनी जैकेट की ज़िप कसी। रात के बारह बजे, वह बंद पड़े मेट्रो स्टेशन के बेसमेंट की ओर चल पड़ा। वहां हवा में एक बैंगनी रंग का भंवर घूम रहा था...`,
    isPremium: false,
    isPublished: true,
    audioDurationSeconds: 145,
    createdAt: new Date(Date.now() - 18 * 86400000).toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'ch_3_3',
    novelId: 'novel_3',
    chapterNumber: 3,
    title: 'अध्याय 3 [VIP]: बॉस की चुनौती — लाल दानव',
    content: `कालकोठरी की गहराई में तापमान 50 डिग्री तक पहुंच चुका था।

सामने खड़ा था 12 फीट लंबा 'लाल दानव' जिसके सिर पर दो घुमावदार सींग थे और हाथ में आग उगलती गदा।

[चेतावनी: बॉस स्तर 15! आपकी मौजूदा क्षमता से तीन गुना अधिक!]
[सिस्टम सुझाव: पलायन करें!]

अर्जुन के चेहरे पर एक उन्मादी मुस्कान खिल उठी। "पलायन? सम्राट कभी पीछे नहीं हटते! सिस्टम, मेरी सारी आरक्षित शक्तियां सक्रिय करो!"

[डिंग! 'सम्राट का क्रोध' सक्रिय! अगले 60 सेकंड के लिए सभी गुण 500% बढ़ेंगे!]`,
    isPremium: true,
    isPublished: true,
    audioDurationSeconds: 185,
    createdAt: new Date(Date.now() - 16 * 86400000).toISOString(),
    updatedAt: new Date().toISOString()
  },

  // Chapters for novel_4 (Shadows of Varanasi)
  {
    id: 'ch_4_1',
    novelId: 'novel_4',
    chapterNumber: 1,
    title: 'अध्याय 1: मणिकर्णिका की रात',
    content: `गंगा की लहरों पर चिताओं का प्रतिबिम्ब नाच रहा था। रात के दो बजे रिया अपने कैमरे के लेंस को ठीक कर रही थी।

तभी उसे एक परछाई दिखाई दी जो चिता की राख के बीच ध्यान लगाए बैठी थी। उसके चारों ओर एक धुंधली नीली आभा थी जिसे साधारण आँखों से नहीं देखा जा सकता था।

जैसे ही रिया ने क्लिक दबाया, वह अघोरी अचानक अपनी जगह से गायब हो गया।

और ठीक अगले ही पल, उसके कान के पास एक गंभीर आवाज़ आई: "बेटी, इन छायाओं को कैमरे में कैद नहीं किया जा सकता..."`,
    isPremium: false,
    isPublished: true,
    audioDurationSeconds: 140,
    createdAt: new Date(Date.now() - 15 * 86400000).toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'ch_4_2',
    novelId: 'novel_4',
    chapterNumber: 2,
    title: 'अध्याय 2: समय के पार का दर्शन',
    content: `रिया का दिल हलक में आ गया था। उसने मुड़कर देखा। सामने राख लपेटे एक तेजस्वी साधु खड़े थे जिनकी आँखें ब्रह्मांड के रहस्यों जैसी गहरी थीं।

"आप... आप कौन हैं?" रिया ने कांपती आवाज़ में पूछा।

"लोग मुझे कालनाथ कहते हैं। लेकिन तुम यहाँ पत्रकारिता के लिए नहीं आई हो। तुम्हारी आत्मा सदियों पुरानी प्रतिज्ञा को पूरा करने आई है," अघोरी ने कहा और गंगा के जल की कुछ बूंदें रिया के माथे पर छिड़क दीं।

और पलक झपकाते ही रिया की आँखों के सामने 500 साल पुराना बनारस जीवंत हो उठा...`,
    isPremium: false,
    isPublished: true,
    audioDurationSeconds: 155,
    createdAt: new Date(Date.now() - 14 * 86400000).toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'ch_4_3',
    novelId: 'novel_4',
    chapterNumber: 3,
    title: 'अध्याय 3 [VIP]: भूमिगत शिव मंदिर',
    content: `घाटों के नीचे एक भूलभुलैया थी जो आज के नक्शों में दर्ज नहीं थी।

कालनाथ रिया को एक गुप्त सीढ़ी से नीचे ले गए जहाँ सहस्त्रों वर्ष पुरानी मूर्तियाँ दीपों की रोशनी में दमक रही थीं।

"यहाँ विश्राम करता है 'चंद्रमणि शिवलिंग'। और आज रात, विदेशी तस्करों का एक गिरोह इसे चुराने आ रहा है," कालनाथ ने कहा।

सीढ़ियों पर भारी जूतों की आवाज़ गूँजने लगी...`,
    isPremium: true,
    isPublished: true,
    audioDurationSeconds: 165,
    createdAt: new Date(Date.now() - 13 * 86400000).toISOString(),
    updatedAt: new Date().toISOString()
  },

  // Chapters for novel_5 (Romance Under Delhi Metro Lights)
  {
    id: 'ch_5_1',
    novelId: 'novel_5',
    chapterNumber: 1,
    title: 'अध्याय 1: येलो लाइन और छूटी हुई डायरी',
    content: `शाम के सात बजे राजीव चौक का इंटरचेंज किसी समंदर जैसा था।

अनन्या की लेदर कवर वाली स्केचबुक गलती से बेंच पर छूट गई जब वह हुडा सिटी सेंटर जाने वाली ट्रेन में धक्का-मुक्की के बीच घुसी।

अरव, जो अपने लैपटॉप बैग को संभाले वहीं खड़ा था, उसकी नज़र उस नीली डायरी पर पड़ी। जब उसने उसे उठाया और पहला पन्ना खोला, तो उसमें मेट्रो में सफ़र करते हुए अलग-अलग लोगों के बेहद खूबसूरत पेंसिल स्केच थे।

और आखिरी स्केच... अरव का खुद का था! नीचे लिखा था: "द सीरियस कोडर एट कश्मीरी गेट।"

अरव के चेहरे पर अनायास एक मुस्कान आ गई।`,
    isPremium: false,
    isPublished: true,
    audioDurationSeconds: 120,
    createdAt: new Date(Date.now() - 12 * 86400000).toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'ch_5_2',
    novelId: 'novel_5',
    chapterNumber: 2,
    title: 'अध्याय 2: हौज खास विलेज की मुलाक़ात',
    content: `डायरी के पिछले कवर पर एक छोटा सा इंस्टाग्राम हैंडल लिखा था: @ananya_sketches.

अरव ने तीन दिन तक सोचा, फिर एक साधारण मैसेज भेजा: "आपकी डायरी मेरे पास सुरक्षित है। और हाँ, मेरा लैपटॉप कोड नहीं, उपन्यास लिख रहा था!"

हौज खास विलेज के एक रूफटॉप कैफ़े में जब दोनों मिले, तो दिल्ली की शाम में एक अलग ही नशा था...`,
    isPremium: false,
    isPublished: true,
    audioDurationSeconds: 135,
    createdAt: new Date(Date.now() - 11 * 86400000).toISOString(),
    updatedAt: new Date().toISOString()
  },

  // Chapters for novel_6 (Reborn in Cyberpunk Multiverse)
  {
    id: 'ch_6_1',
    novelId: 'novel_6',
    chapterNumber: 1,
    title: 'अध्याय 1: नियो-मुंबई 2099',
    content: `नियोन लाइटों से नहाई नियो-मुंबई की सड़कें और उड़ती हुई टैक्सियां।

अयान की साइबरनेटिक आँखों में डेटा की धारा बह रही थी। वह सिंडिकेट के मेनफ्रेम से सबसे गुप्त डेटा चुरा रहा था।

"कोड 404: आत्मा स्थानांतरित हो रही है..."

जब उसने अपनी आँखें खोलीं, तो उसका शरीर टाइटेनियम और सोने की मिश्रधातु से बना था, और उसके सीने पर गायत्री मंत्र का एक डिजिटल सर्किट धड़क रहा था!`,
    isPremium: false,
    isPublished: true,
    audioDurationSeconds: 130,
    createdAt: new Date(Date.now() - 8 * 86400000).toISOString(),
    updatedAt: new Date().toISOString()
  },
  {
    id: 'ch_6_2',
    novelId: 'novel_6',
    chapterNumber: 2,
    title: 'अध्याय 2 [VIP]: क्वांटम तलवार की गूँज',
    content: `सिंडिकेट के साइबर-निंजा उसे चारों तरफ से घेर चुके थे।

"यह प्रोटोटाइप रोबोट सिंडिकेट की संपत्ति है! आत्मसमर्पण करो!"

अयान ने अपनी कलाई घुमाई। उसकी हथेली से एक नैनो-प्लाज्मा तलवार निकली जो प्राचीन संस्कृत श्लोक की आवृत्ति पर कंपन कर रही थी।

"संपत्ति? मैं इस पूरे डिजिटल ग्रिड का भगवान हूँ!"`,
    isPremium: true,
    isPublished: true,
    audioDurationSeconds: 160,
    createdAt: new Date(Date.now() - 7 * 86400000).toISOString(),
    updatedAt: new Date().toISOString()
  }
];


export const initialUsers: User[] = [
  {
    "id": "usr_1793803206715_jrunq",
    "name": "Aman Reader",
    "email": "aman@test.com",
    "passwordHash": "$2b$10$uzUPSmOrGFrFUcj6xvhqhOMJeAES4OqRQoPo8BQ8aupQdH1Qxvp5y",
    "role": "reader",
    "isBlocked": false,
    "membership": {
      "isActive": false
    },
    "bookmarks": [],
    "readingHistory": [],
    "createdAt": "2026-11-04T14:40:06.715Z"
  },
  {
    "id": "admin_1793806491458",
    "name": "brijesh",
    "email": "divinecult2007@gmail.com",
    "passwordHash": "$2b$10$fpK/KiX86BltXSKM6VHiwOLrp4VQsgXbT33X7R7CxA2efeE3U4x66",
    "role": "admin",
    "isBlocked": false,
    "membership": {
      "isActive": true,
      "planName": "Owner VIP"
    },
    "bookmarks": [],
    "readingHistory": [],
    "createdAt": "2026-11-04T15:34:51.458Z"
  }
];
