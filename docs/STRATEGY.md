# STRATEGY — Pazara giriş ve dağıtım

## 1. Ana karar

**Ürün her ülkeye uyarlanabilir kurulur, lansman Türkiye'de yapılır.** Önce Türkiye'de kazanılır, sonra ölçülebilir kapılar geçildikçe yeni ülke açılır.

Gerekçe:
- Pazarı uygulama değil kanal belirler. Türkçe videonun altındaki linke Türkçe izleyen tıklar; ilk kullanıcılar Türkiye'den gelir.
- Türkiye'de doğrudan rakip yok (bkz. `COMPETITION.md`). Kurumsal firmalar zincirlere teklifle çalışıyor; bireysel girişimciye yönelik tek ürün (Yapgitsin, 999 ₺) yalnız veri listesi veriyor.
- Türkiye'ye özel bilgi (KDV, stopaj, SGK, ruhsat, TÜİK) rakiplerin kolay kopyalayamayacağı bir avantajdır.
- "Globale hazır olmak" ucuzdur (ayar dosyaları zaten var). "Globalde tamam olmak" pahalıdır (her ülke için veri, mevzuat, ödeme, hukuk, destek). İkincisi kapılara bağlanır.

## 2. Ülke destek seviyeleri

Kod her ülke için iki seviyeden birini bilir (`countries/<code>.json` içindeki `supportLevel`):

| Seviye | Ne var | Ne yok |
|---|---|---|
| `full` | Ülke vergi ve oran varsayılanları, otomatik demografi, mevzuat yol haritası, yerel ödeme | — |
| `generic` | Uygulamanın tamamı; para birimi seçilebilir; vergi/komisyon alanları boş ve elle girilir; Google Places rakip listesi (maliyet kontrolüyle) | Otomatik demografi, mevzuat listesi, ülke varsayılanları |

`generic` ülkede ekranda sürekli şu bilgi görünür: "Bu ülke için yerel veri ve mevzuat desteği henüz yok. Rakamları kendin gir; hesap yöntemi aynıdır." Böylece video dünyanın her yerinde izlense de link çalışır, ama her ülke için veri maliyeti oluşmaz.

Başlangıç: `TR = full`, `US = full` (veri altyapısı hazırlanır ama lansman kapıya bağlı), diğer tüm ülkeler `generic`.

## 3. Sıra ve kapılar

1. **Türkiye (Faz 1–2).** Türkçe kanal + Türkçe arayüz.
2. **Almanya'daki Türk diasporası (Faz 3).** Türkçe arayüz + `DE` ülke dosyası (€, Gewerbeanmeldung, Meisterpflicht, KfW). Türkçe kanalın izleyicisinin bir kısmı Almanya'da dükkân açıyor; bu, en ucuz ikinci pazardır. Almanca arayüz sonra eklenir.
3. **ABD (kapı geçilince).** İngilizce kanal ("Should You Open This?") + İngilizce arayüz.

**ABD kapısı (ikisi birden):**
- İngilizce kanalda belirli bir aylık izlenme seviyesi (hedef değer lansman öncesi kanal verisine göre belirlenir).
- Türkiye'de ücretsizden ücretliye dönüşüm ve rapor memnuniyeti hedefi tutuyor.

**Avrupa'nın geri kalanına erken girilmez:** WhereToOpen.ai orada aynı ürünü €99'dan satıyor.

## 4. Dağıtım: video → uygulama

- Uygulama PWA. Video açıklamasındaki link doğrudan açılır, telefona "ana ekrana ekle" ile kurulur. App Store / Play Store, ücretli dönüşüm kanıtlanınca (Faz 3+).
- Her video linki UTM taşır: `?utm_source=youtube&utm_medium=description&utm_campaign=<kanal>&utm_content=<video-id>&sector=<arketip>`.
- `sector` parametresi sihirbazı o sektörle açar. Videodaki örnek rakamlar "Videodaki örneği yükle" düğmesiyle tek tıkla gelir; kullanıcı sonra kendi rakamlarına geçer.
- Her sektör videosu için bir sektör sayfası: `/[locale]/sektor/<id>` (video, kısa özet, "Kendi rakamlarınla hesapla").
- Ölçülen: video başına ziyaret, hızlı analiz tamamlama, ücretli rapor, PDF indirme.

## 5. Gelir modeli (Türkiye önceliği)

- **Ücretsiz:** Hızlı analiz (10 soru) ve karar. Video linkinin vaadi budur; kısıtlanmaz.
- **Ücretli ayrıntılı rapor:** Ayrıntılı mod, otomatik rakip ve demografi, Claude analizleri, aday karşılaştırma, PDF. Fiyat Türkiye'de Yapgitsin (999 ₺, yalnız veri listesi) referansıyla konumlanır; kesin fiyat lansman öncesi test edilir. Fiyatlar ülke dosyasında tutulur, kodda yazılmaz.
- **B2B (Türkiye'de asıl gelir adayı):** emlakçı ve mal sahibi paketi ("bu dükkân en çok ne için uygun?"), franchise markaları, KOSGEB ve mali müşavirler, banka kredi birimleri.
- **Sponsorluk ve satış ortaklığı:** ekipman, POS, kahve tedarikçisi; açıkça etiketlenir ve kararı hiçbir şekilde etkilemez.

## 6. Birim ekonomisi riski

Maliyetler (Google Places, Claude, barındırma) dolar bazlı, Türkiye geliri TL bazlı. Bu yüzden:
- Her analizin maliyeti `usage_events` ile ölçülür (Faz 2).
- Places sonuçları şartların izin verdiği ölçüde önbelleğe alınır; ücretsiz modda otomatik rakip çekimi sınırlıdır.
- OpenStreetMap, rakip listesi için ücretsiz yedek kaynak olarak değerlendirilir.
- Fiyatlar enflasyona karşı ülke dosyasından kolayca güncellenir.

## 7. Konumlandırma cümlesi

TR: "Dükkân açmadan önce, kendi adresin ve rakamlarınla: bu iş tutar mı, tutmaz mı?"
EN: "Before you sign the lease: your address, your numbers, a clear answer."

Ayrışma noktaları (her pazarda): ücretsiz kanal trafiği, şeffaf ve varsayımları görünen hesap, ülkeye özel vergi ve mevzuat, lokasyon karnesi ve saha sayacı, fotoğraf incelemesi, "bu dükkânda ne tutar?", açılış sonrası takip.
