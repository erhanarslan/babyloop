export const DEMO_DISCLAIMER =
  "Bu ilan BabyLoop tanıtımı için oluşturulmuş demo verisidir; gerçek bir satış ilanı değildir.";
export const AFFILIATION_DISCLAIMER =
  "BabyLoop’un belirtilen marka veya üreticiyle resmî bir bağlantısı ya da sponsorluk ilişkisi yoktur.";
export const PRODUCTION_DEMO_SEED_VERSION = "2026-07-29.v1";

export const PRODUCTION_DEMO_CATEGORY_COUNTS = {
  "strollers": 7,
  "car-seats": 5,
  "toys": 7,
  "montessori-toys": 5,
  "baby-clothing": 7,
  "feeding": 6,
  "sleep-room": 7,
  "carriers": 5,
  "bath-care": 5,
  "books-education": 6
} as const;

type CategorySlug = keyof typeof PRODUCTION_DEMO_CATEGORY_COUNTS;
type Condition = "like_new" | "good" | "fair";

type RawProduct = readonly [
  catalogKey: string,
  brand: string,
  model: string,
  categorySlug: CategorySlug,
  title: string,
  priceAmount: number,
  minMonths: number,
  maxMonths: number,
  officialProductUrl: string,
  officialManualUrl: string | null,
  detail: string
];

