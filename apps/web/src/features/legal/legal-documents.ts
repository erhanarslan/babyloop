import { LEGAL_DOCUMENT_VERSIONS } from "@babyloop/shared";

export const LEGAL_DOCUMENT_SLUGS = [
  "privacy",
  "kvkk",
  "terms",
  "cookies",
  "ai-notice",
  "marketplace",
  "data-deletion"
] as const;

export type LegalDocumentSlug = typeof LEGAL_DOCUMENT_SLUGS[number];

export type LegalSection = {
  body?: string[];
  bullets?: string[];
  title: string;
};

export type LegalDocument = {
  description: string;
  eyebrow: string;
  sections: LegalSection[];
  slug: LegalDocumentSlug;
  title: string;
  version: string;
};

export const LEGAL_DOCUMENTS: Record<LegalDocumentSlug, LegalDocument> = {
  privacy: {
    slug: "privacy",
    eyebrow: "Gizlilik",
    title: "Gizlilik Politikası",
    description: "BabyLoop'ta hangi veri gruplarının neden işlendiğini ve hangi güvenlik sınırlarının uygulandığını açıklar.",
    version: LEGAL_DOCUMENT_VERSIONS.privacy,
    sections: [
      {
        title: "Kapsam",
        body: [
          "Bu politika BabyLoop web sitesi, mobil uygulaması, pazaryeri, mesajlaşma, çocuk profili/not/hatırlatıcı, bildirim, yapay zekâ asistanı ve destek süreçleri için genel gizlilik çerçevesini açıklar.",
          "İşleme faaliyetine özgü zorunlu bilgiler KVKK Aydınlatma Metni'nde ayrıca sunulur. Gizlilik politikası, aydınlatma metninin veya gerekli olduğu yerde açık rızanın yerine geçmez."
        ]
      },
      {
        title: "İşlenen veri grupları",
        bullets: [
          "Hesap ve iletişim: ad/görünen ad, e-posta, doğrulama ve hesap güvenliği kayıtları.",
          "Pazaryeri: ilan, ürün görseli, fiyat, kategori, şehir, favori, sepet ve işlem durumu.",
          "Mesajlaşma ve güvenlik: konuşma içerikleri, raporlar, engelleme ve moderasyon kayıtları.",
          "Çocuk profili: ebeveynin girdiği etiket, yaklaşık yaş/bant, not ve hatırlatıcılar. BabyLoop çocukların bağımsız kullanımına yönelik değildir.",
          "Teknik/operasyonel: oturum, cihaz, IP, hata, güvenlik, worker ve denetim kayıtları.",
          "İsteğe bağlı analitik: yalnızca kullanıcının web analitik tercihi açık olduğunda anonim/psödonim oturum ve ürün etkileşim olayları."
        ]
      },
      {
        title: "Paylaşım ve saklama",
        body: [
          "Veriler yalnızca hizmetin sunulması, güvenlik, destek, mevzuata uyum ve açıkça belirtilen işleme amaçları için yetkili hizmet sağlayıcılarla sınırlı olarak paylaşılabilir. Satıcı/alıcıya açık profil alanları ve mesaj içerikleri ilgili pazaryeri işlevi kapsamında görünür.",
          "Saklama süreleri işleme amacı, sözleşme ilişkisi, güvenlik ihtiyacı ve yasal yükümlülüklere göre belirlenir. Hesap silme sonrasında zorunlu olmayan veriler silinir veya anonimleştirilir; hukuki yükümlülük ya da hakkın tesisi/kullanılması için gerekli sınırlı kayıtlar daha uzun tutulabilir."
        ]
      },
      {
        title: "Güvenlik ve çocuk verileri",
        body: [
          "BabyLoop erişim kontrolü, şifreleme/secret yönetimi, redaksiyon, denetim kaydı, yedekleme, restore doğrulaması ve güvenli geliştirme kontrolleri uygular. Hiçbir çevrim içi sistem mutlak güvenlik garantisi veremez.",
          "Çocuk profili bilgilerini yalnızca ebeveyn veya yasal temsilci girmelidir. Tıbbi tanı, tedavi veya gereksiz özel nitelikli veri girmeyin."
        ]
      }
    ]
  },
  kvkk: {
    slug: "kvkk",
    eyebrow: "6698 sayılı Kanun",
    title: "KVKK Aydınlatma Metni",
    description: "Kişisel verilerin elde edilmesi sırasında veri sorumlusunu, amaçları, aktarımı, yöntemi, hukuki sebepleri ve hakları açıklar.",
    version: LEGAL_DOCUMENT_VERSIONS.kvkkNotice,
    sections: [
      {
        title: "Veri sorumlusu",
        body: [
          "BabyLoop hizmetinin yayın ortamında gösterilen işletmeci adı veri sorumlusudur. Kimlik, iletişim e-postası ve başvuru adresi bu sayfanın üst bölümündeki 'Veri sorumlusu bilgileri' alanında yer alır. Bu bilgiler gerçek kişi veya tüzel kişi işletmeci tarafından production yayını öncesinde doğru ve güncel şekilde yapılandırılmalıdır."
        ]
      },
      {
        title: "İşleme amaçları",
        bullets: [
          "Hesap oluşturma, kimlik doğrulama, oturum ve güvenlik işlemlerini yürütmek.",
          "İlan, favori, mesaj, sepet, bildirim, çocuk profili/not/hatırlatıcı ve destek özelliklerini sunmak.",
          "Dolandırıcılık, kötüye kullanım, güvenlik olayı, moderasyon ve uyuşmazlık süreçlerini yönetmek.",
          "Yedekleme, hata izleme, hizmet sürekliliği ve performans operasyonlarını yürütmek.",
          "Kullanıcı açık tercih verdiğinde ürün analitiği üretmek.",
          "Hukuki yükümlülükleri yerine getirmek ve hakların tesisi, kullanılması veya korunmasını sağlamak."
        ]
      },
      {
        title: "Toplama yöntemi ve hukuki sebepler",
        body: [
          "Veriler web/mobil formları, API istekleri, çerez/yerel depolama tercihleri, cihaz/oturum kayıtları, kullanıcı içerikleri ve destek iletişimi üzerinden tamamen veya kısmen otomatik yollarla elde edilir.",
          "İşleme; sözleşmenin kurulması veya ifası için gerekli olma, veri sorumlusunun hukuki yükümlülüğü, bir hakkın tesisi/kullanılması/korunması, temel hak ve özgürlüklere zarar vermemek kaydıyla meşru menfaat ve yalnızca gerekli olduğu faaliyetlerde açık rıza şartlarına dayanabilir. Zorunlu olmayan analitik, uygun başka bir işleme şartı yoksa aktif tercihle verilen açık rızaya dayanır."
        ]
      },
      {
        title: "Aktarım ve alıcı grupları",
        bullets: [
          "Barındırma, veritabanı, obje depolama, e-posta, bildirim, hata izleme ve güvenlik hizmeti sağlayıcıları.",
          "İlan ve mesaj işlevinin gerektirdiği ölçüde diğer kullanıcılar.",
          "Yasal talep halinde yetkili kamu kurumları, mahkemeler ve kolluk birimleri.",
          "Hakların korunması için avukat, denetçi ve uzman danışmanlar."
        ]
      },
      {
        title: "KVKK madde 11 kapsamındaki haklar",
        bullets: [
          "Kişisel verinizin işlenip işlenmediğini öğrenme ve işlenmişse bilgi talep etme.",
          "İşleme amacını ve amaca uygun kullanılıp kullanılmadığını öğrenme.",
          "Yurt içinde veya yurt dışında aktarılan üçüncü kişileri bilme.",
          "Eksik veya yanlış işlenen verilerin düzeltilmesini isteme.",
          "Şartları oluştuğunda silme/yok etme ve bu işlemlerin aktarılan üçüncü kişilere bildirilmesini isteme.",
          "Münhasıran otomatik sistemlerle analiz sonucu aleyhe bir sonuca itiraz etme.",
          "Kanuna aykırı işleme nedeniyle zarara uğramanız halinde giderim talep etme."
        ]
      },
      {
        title: "Başvuru",
        body: [
          "Talebinizi kimliğinizi doğrulamaya elverişli bilgilerle veri sorumlusu iletişim e-postasına veya başvuru adresine iletebilirsiniz. Güvenlik için ek doğrulama istenebilir. Hesap içi veri silme işlemi Hesap > Profil > Hesabı sil alanından da başlatılabilir."
        ]
      }
    ]
  },
  terms: {
    slug: "terms",
    eyebrow: "Sözleşme",
    title: "Kullanım Koşulları",
    description: "BabyLoop hesabı, pazaryeri, mesajlaşma, asistan ve beta özelliklerinin kullanım kurallarını belirler.",
    version: LEGAL_DOCUMENT_VERSIONS.terms,
    sections: [
      {
        title: "Hizmetin niteliği",
        body: [
          "BabyLoop ebeveynler için ikinci el pazaryeri, iletişim, çocuk not/hatırlatıcı ve bilgi asistanı araçları sunan bir teknoloji platformudur. Platform ürünlerin satıcısı, sağlık hizmeti sağlayıcısı veya taraflar arasındaki fiziksel teslimatın garantörü değildir.",
          "Beta dönemindeki özellikler değişebilir, geçici olarak durabilir veya kaldırılabilir. Önemli sözleşme değişiklikleri yeni sürüm numarası ve uygun bildirimle sunulur."
        ]
      },
      {
        title: "Hesap ve yaş sınırı",
        bullets: [
          "Hesap sahibi en az 18 yaşında olmalı ve doğru iletişim bilgisi sağlamalıdır.",
          "Hesap güvenliği, cihaz erişimi ve şifrenin korunması kullanıcı sorumluluğundadır.",
          "BabyLoop çocukların doğrudan/bağımsız kullanımına yönelik değildir; çocuk profili yalnızca ebeveyn veya yasal temsilci tarafından yönetilmelidir."
        ]
      },
      {
        title: "İlan ve mesaj kuralları",
        bullets: [
          "Yasak, tehlikeli, sahte, çalıntı, geri çağrılmış veya hukuka aykırı ürün yayımlanamaz.",
          "Ürün durumu, güvenlik geçmişi, eksik parça ve kusurlar açıkça belirtilmelidir.",
          "Taciz, tehdit, dolandırıcılık, kişisel veri ifşası ve platform güvenliğini aşmaya yönelik davranış yasaktır.",
          "BabyLoop içerikleri otomatik veya manuel inceleyebilir; ihlal halinde içeriği sınırlayabilir, kaldırabilir veya hesabı askıya alabilir."
        ]
      },
      {
        title: "Ödeme ve işlem durumu",
        body: [
          "Şirket ve gerçek ödeme kuruluşu entegrasyonu etkinleştirilene kadar checkout/ödeme ekranları simülasyon niteliğindedir; gerçek para tahsilatı yapılmaz. Gerçek ödeme etkinleştirildiğinde sağlayıcı, ücret, komisyon, cayma/iade ve mesafeli sözleşme bilgileri işlemden önce ayrıca gösterilir."
        ]
      },
      {
        title: "Sorumluluk sınırları",
        body: [
          "Kullanıcılar ürünün mevzuata, güvenlik standartlarına ve ilan açıklamasına uygunluğunu bağımsız olarak kontrol etmelidir. Özellikle oto koltuğu, beşik, taşıyıcı ve elektrikli ürünlerde seri numarası, geri çağırma, kullanım süresi ve hasar geçmişi kontrol edilmelidir.",
          "Asistan yanıtları genel bilgi ve alışveriş kontrol listesi sunar; tanı, tedavi, ilaç, kişisel sağlık veya profesyonel hukuk/finans hizmeti değildir. Acil veya yüksek riskli durumda yetkili uzmana başvurulmalıdır."
        ]
      },
      {
        title: "Fesih ve uyuşmazlık",
        body: [
          "Kullanıcı hesabını uygulamadaki hesap silme akışıyla kapatabilir. BabyLoop ağır ihlal, güvenlik riski veya hukuki zorunluluk halinde erişimi sınırlayabilir. Emredici tüketici ve veri koruma hakları saklıdır. Uygulanacak hukuk ve yetkili merci, işletmecinin gerçek hukuki statüsü ve kullanıcının emredici hakları dikkate alınarak belirlenir."
        ]
      }
    ]
  },
  cookies: {
    slug: "cookies",
    eyebrow: "Tercihler",
    title: "Çerez ve Yerel Depolama Politikası",
    description: "Zorunlu oturum/güvenlik kayıtları ile isteğe bağlı analitik tercihlerinin ayrımını açıklar.",
    version: LEGAL_DOCUMENT_VERSIONS.cookies,
    sections: [
      {
        title: "Zorunlu teknolojiler",
        body: [
          "Kimlik doğrulama, CSRF koruması, OAuth state, dil/tema/şehir tercihi ve güvenlik için gerekli çerezler veya yerel depolama kayıtları hizmetin talep edilen işlevini sunmak amacıyla kullanılabilir. Bunlar reklam veya davranışsal profilleme amacıyla kullanılmaz."
        ],
        bullets: [
          "HttpOnly erişim/yenileme oturum çerezleri: hesap oturumunu güvenli tutmak.",
          "CSRF ve OAuth state kayıtları: yetkisiz istek ve giriş sahteciliğini önlemek.",
          "Tema, dil ve şehir tercihi: kullanıcının açıkça seçtiği arayüz tercihini hatırlamak.",
          "Çerez/analitik tercih kaydı: aynı tercihi tekrar sormamak."
        ]
      },
      {
        title: "İsteğe bağlı analitik",
        body: [
          "BabyLoop birinci taraf ürün analitiğini yalnızca 'Analitiğe izin ver' tercihi açık olduğunda başlatır. Varsayılan durum kapalıdır. Kabul et ve reddet seçenekleri eşit erişilebilirlikte sunulur. Tercih daha sonra footer'daki 'Çerez tercihleri' düğmesinden değiştirilebilir.",
          "Analitik açıkken anonim/psödonim kimlik, oturum, sayfa/ekran, süre kovası ve ürün etkileşim olayları işlenebilir. Form metinleri, mesaj gövdeleri, sağlık bilgileri, şifreler, tokenlar veya ham çocuk notları analitik özelliği olarak gönderilmez."
        ]
      },
      {
        title: "Tercihi değiştirme",
        body: [
          "Analitiği reddettiğinizde yeni analitik olaylar üretilmez ve tarayıcıdaki BabyLoop analitik anonim kimliği/oturum kaydı temizlenir. Zorunlu güvenlik kayıtları hizmetin çalışması için devam eder. Tarayıcı ayarlarından tüm depolamayı silmeniz oturumu ve tercihleri de sıfırlayabilir."
        ]
      }
    ]
  },
  "ai-notice": {
    slug: "ai-notice",
    eyebrow: "Yapay zekâ",
    title: "Yapay Zekâ ve Asistan Bildirimi",
    description: "Asistanın kapsamını, veri sınırlarını, kaynak/grounding göstergelerini ve insan kontrolünü açıklar.",
    version: LEGAL_DOCUMENT_VERSIONS.aiNotice,
    sections: [
      {
        title: "Asistan ne yapar?",
        body: [
          "BabyLoop Asistan ürün seçimi, güvenli alışveriş kontrol listeleri, ebeveynlik bilgi kaynaklarının bulunması ve ilan taslağı hazırlama gibi sınırlı amaçlarla yapay zekâ kullanabilir. Yanıt ekranında mümkün olduğunda kaynak, grounding durumu ve kullanılan araçlar gösterilir."
        ]
      },
      {
        title: "Yapmadıkları",
        bullets: [
          "Tıbbi tanı, tedavi, ilaç dozu, kişisel diyet veya acil durum yönlendirmesi üretmez.",
          "Bir ürünün kesin güvenli, mevzuata uygun veya kusursuz olduğunu garanti etmez.",
          "Kullanıcı onayı olmadan ilanı yayımlamaz veya kritik hesap işlemi gerçekleştirmez.",
          "Mesaj, şifre, token veya gereksiz çocuk verisini analitik amacıyla kullanmaz."
        ]
      },
      {
        title: "Doğruluk ve insan kontrolü",
        body: [
          "Yapay zekâ çıktıları eksik, güncel olmayan veya hatalı olabilir. Kullanıcı ürün etiketi, üretici talimatı, geri çağırma kaydı ve yetkili uzman bilgisini ayrıca kontrol etmelidir. AI taslakları yayımlanmadan önce kullanıcı tarafından gözden geçirilir ve düzenlenebilir."
        ]
      },
      {
        title: "Veri kullanımı",
        body: [
          "Asistana yazılan soru, güvenli yanıt üretmek, kötüye kullanımı önlemek ve teknik hata incelemesi için sınırlı süreyle işlenebilir. Üretim sağlayıcısına gönderilecek içerik veri minimizasyonu ve redaksiyon kontrollerinden geçirilir. Sağlık, kimlik, iletişim veya çocuk hakkında gereksiz hassas bilgi paylaşmayın."
        ]
      }
    ]
  },
  marketplace: {
    slug: "marketplace",
    eyebrow: "Pazaryeri güveni",
    title: "Pazaryeri ve Güvenli Alışveriş Bildirimi",
    description: "BabyLoop'un aracı platform rolünü, kullanıcı sorumluluklarını ve beta ödeme sınırını açıklar.",
    version: LEGAL_DOCUMENT_VERSIONS.marketplace,
    sections: [
      {
        title: "Aracı platform",
        body: [
          "BabyLoop kullanıcıların ilan yayımlamasını, keşfetmesini ve iletişim kurmasını sağlar. Aksi açıkça belirtilmedikçe ürünlerin sahibi veya satıcısı BabyLoop değildir; ürün açıklamasının doğruluğu ve teslimat tarafların sorumluluğundadır."
        ]
      },
      {
        title: "Yüksek riskli ürün kontrolü",
        bullets: [
          "Oto koltuğunda kaza geçmişi, üretim/son kullanım tarihi, seri numarası ve geri çağırma kaydını doğrulayın.",
          "Beşik ve uyku ürünlerinde güncel güvenli uyku yönergelerini ve ürün açıklıklarını kontrol edin.",
          "Elektrikli ürünlerde kablo, batarya, adaptör ve yetkili standart işaretlerini kontrol edin.",
          "Hijyenik veya kişisel kullanım ürünlerinde ikinci el kullanımın uygunluğunu ayrıca değerlendirin.",
          "Şüpheli ilanı raporlayın; platform dışı ödeme, kimlik veya doğrulama kodu paylaşmayın."
        ]
      },
      {
        title: "Görsel ve içerik moderasyonu",
        body: [
          "İlan görselleri ve metinleri yasaklı ürün, uygunsuz içerik, kişisel veri veya güvenlik riski bakımından otomatik/manuel incelemeye alınabilir. İnceleme, ürünün gerçek güvenliğine ilişkin garanti değildir."
        ]
      },
      {
        title: "Ödeme simülasyonu",
        body: [
          "Beta sürümünde ödeme/checkout akışı gerçek tahsilat yapmayan bir simülasyon olabilir. Ekranda 'simülasyon' veya 'gerçek ödeme alınmaz' ifadesi bulunmuyorsa işlemi tamamlamayın ve destekle iletişime geçin."
        ]
      }
    ]
  },
  "data-deletion": {
    slug: "data-deletion",
    eyebrow: "Veri hakları",
    title: "Hesap ve Veri Silme Politikası",
    description: "Hesap silme adımlarını, silinen/anonimleştirilen verileri ve zorunlu saklama istisnalarını açıklar.",
    version: LEGAL_DOCUMENT_VERSIONS.dataDeletion,
    sections: [
      {
        title: "Uygulama içinden silme",
        body: [
          "Giriş yaptıktan sonra Hesap > Profil > Hesabı sil alanından güvenlik doğrulaması başlatılır. E-posta kodu ve açık onay tamamlandığında hesap erişimi kapatılır, aktif oturumlar iptal edilir ve silme/anonimleştirme işleri başlatılır. Mobil uygulamada Güvenlik ekranındaki hesap silme bölümü kullanılır."
        ]
      },
      {
        title: "Silinen veya anonimleştirilen veriler",
        bullets: [
          "Hesap kimlik bilgileri ve aktif oturumlar.",
          "Çocuk profilleri, notlar, hatırlatıcılar ve bildirim tercihleri.",
          "Favoriler, kayıtlı aramalar, push tokenları ve zorunlu olmayan kişiselleştirme kayıtları.",
          "Aktif ilan ve kullanıcıya doğrudan bağlı profil alanları.",
          "Hukuki veya güvenlik amacı kalmayan mesaj/analitik kayıtları."
        ]
      },
      {
        title: "Sınırlı saklama istisnaları",
        body: [
          "Dolandırıcılık önleme, uyuşmazlık, denetim, muhasebe/işlem kaydı veya başka bir hukuki yükümlülük için gerekli kayıtlar erişimi sınırlandırılmış şekilde tutulabilir. Bu kayıtlar amaç ortadan kalkınca silinir veya anonimleştirilir.",
          "Yedeklerdeki kopyalar aktif sistemden erişilemez hâle getirilir ve yedek retention döngüsünde silinir."
        ]
      },
      {
        title: "Hesaba erişemiyorsanız",
        body: [
          "Veri sorumlusu iletişim e-postasına kayıtlı e-posta adresinizi ve talebinizi gönderin. Kimlik doğrulaması için ek bilgi istenebilir; şifre veya tek kullanımlık doğrulama kodu e-posta ile paylaşmayın."
        ]
      }
    ]
  }
};

export function isLegalDocumentSlug(value: string): value is LegalDocumentSlug {
  return LEGAL_DOCUMENT_SLUGS.includes(value as LegalDocumentSlug);
}
