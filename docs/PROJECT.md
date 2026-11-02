# PROJECT — Bu İş Tutar mı? / Should You Open This?

## Tek cümle

Dükkân açmak isteyen birine, kendi adresi ve rakamlarıyla "bu iş tutar mı?" sorusuna gerekçeli bir cevap (TUTAR / ŞARTLI / TUTMAZ) veren, iki dilli bir fizibilite uygulaması.

## Neden var

- Fizibilite yapan AI araçları jenerik metin üretiyor, yerel veri kullanmıyor.
- Lokasyon analitiği platformları (yaya trafiği, demografi) güçlü ama zincirlere yönelik ve pahalı.
- İlk kez dükkân açan kişi bu ikisinin arasında kalıyor. Bu uygulama o boşluğu hedefler.
- Türkiye'de bu boşluğu dolduran bir ürün yok; Avrupa'da WhereToOpen.ai benzer bir rapor satıyor. Ayrıntı ve ayrışma noktaları: `COMPETITION.md`.
- Uygulama, YouTube kanalının ("Bu İş Tutar mı?" TR, "Should You Open This?" EN/ABD) ürünüdür. Kanal kullanıcıyı ücretsiz getirir; bu, rakiplerin reklamla satın aldığı müşteriyi sıfır maliyetle kazanmak demektir.

## Kullanıcılar

1. **Girişimci (birincil):** Kahve dükkânı, berber, fırın gibi tek şube açmayı düşünen kişi. Finans bilgisi sınırlı, telefondan kullanıyor.
2. **Danışman / emlakçı / franchise satıcısı (ikincil, Faz 3):** Müşterisi için rapor hazırlayan profesyonel.
3. **Banka kredi birimi (Faz 4):** Kredi başvurusuna eklenen standart rapor.

## Ürünün çekirdeği (prototipte çalışıyor)

- **Finans:** Açılış yatırımı, sabit giderler, ürün/hizmet birim ekonomisi, 3 senaryo. Açılış rampası, yıllık fiyat/maliyet/kira/maaş artışı, fiyata dahil KDV, kart ve platform komisyonu, fire, kira stopajı, SGK işveren payı, kâr vergisi, kredi taksiti, amortisman. 60 aylık projeksiyon, 24 ay gösterilir.
- **Bölge:** Nüfus, yaş, gelir endeksi, gündüz nüfusu → talep uyumu puanı. Seçim verisi sadece bağlam.
- **Rakipler (1 km):** Mesafe, imza ürün fiyatı, puan, yorum, güçlü/zayıf etiketleri → doygunluk, fırsatlar, asgari şartlar, lider.
- **Lokasyon:** Yaya trafiği sayımı → gereken giriş oranı; kira/ciro oranı; dükkân geçmişi; girişimci profili; 12 maddelik kontrol listesi → lokasyon puanı ve kırmızı bayraklar.
- **Foto & video:** Kategori ve rakip eşlemesi; Claude ile inceleme (menüden fiyat okuma, cephe değerlendirme, rakip vitrini etiketleri).
- **Fiyat stratejisi:** Fiyat haritası, 4 strateji kartı, gerekçeli öneri.
- **Mağaza görseli:** Ad, renk, stil ile cephe taslağı + fotogerçekçi görsel için prompt.
- **Karar:** Finans kararı + lokasyon bayrakları → TUTAR / ŞARTLI / TUTMAZ ve tek cümlelik gerekçe.
- **Rapor ve karşılaştırma:** 4 aday lokasyonu yan yana; Türkçe karakterli PDF rapor.

## Prototipte olmayan, ürünün olmazsa olmazları