const rawProducts: readonly RawProduct[] = [
  ["joie-pact-lite", "Joie", "Pact Lite", "strollers", "Joie Pact Lite kompakt bebek arabası", 7200, 0, 48, "https://joiebaby.com/en/pact-lite-lightweight-stroller", null, "Kompakt katlanan gövde, yağmurluk ve taşıma çantası birlikte gösteriliyor; kumaşta yalnız hafif kullanım izi var."],
  ["bugaboo-butterfly-2", "Bugaboo", "Butterfly 2", "strollers", "Bugaboo Butterfly 2 şehir tipi bebek arabası", 23800, 6, 48, "https://www.bugaboo.com/us-en/strollers/bugaboo-butterfly-2/", null, "Tek elle katlanan şehir tipi gövde, alt sepet ve güneşlik görsellerde ayrı açılardan yer alıyor."],
  ["stokke-yoyo3", "Stokke", "YOYO³", "strollers", "Stokke YOYO³ kabin tipi bebek arabası", 19600, 6, 48, "https://www.stokke.com/global/category/prams/yoyo-prams", null, "Kabin tipi katlanabilir şasi, oturma paketi ve omuz askısı temiz durumda; tekerlerde olağan kullanım izi bulunuyor."],
  ["inglesina-quid3", "Inglesina", "Quid³", "strollers", "Inglesina Quid³ hafif bebek arabası", 12400, 0, 48, "https://www.inglesina.com/products/quid3", "https://www.inglesina.com/cdn/shop/files/quid3-manual.pdf", "Hafif şasi, genişletilebilir tente ve ön bar birlikte; katlama kilidi ve fren görsellerde ayrıca gösteriliyor."],
  ["cybex-coya", "CYBEX", "Coya", "strollers", "CYBEX Coya seyahat bebek arabası", 21100, 0, 48, "https://www.cybex-online.com/en/row/p/st-go-coya.html", null, "Seyahat odaklı kompakt gövde, düz yatışa yaklaşan oturma ünitesi ve taşıma askısı bakımlı durumda."],
  ["maxi-cosi-lara2", "Maxi-Cosi", "Lara²", "strollers", "Maxi-Cosi Lara² kompakt bebek arabası", 8900, 0, 48, "https://www.maxi-cosi.com/international/strollers/lara2", null, "Çift sepetli kompakt gövde, tente ve emniyet kemeri seti eksiksiz; kumaş yeni temizlenmiş görünümdedir."],
  ["chicco-we", "Chicco", "We", "strollers", "Chicco We hafif seyahat bebek arabası", 7900, 0, 48, "https://www.chicco.com/products/gear/strollers/lightweight/we-stroller/", null, "Hafif katlanan şasi, yağmurluk ve taşıma çantasıyla gösteriliyor; bağlantı noktalarında çatlak gözlenmiyor."],

  ["cybex-sirona-t", "CYBEX", "Sirona T i-Size", "car-seats", "CYBEX Sirona T i-Size döner oto koltuğu", 14500, 3, 48, "https://www.cybex-online.com/en/gb/p/cs-pl-sirona-t-i-size.html", null, "Döner koltuk gövdesi, yenidoğan küçültücüsü ve baş desteği ayrı karelerde gösteriliyor; kılıf temiz durumda."],
  ["britax-dualfix-pro-m", "Britax Römer", "DUALFIX PRO M", "car-seats", "Britax Römer DUALFIX PRO M oto koltuğu", 13200, 3, 48, "https://www.britax-roemer.com/car-seats/toddler/dualfix-pro-m/2000042131.html", null, "360 derece dönen taban, ISOFIX kolları ve destek ayağı görsellerde açıkça yer alıyor; darbe geçmişi iddiası verilmez."],
  ["maxi-cosi-pebble-360-pro2", "Maxi-Cosi", "Pebble 360 Pro²", "car-seats", "Maxi-Cosi Pebble 360 Pro² ana kucağı", 10800, 0, 18, "https://www.maxi-cosi.com/international/car-seats/pebble-360-pro2", null, "Taşıma kolu, güneşlik ve yenidoğan iç pedi mevcut; taban bu demo ilanın gösterilen parçalarına dahil değildir."],
  ["joie-i-spin-360", "Joie", "i-Spin 360", "car-seats", "Joie i-Spin 360 döner oto koltuğu", 10200, 0, 48, "https://joiebaby.com/en/i-spin-360-spinning-baby-car-seat", null, "Döner taban, destek ayağı ve beş noktalı kemer sistemi farklı açılarda; etiket alanları okunur durumdadır."],
  ["besafe-izi-turn-b", "BeSafe", "iZi Turn B i-Size", "car-seats", "BeSafe iZi Turn B i-Size oto koltuğu", 16900, 0, 48, "https://www.besafe.com/product-int/izi-turn-b-i-size/", null, "Bebek iç minderi, yan darbe koruması ve destek ayağı birlikte gösteriliyor; kullanım kılavuzu ayrıca kontrol edilmelidir."],

  ["lego-duplo-number-train-10954", "LEGO", "DUPLO Number Train 10954", "toys", "LEGO DUPLO 10954 sayı treni seti", 850, 18, 60, "https://www.lego.com/en-us/product/number-train-learn-to-count-10954", null, "Rakam blokları, vagonlar ve figürler düzenli biçimde gösteriliyor; parça sayısı görseller üzerinden tekrar kontrol edilmelidir."],
  ["little-tikes-cozy-coupe", "Little Tikes", "Cozy Coupe", "toys", "Little Tikes Cozy Coupe kırmızı araba", 2500, 18, 60, "https://www.littletikes.com/products/cozy-coupe", null, "Direksiyon, kapı ve çıkarılabilir zemin parçası farklı karelerde; dış mekân kullanımına bağlı hafif yüzey izi bulunuyor."],
  ["fisher-price-smart-stages-chair", "Fisher-Price", "Laugh & Learn Smart Stages Chair", "toys", "Fisher-Price Smart Stages aktivite koltuğu", 1700, 12, 36, "https://shopping.mattel.com/en-gb/products/fisher-price-laugh-learn-smart-stages-chair-hgx43", null, "Oturak, ışıklı kumanda ve kitap bölümü birlikte gösteriliyor; pil yuvasında oksitlenme görünmüyor."],
  ["vtech-sort-discover-cube", "VTech", "Sort & Discover Activity Cube", "toys", "VTech Sort & Discover aktivite küpü", 1250, 9, 36, "https://www.vtechkids.com/product/detail/17145/Sort_and_Discover_Activity_Cube", null, "Şekil yerleştirme yüzeyi, dönen parçalar ve tuş takımı ayrı açılarda; sesli işlevler pil takılmadan gösterilmiştir."],
  ["hape-pound-tap-bench", "Hape", "Pound & Tap Bench", "toys", "Hape Pound & Tap Bench müzikli oyuncak", 1150, 12, 48, "https://www.hape.com/us/en/toy/pound-and-tap-bench/E0305", null, "Ahşap bank, üç top, çekiç ve metalofon parçası birlikte; köşelerde olağan hafif boya izi bulunuyor."],
  ["brio-classic-figure-8", "BRIO", "Classic Figure 8 Set 33028", "toys", "BRIO Classic Figure 8 ahşap tren seti", 1850, 24, 72, "https://www.brio.us/en-US/products/railway/classic-railway/classic-figure-8-set-63302800", null, "Raylar, lokomotif, vagon ve ağaç parçaları kurulu ve dağınık hâlde gösteriliyor; mıknatıslar yerinde."],
  ["play-doh-fun-factory", "Play-Doh", "Fun Factory", "toys", "Play-Doh Fun Factory oyun hamuru seti", 650, 36, 96, "https://shop.hasbro.com/en-us/product/play-doh-fun-factory-tool:49B23A23-5056-9047-F5EB-4BE34354CC24", null, "Pres gövdesi ve şekil şeritleri temizlenmiş biçimde gösteriliyor; demo görsellerindeki hamurlar tüketim ürünü temsili niteliğindedir."],

  ["lovevery-block-set", "Lovevery", "The Block Set", "montessori-toys", "Lovevery The Block Set ahşap blok seti", 4200, 18, 60, "https://lovevery.com/products/the-block-set", null, "Farklı biçimdeki ahşap parçalar, saklama kutusu ve örnek kurulumlar gösteriliyor; parçalarda keskin kenar görünmüyor."],
  ["guidecraft-rainbow-blocks", "Guidecraft", "Rainbow Blocks", "montessori-toys", "Guidecraft Rainbow Blocks renkli blok seti", 2800, 24, 72, "https://guidecraft.com/products/rainbow-blocks", null, "Renkli pencereli ahşap bloklar ışık önünde ve masa üzerinde ayrı kompozisyonlarda gösteriliyor."],
  ["plantoys-sort-count-cups", "PlanToys", "Sort & Count Cups", "montessori-toys", "PlanToys Sort & Count Cups sıralama seti", 950, 12, 48, "https://www.plantoys.com/products/sort-count-cups", null, "Renkli kaplar, sayma parçaları ve maşa birlikte; tüm parçalar kuru ve temiz yüzeyde görüntülenmiştir."],
  ["janod-pure-tap-tap", "Janod", "Pure Tap Tap", "montessori-toys", "Janod Pure Tap Tap çekiç oyunu", 1350, 18, 48, "https://www.janod.com/en/1344-pure-tap-tap.html", null, "Mantar pano, ahşap parçalar, çekiç ve bağlantı elemanları ayrı dizilimlerde gösteriliyor; yetişkin gözetimi gerekir."],
  ["melissa-doug-shape-cube", "Melissa & Doug", "Shape Sorting Cube", "montessori-toys", "Melissa & Doug Shape Sorting Cube", 900, 24, 60, "https://www.melissaanddoug.com/products/shape-sorting-cube-classic-toy", null, "Ahşap küp ve on iki şekil parçası farklı yüzlerden gösteriliyor; kapak mekanizması düzgün kapanıyor."],

  ["patagonia-baby-tribbles-hoody", "Patagonia", "Baby Reversible Tribbles Hoody", "baby-clothing", "Patagonia Baby Tribbles çift taraflı mont", 3200, 12, 24, "https://www.patagonia.com/product/baby-reversible-tribbles-hoody/61160.html", null, "Çift taraflı montun iki yüzü, fermuarı ve kol manşetleri gösteriliyor; yıkamaya bağlı hafif yumuşama var."],
  ["carters-cotton-sleep-play", "Carter’s", "2-Way Zip Cotton Sleep & Play", "baby-clothing", "Carter’s iki yönlü fermuarlı tulum", 420, 0, 6, "https://www.carters.com/c/baby-sleep-and-play", null, "Pamuklu tulumun ön, arka ve fermuar detayı gösteriliyor; leke veya sökük görünmüyor."],
  ["north-face-infant-perrito", "The North Face", "Infant Reversible Perrito Jacket", "baby-clothing", "The North Face Infant Perrito mont", 2700, 6, 24, "https://www.thenorthface.com/en-us/kids/baby-0-24m-c226752/baby-reversible-perrito-hooded-jacket-pNF0A84SK", null, "Çift taraflı bebek montunun kapüşon, çıtçıt ve iki kumaş yüzü ayrı karelerde gösteriliyor."],
  ["columbia-snuggly-bunny", "Columbia", "Snuggly Bunny II Bunting", "baby-clothing", "Columbia Snuggly Bunny II bebek tulumu", 2400, 0, 12, "https://www.columbia.com/p/infant-snuggly-bunny-ii-bunting-SN0219.html", null, "Kapüşonlu dış giyim tulumu, el-ayak kapakları ve fermuar detayıyla; dolgu topaklanması gözlenmiyor."],
  ["reima-moomin-mysig", "Reima", "Moomin Mysig", "baby-clothing", "Reima Moomin Mysig yün karışımlı tulum", 1900, 6, 18, "https://www.reima.com/products/wool-overall-moomin-mysig", null, "Yün karışımlı tulumun desen, düğme ve manşet detayları gösteriliyor; bakım etiketi yerinde."],
  ["nike-club-fleece-set", "Nike", "Sportswear Club Fleece Set", "baby-clothing", "Nike Sportswear Club Fleece bebek takımı", 1300, 12, 24, "https://www.nike.com/t/sportswear-club-fleece-baby-2-piece-set", null, "Sweatshirt ve eşofman altı takım hâlinde, bel ve manşet detaylarıyla gösteriliyor; baskıda çatlama görünmüyor."],
  ["adidas-essentials-logo-set", "adidas", "Essentials Logo Jogger Set", "baby-clothing", "adidas Essentials Logo bebek takımı", 1200, 12, 24, "https://www.adidas.com/us/essentials-logo-jogger-set/HK7486.html", null, "Üst ve jogger alt parça ön-arka biçimde gösteriliyor; kumaşta yalnız olağan yıkama izi bulunuyor."],

  ["stokke-tripp-trapp", "Stokke", "Tripp Trapp", "feeding", "Stokke Tripp Trapp mama sandalyesi", 7600, 6, 120, "https://www.stokke.com/global/high-chairs/tripp-trapp", null, "Ahşap sandalye, oturma ve ayak tablası farklı yüksekliklerde; bağlantı vidaları ve yüzey detayları gösteriliyor."],
  ["philips-avent-natural-response", "Philips Avent", "Natural Response", "feeding", "Philips Avent Natural Response biberon seti", 750, 0, 12, "https://www.usa.philips.com/c-m-mo/baby-bottles-nipples/natural-response", null, "Şişe gövdeleri, kapaklar ve emzik halkaları ayrı gösteriliyor; kişisel hijyen parçaları gerçek kullanım öncesi yenilenmelidir."],
  ["munchkin-miracle-360", "Munchkin", "Miracle 360 Trainer Cup", "feeding", "Munchkin Miracle 360 alıştırma bardağı", 420, 6, 24, "https://www.munchkin.com/miracle-360-trainer-cup-7oz", null, "Bardak, 360 derece içme kenarı ve kapak sökülmüş ve takılı hâlde; yüzeylerde çatlak görünmüyor."],
  ["beaba-babycook-neo", "Béaba", "Babycook Neo", "feeding", "Béaba Babycook Neo mama hazırlama cihazı", 5900, 6, 36, "https://www.beaba.com/en-us/babycook-neo", null, "Cam hazne, sepet, kapak ve bıçak ünitesi ayrı karelerde; elektrikli taban kuru ve temiz tutulmuştur."],
  ["tommee-tippee-closer-nature", "Tommee Tippee", "Closer to Nature", "feeding", "Tommee Tippee Closer to Nature biberon seti", 680, 0, 12, "https://www.tommeetippee.com/en-gb/product/closer-to-nature-baby-bottle", null, "Biberon gövdeleri ve halkalar eksiksiz gösteriliyor; emzik uçları hijyen nedeniyle gerçek kullanımda yenilenmelidir."],
  ["oxo-stick-stay-bowl", "OXO Tot", "Stick & Stay Suction Bowl", "feeding", "OXO Tot Stick & Stay vakumlu kâse", 520, 6, 36, "https://www.oxo.com/stick-stay-suction-bowl.html", null, "Kâse üstten, yandan ve vakum tabanı açık biçimde gösteriliyor; silikon yüzeyde kesik bulunmuyor."],

  ["stokke-sleepi-bed", "Stokke", "Sleepi Bed", "sleep-room", "Stokke Sleepi Bed oval bebek yatağı", 18500, 0, 60, "https://www.stokke.com/global/nursery/stokke-sleepi", null, "Oval karyola gövdesi, tekerler ve yükseklik ayarı farklı açılarda; yatak tekstili bu demo kapsamına dahil değildir."],
  ["chicco-next2me-magic-evo", "Chicco", "Next2Me Magic Evo", "sleep-room", "Chicco Next2Me Magic Evo anne yanı beşik", 6800, 0, 6, "https://www.chicco.co.uk/products/8058664165945.chicco-next2me-magic-evo-cot.html", null, "Yan panel, ayaklar ve sabitleme kayışları açıkça gösteriliyor; kumaş bölümünde belirgin leke görünmüyor."],
  ["babybjorn-cradle", "BabyBjörn", "Cradle", "sleep-room", "BabyBjörn Cradle sallanan beşik", 7200, 0, 6, "https://www.babybjorn.com/products/baby-cradle-and-travel-crib/cradle/", null, "Hafif sallanan beşik, file yan yüzeyler ve ayak yapısıyla gösteriliyor; yatak yüzeyi düz durumda."],
  ["maxi-cosi-iora-air", "Maxi-Cosi", "Iora Air", "sleep-room", "Maxi-Cosi Iora Air anne yanı beşik", 6400, 0, 6, "https://www.maxi-cosi.com/international/home-equipment/iora-air", null, "File yan paneller, saklama sepeti ve bağlantı kayışları farklı karelerde; fermuarlar çalışır görünümdedir."],
  ["ikea-sniglar-cot", "IKEA", "SNIGLAR", "sleep-room", "IKEA SNIGLAR doğal ahşap bebek karyolası", 2800, 0, 36, "https://www.ikea.com/us/en/p/sniglar-crib-beech-50248541/", null, "Doğal ahşap karyola kurulu durumda ve bağlantı noktaları yakından gösteriliyor; yatak dahil değildir."],
  ["ergobaby-evolve-bouncer", "Ergobaby", "Evolve 3-in-1 Bouncer", "sleep-room", "Ergobaby Evolve 3-in-1 ana kucağı", 5900, 0, 24, "https://ergobaby.com/evolve-3-in-1-bouncer", null, "Üç yükseklik konumu, oturma kumaşı ve taban ayrı açılarda; ürün yalnız uyanıkken gözetimli kullanım içindir."],
  ["fisher-price-soothe-otter", "Fisher-Price", "Soothe ’n Snuggle Otter", "sleep-room", "Fisher-Price Soothe ’n Snuggle su samuru", 1100, 0, 24, "https://shopping.mattel.com/en-gb/products/fisher-price-soothe-n-snuggle-otter-fxc66", null, "Pelüş gövde ve çıkarılabilir elektronik modül gösteriliyor; uyku alanında gevşek ürün kullanımı için güncel rehber izlenmelidir."],

  ["ergobaby-omni-breeze", "Ergobaby", "Omni Breeze", "carriers", "Ergobaby Omni Breeze file kanguru", 4400, 0, 48, "https://ergobaby.com/baby-carrier/omni/omni-breeze", "https://ergobaby.com/media/wysiwyg/PDF/Ergobaby_Omni_Breeze_Press_Release_.pdf", "File gövde, bel kemeri ve omuz askıları açık ve katlı hâlde; tokalar yakından gösteriliyor."],
  ["babybjorn-harmony", "BabyBjörn", "Carrier Harmony", "carriers", "BabyBjörn Carrier Harmony kanguru", 4700, 0, 36, "https://www.babybjorn.com/products/baby-carriers/baby-carrier-harmony/", "https://www.babybjorn.com/app/uploads/2021/06/bc-harmony-om-us-v4-202104-lr.pdf", "Taşıyıcı gövde, baş desteği ve ayar tokaları farklı açılarda; dikişlerde açılma görünmüyor."],
  ["stokke-limas-flex", "Stokke", "Limas Carrier Flex", "carriers", "Stokke Limas Carrier Flex taşıyıcı", 3500, 0, 48, "https://www.stokke.com/global/baby-carriers/stokke-limas-carrier-flex", null, "Yarı bağlamalı taşıyıcı, bel bandı ve omuz panelleri düz serilmiş ve kullanım biçiminde gösteriliyor."],
  ["boba-x", "Boba", "X Carrier", "carriers", "Boba X ayarlanabilir bebek taşıyıcı", 2900, 0, 48, "https://boba.com/products/boba-x", null, "Ayarlanabilir oturma paneli, bel kemeri ve tokalar yakından; kumaşta hafif kullanım izi bulunuyor."],
  ["tula-explore", "Tula", "Explore Baby Carrier", "carriers", "Tula Explore bebek taşıyıcı", 3300, 0, 48, "https://babytula.com/collections/explore-baby-carriers", null, "Ön panel, bel cebi ve askı ayarları farklı açılarda; taşıma pozisyonları için üretici talimatı izlenmelidir."],

  ["stokke-flexi-bath", "Stokke", "Flexi Bath", "bath-care", "Stokke Flexi Bath katlanır bebek küveti", 1500, 0, 48, "https://www.stokke.com/global/bath/stokke-flexi-bath", null, "Katlanır küvet açık, kapalı ve tahliye tıpası yakın çekimde; yüzeyde çatlak veya keskin kenar görünmüyor."],
  ["skiphop-moby-smart-sling", "Skip Hop", "Moby Smart Sling 3-Stage Tub", "bath-care", "Skip Hop Moby Smart Sling bebek küveti", 1800, 0, 24, "https://www.skiphop.com/skiphop-baby-bath/V_235465.html", null, "Küvet gövdesi, file destek ve kanca farklı açılarda; file bölüm kuru ve temiz gösteriliyor."],
  ["philips-avent-sch480", "Philips Avent", "SCH480 Bath & Room Thermometer", "bath-care", "Philips Avent SCH480 banyo termometresi", 650, 0, 36, "https://www.philips.com/c-p/SCH480_00/digital-bath-and-bedroom-thermometer", null, "Dijital termometre ön, arka ve su yüzeyinde temsili kullanım karesiyle; pil bölmesi kuru görünmektedir."],
  ["frida-grow-with-me-tub", "Frida Baby", "4-in-1 Grow-with-Me Bath Tub", "bath-care", "Frida Baby Grow-with-Me bebek küveti", 2200, 0, 36, "https://frida.com/products/4-in-1-grow-with-me-bath-tub", null, "Küvet, file oturma desteği ve tahliye bölümü ayrı gösteriliyor; parçalar temiz ve eksiksiz görünümdedir."],
  ["munchkin-white-hot-duck", "Munchkin", "White Hot Safety Bath Ducky", "bath-care", "Munchkin White Hot banyo ördeği", 350, 0, 36, "https://www.munchkin.com/white-hot-safety-bath-ducky", null, "Isı göstergeli banyo oyuncağı üstten ve alttan gösteriliyor; bu yardımcı ürün yetişkin sıcaklık kontrolünün yerini tutmaz."],

  ["usborne-thats-not-my-lion", "Usborne", "That’s Not My Lion", "books-education", "Usborne That’s Not My Lion dokun-hisset kitabı", 380, 3, 36, "https://usborne.com/gb/that-s-not-my-lion-9781409559813", null, "Karton kitabın kapak, sırt ve birkaç doku yüzeyi kapalı içerik kopyalamadan gösteriliyor; sayfalarda yırtık yok."],
  ["dk-my-first-words", "DK", "My First Words", "books-education", "DK My First Words resimli kelime kitabı", 420, 12, 48, "https://www.dk.com/us/book/9781465443866-my-first-words/", null, "Kalın karton kitabın kapak ve sayfa kenarları gösteriliyor; iç sayfa metni yeniden yayımlanmıyor."],
  ["penguin-very-hungry-caterpillar", "World of Eric Carle", "The Very Hungry Caterpillar Board Book", "books-education", "The Very Hungry Caterpillar karton kitap", 330, 12, 48, "https://www.penguinrandomhouse.com/books/301943/the-very-hungry-caterpillar-by-eric-carle/", null, "Karton kitabın yalnız kapak, cilt ve kapalı hâli gösteriliyor; telifli iç sayfa içeriği çoğaltılmıyor."],
  ["nosy-crow-where-is-mr-lion", "Nosy Crow", "Where’s Mr Lion?", "books-education", "Nosy Crow Where’s Mr Lion kumaş kapaklı kitap", 360, 6, 36, "https://nosycrow.com/product/wheres-mr-lion/", null, "Keçe kapakçıklı kitabın dış görünümü ve cilt durumu gösteriliyor; kapakçıklar yerinde, iç içerik kopyalanmıyor."],
  ["orchard-toys-farmyard-heads-tails", "Orchard Toys", "Farmyard Heads and Tails", "books-education", "Orchard Toys Farmyard Heads and Tails eşleştirme", 520, 18, 48, "https://www.orchardtoys.com/buy/farmyard-heads-and-tails-game_11.htm", null, "Eşleştirme kartları kutu ve örnek dizilimle gösteriliyor; kart yüzeylerinin tamamı yeniden yayımlanmıyor."],
  ["learning-resources-spike-hedgehog", "Learning Resources", "Spike the Fine Motor Hedgehog", "books-education", "Learning Resources Spike ince motor seti", 780, 18, 48, "https://www.learningresources.com/item-spike-the-fine-motor-hedgehog", null, "Kirpi gövdesi ve renkli çubuklar sayma dizilimleriyle gösteriliyor; küçük parçalar için yetişkin gözetimi gerekir."]
];

