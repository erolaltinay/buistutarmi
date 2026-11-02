# COMPETITION — Rakip ve emsal analizi

Araştırma tarihi: Ekim 2026. Fiyatlar ve özellikler değişebilir; ürün kararlarından önce yeniden kontrol edilir. Rakiplerin kendi pazarlama iddiaları doğrulanmamıştır.

## 1. Doğrudan rakipler (bireysel girişimciye lokasyon + karar)

| Ürün | Ne yapıyor | Fiyat | Kapsam | Zayıf yanı |
|---|---|---|---|---|
| **WhereToOpen.ai** | İş tipi + adres → yaya/erişim puanı, yarıçapta rakipler (puan, fiyat, güçlü/zayıf), demografi, doygunluk, 3 senaryo, başabaş, 24 ay nakit, müşteri profilleri, aksiyon planı, PDF, çoklu lokasyon karşılaştırma | Ücretsiz sağlık puanı; €99 / 1, €249 / 3, €790 / 10 rapor | İtalya, İngiltere, Fransa, İspanya, Almanya + bazı şehirler; Türkiye yok | Şirket bilgisi yok, iddialar doğrulanamıyor, ülkeye özel vergi modeli görünmüyor, "ne açılmalı" net değil |
| **Locus Intel** | Kafe, restoran, salon, klinik için AI lokasyon kontrolü; rakip yorumları, yaya trafiği, yerel arama talebi; kira karşılaştırma aracı; API/MCP | Ücretsiz tek adres kontrolü; fiyat listelenmemiş | Belirtilmemiş | Finans modeli belirsiz |
| **RestaurantSiteFinder** | Fırsat puanı, rakip yoğunluğu, konsept uyumu, GO/NO-GO | Ücretsiz (ekipman satıcısı Horeca Store'un müşteri toplama aracı) | Sadece ABD, sadece restoran | Finans modeli yok |

## 2. Kurumsal lokasyon analitiği (zincirler için)

Placer.ai (ücretsiz katman sınırlı, ücretli teklifle), Esri Business Analyst (yıllık $4.200'den), Buxton/Audiense (yıllık yaklaşık $12.000'den), SiteZeus, Kalibrate, CARTO, GrowthFactor, Smappen (daha ucuz, franchise odaklı). İlk dükkânını açacak biri için pahalı ve karmaşık. Bizim hedeflediğimiz boşluk budur.

## 3. Devlet destekli ücretsiz araçlar (en öğretici emsaller)

- **Seul ticari bölge analizi (golmok.seoul.go.kr):** kart harcamasından tahmini satış, mobil operatör verisinden yaya trafiği, 100 sektör, 1.090 sokak ölçeğinde bölge; 1–5 yıllık hayatta kalma, açılış/kapanış oranı, tahmini kira, öz-teşhis (satış − kira − personel + kapanış modeli → iyi / iyileştirme / kriz), "yakında açacaklar" için seçilen bölgede en iyi 10 sektör.
- **Kore SEMAS (소상공인 365):** ülke geneli ücretsiz; rakip, yaya trafiği, tahmini satış, aylık bölge bildirimi. Daejeon 2025'te kendi platformunu açtı (29 veri türü, uzman ağı).
- **ABD Census Business Builder:** ücretsiz; 40+ iş tipi için benzer işletme sayısı, demografi, tüketici harcaması; kredi başvurusunda kullanılabilir rapor.
- **SizeUp (SBA, ticaret odaları):** rakip isim/adresleri, ortalama ciro ve bordro karşılaştırması.
- **Sebrae Radar de Negócios (Brezilya):** ters yön: iş tipi seç → en uygun semtler; rakiplerin faaliyet süresi, boş dükkânlar.
- **Japonya jSTAT MAP**, **Almanya Gründerplattform** (iş planı, lokasyon yok).

## 4. Finans şablonları ve AI iş planı üreticileri

ProjectionHub (kahveye özel şablon, 5 yıllık nakit, başabaş, SBA formatı; lokasyon yok), LivePlan, Upmetrics, PrometAI, Bizplanr: jenerik metin, yerel veri yok.

## 5. Türkiye

| Kim | Ne | Kime | Fiyat |
|---|---|---|---|
| Next Geo | AI ile yaklaşık 200 bin cadde kesitini puanlıyor | Banka, perakende, FMCG; ~70 firma | Teklif |
| Creative Turkey Club | TÜİK + Google Places + mobil veri ile yer seçimi platformu | 120+ marka | Teklif |
| Maptriks | 2009'dan beri kurumsal CBS ve lokasyon analitiği | Zincirler, kamu | Teklif |
| Turkcell Akıllı Harita | 2013, mobil yoğunluk verisi | Kurumlar, belediyeler | Belirtilmemiş |
| Yapgitsin | "Adres Analiz Raporu" PDF: rakip, kategori yoğunluğu, çekim noktaları, otopark, yerel arama | Dükkân açacaklar | 999 ₺ tek seferlik; ciro, kira, yatırım, ruhsat değerlendirmesi yok |
| Kiralık Yerim Var | Ticari emlak ilanı + danışmanlık olarak lokasyon analizi | Mal sahipleri, markalar | Teklif |

Türkiye'de esnafa yönelik devlet destekli ücretsiz bölge analizi platformu bulunamadı.

## 6. Ürüne yansıyan kararlar

1. Türkiye'de boşluk gerçek: Türkçe, Türkiye vergilerini hesaplayan, karar veren, uygun fiyatlı ürün yok.
2. WhereToOpen.ai özellik setinin büyük kısmı bizde de var; ayrışma: kanal trafiği, şeffaf hesap, ülkeye özel vergi ve mevzuat, lokasyon karnesi, saha sayacı, fotoğraf incelemesi, "bu dükkânda ne tutar?", açılış sonrası takip.
3. Seul'den alınanlar: sektör bazında hayatta kalma ve kapanış oranı; "seçilen bölgede en uygun sektörler" listesi → `SPEC-alternatives.md`.
4. Sebrae'den alınan: "bu iş için şehrin en iyi semtleri" → `SPEC-alternatives.md` bölüm 4.
5. RestaurantSiteFinder'dan alınan: tedarikçi sponsorluğu bir B2B gelir yolu olabilir.
6. Maliyet: OpenStreetMap ücretsiz yedek rakip kaynağı olarak değerlendirilir.

## Kaynaklar

wheretoopen.ai · locusintel.io/blog/location-intelligence-for-small-business · restaurantsitefinder.com · smappen.com · growthfactor.ai (site selection karşılaştırması ve Placer.ai fiyat yazısı) · golmok.seoul.go.kr/introduce.do · mediahub.seoul.go.kr/archives/957450 · tossplace.com/story/commercial_area_analysis · hankyung.com/article/2025033109161 · census.gov (Census Business Builder) · valleybusinessreport.com (SizeUp) · Sebrae Radar de Negócios (contadores.cnt.br haberi) · e-stat.go.jp/gis · gruenderplattform.de · projectionhub.com · avmdergi.com (Next Geo) · creativeturkeyclub.com · maptriks.com · prnewswire (Turkcell Smart Map, 2013) · yapgitsin.co · kiralikyerimvar.com