1. **Otomatik veri:** Adres yazınca rakipler (Google Places), nüfus/yaş/gelir (TÜİK, ABD'de Census ACS) otomatik dolar. Kullanıcı düzeltebilir.
2. **Hesap ve bulut:** Analizler, adaylar, fotoğraflar hesapta saklanır; her cihazdan açılır.
3. **Hızlı mod:** 10 soruluk sihirbazla 3 dakikada ilk karar; sonra ayrıntılı mod.
4. **Veri güven göstergesi:** "Bu analizin %X'i örnek veya tahmini veriye dayanıyor."
5. **Saha sayacı:** Telefonda tek tuşla yaya sayımı; sonuç doğrudan Lokasyon sekmesine yazılır.
6. **Arketip motoru:** Yeni sektör = yeni ayar dosyası. Hedef: ilk yıl 20+ sektör.
7. **Açılış sonrası takip:** Kullanıcı açtıktan sonra aylık gerçek satışlarını girer; tahmin ile gerçekleşen karşılaştırılır. Bu veri eşiklerin kalibrasyonunu sağlar ve uzun vadeli rekabet avantajıdır.
8. **Mevzuat yol haritası:** Ülke × sektör için izin ve belge kontrol listesi; kurum, resmi kaynak, tahmini süre; Faz 2'de ruhsat bekleme süresi finans modeline girer. Hukuk motoru değildir. → `SPEC-legal.md`
9. **"Bu dükkânda ne tutar?":** Aynı dükkân için diğer sektörleri aynı motorla puanlayıp sıralar; ters yönde "bu iş için en iyi semtler". Faz 3. → `SPEC-alternatives.md`
10. **Genel mod:** Desteklenmeyen ülkelerde uygulama çalışır, veriler elle girilir; yerel veri ve mevzuat gösterilmez. → `STRATEGY.md` §2

## Kapsam dışı (şimdilik)

- Muhasebe, POS, stok yönetimi.
- Gerçek zamanlı yaya trafiği verisi satın almak (Faz 4'te veri ortağıyla değerlendirilir).
- Yatırım tavsiyesi. Ürün bir karar destek aracıdır; bu çerçeve her ekranda korunur.

## İş modeli

Ayrıntı `STRATEGY.md` §5–6. Özet:

- **Ücretsiz:** Hızlı analiz ve karar. Video linkinin vaadi budur; kısıtlanmaz.
- **Ücretli ayrıntılı rapor:** Ayrıntılı mod, otomatik veri, Claude analizleri, aday karşılaştırma, PDF. Türkiye fiyat referansı: Yapgitsin adres raporu 999 ₺ (sadece veri listesi). Kesin fiyat lansman öncesi test edilir; fiyatlar ülke dosyasında tutulur.
- **B2B (Türkiye'de asıl gelir adayı):** Mal sahibi / emlakçı raporu ("bu dükkân en çok ne için uygun?"), franchise markaları, mali müşavirler ve KOSGEB danışmanları, banka kredi birimleri.
- **Sponsorluk ve satış ortaklığı:** Ekipman, POS, kahve tedarikçisi; açıkça etiketlenir ve kararı hiçbir şekilde etkilemez.
- **Birim maliyet:** Maliyet dolar, Türkiye geliri TL bazlı. Her analizin maliyeti ölçülür (Faz 2); Places sonuçları şartların izin verdiği ölçüde önbelleğe alınır; OpenStreetMap ücretsiz yedek kaynaktır.

## Başarı ölçütleri

- Videodan uygulamaya geçiş oranı (UTM ile).
- İlk kararı alan kullanıcı oranı (hızlı mod tamamlama).
- PDF indirme ve aday karşılaştırma kullanımı.
- Ücretli dönüşüm.
- Uzun vadede: açılış sonrası veri giren kullanıcı sayısı ve tahmin hatası (MAPE).

## Pazarlar

**Ürün her ülkeye uyarlanabilir kurulur, lansman Türkiye'de yapılır.** Ayrıntı ve gerekçe: `STRATEGY.md`.

1. **Türkiye** (TRY, Türkçe), Faz 1–2. Kanalın ana pazarı; doğrudan rakip yok.
2. **Almanya'daki Türk diasporası** (EUR, Türkçe arayüz + `DE` ülke dosyası), Faz 3.
3. **ABD** (USD, İngilizce): veri altyapısı hazırlanır, lansman `STRATEGY.md` §3'teki kapı geçilince.
4. Diğer tüm ülkeler: `generic` destek seviyesi.
5. Avrupa'nın geri kalanına erken girilmez (WhereToOpen.ai orada aktif).

## Dağıtım

Uygulama PWA; video açıklamasındaki link doğrudan açılır. Her link UTM ve `sector` parametresi taşır; sektör parametresi sihirbazı o sektörle ve videodaki örnekle açar. Uygulama mağazaları ücretli dönüşüm kanıtlanınca. → `STRATEGY.md` §4