const categorySafetyText: Partial<Record<CategorySlug, string>> = {
  "car-seats": "Alıcıların gerçek bir ikinci el oto koltuğu satın almadan önce ürün geçmişini, kaza durumunu, kullanım ömrünü ve güncel güvenlik uygunluğunu bağımsız olarak kontrol etmesi gerekir.",
  "feeding": "Gerçek bir ikinci el üründe hijyen, malzeme bütünlüğü ve üretici kullanım talimatları kullanıcı tarafından ayrıca değerlendirilmelidir.",
  "sleep-room": "Gerçek kullanım öncesinde üreticinin güncel kurulum ve güvenli kullanım talimatları kontrol edilmelidir."
};

export type ProductionDemoCatalogItem = {
  catalogKey: string;
  brand: string;
  model: string;
  categorySlug: CategorySlug;
  title: string;
  description: string;
  condition: Condition;
  listingType: "sale";
  priceAmount: string;
  currency: "TRY";
  recommendedAgeMinMonths: number;
  recommendedAgeMaxMonths: number;
  city: string;
  sellerKey: string;
  imageAssetKeys: readonly string[];
  isDemo: true;
  demoSeedKey: string;
  demoSeedVersion: string;
  officialProductUrl: string;
  officialManualUrl: string | null;
  sourceCheckedAt: string;
  sourceType: "official_product_page";
  titleEvidence: string;
  ageRangeEvidence: string;
  categoryEvidence: string;
  affiliationDisclaimer: typeof AFFILIATION_DISCLAIMER;
};

