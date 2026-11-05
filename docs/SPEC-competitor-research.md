# SPEC — Rakip inceleme ve fiyat haritası

Araştırma tarihi: Kasım 2026. Şartlar ve fiyatlar değişebilir; her iş paketine başlarken §9'daki kaynaklar yeniden okunur.

Kullanıcı açmak istediği iş kolunda yakınındaki rakipleri tanır, fiyat politikalarını görür ve kendi fiyatını buna göre kurar. Kaynaklar: sosyal medya hesapları, web siteleri, dijital menüler, teslimat ve randevu uygulamaları, saha gözlemi. İş paketleri ve kabul kriterleri `ROADMAP.md` İP-2.8–2.12 ve İP-3.10–3.11'dedir.

## 1. Temel karar: toplayan kullanıcı, okuyan Claude, hesaplayan motor

Rakip hesaplarını arka planda tarayan bir sistem kurulmaz. Akış şöyledir:

1. Uygulama rakibi ve kaynağın yerini bulmaya yardım eder.
2. Kullanıcı kaynağa kendi bakar: fotoğraf çeker, ekran görüntüsü alır, bağlantı yapıştırır veya elle yazar.
3. Claude görüntüden veya sayfadan fiyatları okur ve öneri olarak gösterir (Değişmez kural 6).
4. Kullanıcı "Uygula" der. Her değer kaynağı ve tarihiyle kaydedilir.
5. Karşılaştırma ve politika özeti deterministik hesaplanır. Claude sadece hesaplanmış sonucu özetler (kural 12'deki düzen).

Gerekçe: Instagram şartları otomatik veri toplamayı girişli veya girişsiz ayırmadan izne bağlıyor (§5). Fiyatlar da çoğunlukla görsellerin, hikâyelerin ve "fiyat için DM" yanıtlarının içinde; API ile gelmiyor. Tarayıcı botu hem riskli hem de asıl veriyi getirmiyor.

## 2. Çıkacak sonuç

Rakip başına: kaynak bağlantıları, sepet fiyatları, servis ücreti, kampanyalar, gözlem tarihleri.

Sektör için **fiyat haritası**:

| Soru | Nasıl bulunur | Yöntem |
|---|---|---|
| Fiyat seviyesi (ucuz / orta / pahalı) | Rakibin sepet fiyatlarının medyana oranı | Hesap |
| Bölgedeki fiyat aralığı | Sepet kalemi başına en düşük, medyan, en yüksek | Hesap |
| Benim yerim | Kendi fiyatlarımın aynı medyana oranı | Hesap |
| Paket indirimi | Örn. berberde `1 − combo / (cut + beard)` | Hesap |
| Kanal farkı | Aynı ürünün teslimat ve dükkân fiyatı oranı | Hesap |
| Zam ritmi | Aynı kalemin tarihli iki gözlemi arasındaki fark | Hesap |
| Görünürlük | Fiyat açık mı, "DM'den sorun" mu, liste yalnız dükkânda mı | Kullanıcı işareti |
| Kampanya tipi | Öğrenci, happy hour, sadakat, açılış, abonelik | Claude önerir, kullanıcı onaylar |
| Fiyat kademesi | Usta/çırak, boy (küçük/büyük) farkı | Claude önerir, kullanıcı onaylar |

Yeterli veri yoksa politika yorumu yapılmaz. Eşik: en az 3 rakip, her birinde en az 2 sepet kalemi. Altında ekran "veri yetersiz, şu rakiplerde şu kalemler eksik" der. Tek gözlemden zam ritmi çıkarılmaz.

Motora tek bağlantı mevcut alan üzerindendir: rakibin imza kalemi gözlemi, "Uygula" ile `Competitor.price` olur ve mevcut fiyat aralığı hesabına girer. Geri kalanı bilgi amaçlıdır, karara ve puana girmez. Girmesi istenirse önce `SPEC-calc-engine.md` değişir.

## 3. Kaynak merdiveni

Sıra güvenilirlik ve maliyete göredir. Kullanıcıya önce üstteki önerilir.

| # | Kaynak | Fiyat güvenilirliği | Nasıl alınır |
|---|---|---|---|
| 1 | Dükkândaki fiyat listesi | Yüksek | Kapıdaki listenin fotoğrafı; içerideyse not |
| 2 | Dijital menü / QR menü | Yüksek, tarihi çoğu zaman belirsiz | Ekran görüntüsü; İP-2.11'den sonra bağlantı |
| 3 | İşletmenin web sitesi | Orta, eski kalmış olabilir | Ekran görüntüsü; İP-2.11'den sonra bağlantı |
| 4 | Telefon veya mesajla sorma | Orta, kişiye göre değişebilir | Kullanıcı sorar, elle girer |
| 5 | Randevu uygulaması (hizmet sektörleri) | Orta | Ekran görüntüsü |
| 6 | Teslimat uygulaması | Dükkân fiyatının yerine geçmez | Ekran görüntüsü, kanal `delivery` |
| 7 | Instagram, Facebook, TikTok | Düşük; tarihi kontrol edilir | Ekran görüntüsü |
| 8 | Harita profili, yorumlar | Fiyat için zayıf | Yalnız konum, puan ve şikâyet teması |

**Türkiye'de saha kaynağı güçlü.** Fiyat Etiketi Yönetmeliği md. 8'e göre lokanta, kafe ve pastanelerde liste giriş kapısının önünde ve masada bulunur; diğer hizmetlerde listenin yeri "hizmetin sunulduğu işyeri"dir. Yani kahve dükkânında fiyat kapıdan okunur; berber ve kuaförde çoğu zaman içeri girmek gerekir. Servis ücreti gibi ek ücretler de listede yazılı olmalıdır, bu yüzden gözlemde ayrı alandır.

Bu bilgi uygulamaya kural olarak yazılmaz. Kaynak sırası ülke dosyasından gelir (`countries/*.json`, `research.sources`), kod ülke kontrol etmez (kural 13). Arayüz "kapıda liste olmalı" gibi hukuki ifade kurmaz, "kapıdaki listeye bak" der (kural 11). `GENERIC` ülkede sıra: dijital menü, web sitesi, sorma, sosyal medya.

## 4. Her kaynakta ne incelenir

Bunlar rakip kartında sektöre göre çıkan kısa kontrol listesidir. Sektör farkı arketip dosyasından gelir.

**Instagram, Facebook, TikTok**
- Bio: menü, fiyat veya randevu bağlantısı var mı?
- Sabit gönderiler ve "Fiyat", "Menü", "Kampanya" adlı öne çıkanlar.
- Son 30 günde kaç paylaşım var? Hesap yaşıyor mu?
- Fiyat yazan paylaşımların tarihi ve dönemi.
- Kampanya türü ve sıklığı: öğrenci, saatlik indirim, sadakat, paket.
- "Fiyat için DM" politikası. Gizlenen fiyat da bir politikadır.
- Yorumlarda tekrar eden şikâyet teması. Kişi adı ve yorum metni kaydedilmez.
- Takipçi sayısı yalnız kaba bağlamdır, başarı ölçüsü sayılmaz; satın alınmış olabilir.

**Web sitesi**
- Fiyat sayfası veya PDF menü var mı? Tarihi görünüyor mu?
- Online sipariş veya randevu var mı?
- Paket, üyelik, hediye kartı.
- Sitedeki sosyal medya bağlantıları: rakibin doğru hesabını bulmanın en güvenli yolu.

**Dijital menü**
- Sepet kalemlerinin fiyatı, porsiyon veya boy.
- Giriş, en çok öne çıkarılan ve en pahalı ürün: fiyat merdiveni.
- Servis veya kuver ücreti, kampanya ve menü bölümleri.
- Kategori ve ürün sayısı.

**Teslimat ve randevu uygulamaları**
- Teslimatta: dükkân fiyatına göre fark, asgari sepet, teslimat ücreti, kampanya.
- Randevuda: hizmet listesi, süre, fiyat, usta kademesi, yoğun saatler.

**Saha**
- Kapı veya vitrin listesinin tarihi, boy seçenekleri, gerçek doluluk.
- İçeride fotoğraf yerine not alınması önerilir. Çalışan ve müşteri fotoğraflanmaz.
- Sorarken sıradan müşteri gibi fiyat sorulur. Kullanıcı kendi fiyat planını rakiple konuşmaz, fiyat üzerine anlaşma aramaz.

## 5. Sınırlar

**Yapılmaz:**
- Instagram, Facebook, TikTok, teslimat ve randevu uygulamalarında otomatik kazıma; girişsiz, proxy'li veya üçüncü parti kazıma servisi üzerinden de.
- Sahte veya kullanıcıya ait hesapla giriş, kullanıcıdan şifre veya oturum çerezi isteme.
- CAPTCHA, oturum duvarı veya hız sınırını aşma.
- Müşteri yorumu, kullanıcı adı, çalışan veya işletme sahibinin kişisel bilgilerini saklama.
- Rakibin görselini veya metnini raporda yeniden yayımlama.
- Rakibi kötüleyen veya adıyla karşılaştıran reklam metni önerme.

**Instagram:** Kullanım Koşulları §4.2, girişli olsun olmasın izinsiz otomatik erişim ve bilgi toplamayı yasaklıyor ve bu yolla elde edilen veriyi satmayı da kapsıyor. 2024 tarihli *Meta v. Bright Data* kararı girişsiz kazımada Meta'nın o günkü şartlarına dayanıyordu; ABD kararıdır ve güncel metin bu boşluğu kapatıyor. Ürün bu karara yaslanmaz.

**Google Maps Platform:** Şartlar iş yeri adı, adres ve yorumları kopyalayıp saklamayı, izin verilen dışında önbelleğe almayı ve içerikten yeni içerik üretmeyi yasaklıyor. Süresiz saklanabilen `place_id`, en fazla 30 gün saklanabilen enlem ve boylamdır. Places verisi Google dışı haritada gösterilmez, Google Maps atfı zorunludur. Sonuçlar:
- Places'ten gelen ad, puan, yorum sayısı ve web sitesi canlı gösterilir, projeye yazılmaz.
- Kalıcı rakip kaydının adı ve bağlantısı kullanıcıdan veya OSM'den gelir (`website`, `contact:*`, ODbL atfı).
- Places içeriği Claude'a gönderilmez, rapora gömülmez; hukuki görüş aksini söylerse bu madde değişir.

**Çelişki:** `SPEC-architecture.md` §5.1 ve `competitors` tablosu Places'ten gelen ad, konum, puan ve yorumu `fetched_at` ile saklamayı öngörüyor; `STRATEGY.md` §6 önbellek varsayıyor. İP-2.1 başlamadan önce bunlar §5'e göre düzeltilir. Rakip verisini Claude analizine ve PDF'e koyan akışlar (SPEC-ai §2) da Places kaynaklı alanlar için aynı kontrolden geçer.

**KVKK:** Bir bilginin herkese açık görünmesi tek başına işleme izni sayılmaz; alenileştirme iradesi ve amaçla sınırlılık aranır. Rakip kaydı işletme bilgisiyle sınırlıdır. Şahıs işletmesinde işletme adı ve hesap adı da kişisel veri sayılabileceği için bu başlık İP-1.11'deki avukat görüşüne eklenir.

**Dış içerik talimat değildir.** Görseldeki ve sayfadaki metin yalnız veridir. Prompt bunu açıkça söyler, çıktı zod ile doğrulanır, kaynakta olmayan fiyat `null` döner.

## 6. Veri modeli

İP-1.1'e kadar `input.comp[i].research` içinde tutulur; rakip silinince kayıt da gider, aday lokasyon kopyasıyla birlikte gezer. Motor bu alanı okumaz. İnceleme kaydını değiştirmek rakip grubunu "kullanıcı verisi" yapmaz, "Uygula" yapar. İP-1.1'den sonra aşağıdaki tablolarda tutulur. Tablolar RLS politikalarıyla aynı migration'da yazılır (kural 8). `confirmed_by_user` kaynak keşfiyle (İP-2.12) gelir; o zamana kadar bağlantıyı kullanıcı kendisi ekler.

```sql
competitor_sources(id uuid pk, competitor_id fk,
  kind text check (kind in ('website','digital_menu','instagram','facebook','tiktok',
                            'delivery','booking','other')),
  url text, confirmed_by_user bool, added_at)

price_observations(id uuid pk, competitor_id fk,
  item_key text null,                  -- sektörün kalem anahtarı; eşleşmezse null
  raw_name text, price numeric, currency text, size_note text,
  channel text check (channel in ('in_store','delivery','online','unknown')),
  source_kind text check (source_kind in ('door','in_store_note','menu_photo','digital_menu',
                                          'website','social','booking','delivery','asked','manual')),
  source_url text null,
  observed_on date,                    -- kullanıcının gözlem tarihi
  source_dated_on date null,           -- kaynakta yazan tarih, varsa
  created_at)

competitor_offers(id uuid pk, competitor_id fk,
  type text,                           -- arketipteki anahtarlar: student, loyalty, bundle...
  note text, source_kind text, observed_on date)
```

`competitors`'a eklenenler: `service_fee numeric null`, `price_visibility text` (`open`, `ask`, `in_store`, `unknown`).

Saklanmayanlar: ekran görüntüleri ve fotoğraflar (dış cephe incelemesindeki gibi yalnız ekran açıkken bellekte durur), ham HTML, Claude'un onaylanmamış önerileri.

Arketipe `research` eklenir: çıkacak kontrol grupları (`groups`), kalem eş anlamlıları ve boy notu (`items`), kampanya türleri (`offers`), sektöre özel kontrol maddeleri (`checks`). Ortak maddeler `packages/archetypes/research-checks.json` içindedir. Sepet olarak mevcut `itemTemplate` kullanılır, yeni liste açılmaz. Ülke dosyasına `research.sources` ve `research.staleAfterDays` eklenir. Ülkenin sırasında olmayan kaynak da seçilebilir, "Diğer" altında çıkar. `staleAfterDays` başlangıç önerisidir: TR 90, US ve `GENERIC` 180. Düzenlemeli mesleklerde kampanya önerisi çıkmaz (`SPEC-ai.md` §1).

Kaynağa göre önerilen kanal, kullanıcı değiştirebilir: `delivery` teslimat; `door`, `in_store_note`, `menu_photo`, `digital_menu`, `website`, `asked` dükkân; `social`, `booking`, `manual` belli değil. Kanallar karşılaştırmada karışmadığı için işletmenin kendi söylediği fiyat dükkân sayılır; yoksa kapı listesi ile web sitesi aynı tabloya girmez.

Yalnız imza kaleminin, proje para birimindeki, teslimat kanalı dışındaki gözlemi "Uygula" ile `Competitor.price` olur.

Mevcut `barber` arketipi erkek berberi kalemleriyle gelir. Kadın kuaförü kalemleri başkadır (kesim, boya, fön); `kuaför` Faz 3 sektörüyle (`SPEC-archetypes.md` §5) gelir. O zamana kadar kullanıcının eşleşmeyen kalemi `raw_name` ile kaydedilir, karşılaştırmaya girmez.

## 7. Hesap

Fiyat haritası `packages/engine` içinde ayrı saf fonksiyondur ve `analyze()` çıktısını değiştirmez. Bu yüzden golden vakalar etkilenmez. Tarih dışarıdan parametre (`asOf`) olarak gelir; motor saat okumaz (kural 1). Formüller yazılmadan önce `SPEC-calc-engine.md`'ye eklenir, önce test yazılır.

- Kullanılan gözlem: rakip + kalem + kanal başına en yeni gözlem. `staleAfterDays`'i geçen gözlem "eski" işaretlenir, medyana girmez, ekranda görünür.
- `kalemMedyan` = aynı kanaldaki taze rakip fiyatlarının medyanı.
- `fiyatEndeksi(rakip)` = rakibin `fiyat / kalemMedyan` oranlarının ortalaması; en az 2 kalem gerekir.
- Seviye: endeks < 0,90 düşük; 0,90–1,10 orta; > 1,10 yüksek. Bu eşikler başlangıç önerisidir, arketip dosyasında (`research.levels`) tutulur, gerçek veriyle gözden geçirilir.
- Paket indirimi tanımı arketiptedir (`research.bundles`); kod kalem anahtarı bilmez.
- Tam formüller ve uç durumlar: `SPEC-calc-engine.md` §12.2.
- Fiyatlar kullanıcıya servis ücreti ayrı gösterilerek verilir; ücret fiyata gizlice eklenmez.
- Dolar veya başka kurla çevirme yapılmaz; farklı para birimindeki gözlem karşılaştırmaya girmez.

Enflasyon yüksek ülkede fiyat çabuk eskir. Türkiye için `staleAfterDays` önerisi 90'dır; lansman öncesi test edilir.

## 8. Maliyet

| Kalem | Birim | Not |
|---|---|---|
| Rehber, elle giriş, fiyat haritası | 0 | Dış çağrı yok |
| OSM ile rakip keşfi | 0 | Overpass kullanım sınırları geçerli |
| Places Nearby Enterprise | 35 $ / 1.000 çağrı (aylık 1.000 ücretsiz) | `websiteUri`, puanla aynı SKU'da; maske genişlese de SKU değişmez |
| Places Details Enterprise | 20 $ / 1.000 çağrı (aylık 1.000 ücretsiz) | Yalnız seçilen rakip için |
| Claude görsel okuma | Görsel başına yaklaşık 1–1,5 sent | Tahmin, ölçülmedi; İP-2.10'da ölçülür |

Örnek: 8 rakip, rakip başına en fazla 3 görsel: en çok 24 görsel, Claude için yaklaşık 25–35 sent (tahmin). Görsel sayısı plan bazlı sınırlanır, her çağrı `usage_events`'e yazılır.

## 9. Kaynaklar ve doğrulama durumu

| Konu | Kaynak | Durum |
|---|---|---|
| Instagram otomatik toplama | help.instagram.com/581066165581870 §4.2 | Okundu |
| Meta API sınırları | developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login/business-discovery; developers.facebook.com/terms | Okundu; Platform Terms'ün son kısmı yalnız özetten |
| Meta v. Bright Data | fbm.com "Major Decision Affects Law of Scraping"; quinnemanuel.com müvekkil notu | Hukuk bürosu özeti; karar metni okunmadı |
| Google şartları | cloud.google.com/maps-platform/terms §3.2.3; .../maps-service-terms §3, §14; developers.google.com/maps/documentation/places/web-service/policies | Okundu |
| Places SKU ve fiyat | developers.google.com/maps/billing-and-pricing/sku-details/places; .../pricing | Okundu; SKU sayfası kısmi |
| Fiyat Etiketi Yönetmeliği md. 8 | 11.10.2025 tarihli 33044 sayılı R.G., alomaliye.com kopyası | Değişiklik metni kopyadan okundu; yönetmeliğin bütünü resmî siteden teyit edilmedi |
| Bakanlık fiyat verisi | Aynı metin md. 8/5 | Sistem ve usul esasları canlı olarak bulunamadı |
| KVKK alenileştirme | AYM 27.1.2026, 2020/32193 (alomaliye.com) | Arama özetinden; karar metni okunmadı, avukata gidecek |
| Teslimat ve randevu uygulaması şartları | — | Okunmadı. Okunana kadar yalnız kullanıcının ekran görüntüsü |

## 10. Açık kararlar

1. **Bağlantıdan okuma (İP-2.11):** Kullanıcı isteğiyle tek sayfa çekmek, kazıma sayılabilir mi? Avukat görüşü gelmeden üretimde açılmaz.
2. **Places içeriğinin Claude analizine girmesi:** Şartlardaki "içerikten içerik üretme" yasağına takılır mı? Varsayılan cevap evet kabul edilir.
3. **Meta API (İP-3.11):** Fiyat vermediği için varsayılan karar "yapma"dır. Yalnız hesap aktifliği ürün için para ederse yeniden açılır.