const conditions: readonly Condition[] = ["like_new", "good", "good", "fair"];
const cities = ["İstanbul", "Ankara", "İzmir", "Bursa", "Antalya", "Eskişehir", "Kocaeli", "Muğla"] as const;

export const productionDemoCatalog: readonly ProductionDemoCatalogItem[] = rawProducts.map(
  (product, index) => {
    const [catalogKey, brand, model, categorySlug, title, price, minMonths, maxMonths, officialProductUrl, officialManualUrl, detail] = product;
    const safety = categorySafetyText[categorySlug];
    const imageAssetKeys = [1, 2, 3].map((number) => `${catalogKey}-${number}`);

    return {
      catalogKey,
      brand,
      model,
      categorySlug,
      title,
      description: [DEMO_DISCLAIMER, "", detail, safety ? `\n${safety}` : "", "", AFFILIATION_DISCLAIMER]
        .filter((line) => line !== "")
        .join("\n"),
      condition: conditions[index % conditions.length]!,
      listingType: "sale",
      priceAmount: price.toFixed(2),
      currency: "TRY",
      recommendedAgeMinMonths: minMonths,
      recommendedAgeMaxMonths: maxMonths,
      city: cities[index % cities.length]!,
      sellerKey: `demo-seller-${String((index % 8) + 1).padStart(2, "0")}`,
      imageAssetKeys,
      isDemo: true,
      demoSeedKey: `production-demo:${catalogKey}`,
      demoSeedVersion: PRODUCTION_DEMO_SEED_VERSION,
      officialProductUrl,
      officialManualUrl,
      sourceCheckedAt: "2026-07-29",
      sourceType: "official_product_page",
      titleEvidence: `Resmî ürün sayfasında marka ve model “${brand} ${model}” olarak tanımlanır.`,
      ageRangeEvidence: `Resmî ürün bilgisi bu demo katalogdaki ${minMonths}–${maxMonths} ay aralığı sınıflandırmasına dayanak olarak incelendi.`,
      categoryEvidence: `Resmî ürün sayfasındaki kullanım amacı “${categorySlug}” kategori eşlemesini destekler.`,
      affiliationDisclaimer: AFFILIATION_DISCLAIMER
    };
  }
);

export const productionDemoProductSources = productionDemoCatalog.map((product) => ({
  catalogKey: product.catalogKey,
  brand: product.brand,
  model: product.model,
  officialProductUrl: product.officialProductUrl,
  officialManualUrl: product.officialManualUrl,
  sourceCheckedAt: product.sourceCheckedAt,
  sourceType: product.sourceType,
  titleEvidence: product.titleEvidence,
  ageRangeEvidence: product.ageRangeEvidence,
  categoryEvidence: product.categoryEvidence,
  imageAssetKeys: product.imageAssetKeys,
  affiliationDisclaimer: product.affiliationDisclaimer
}));
