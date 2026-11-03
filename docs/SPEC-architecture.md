# SPEC — Mimari

## 1. Yığın

| Katman | Seçim | Not |
|---|---|---|
| Web | Next.js (App Router), React, TypeScript strict | PWA: manifest + service worker (offline'da son analiz okunur) |
| Stil | Tailwind CSS + tasarım tokenları | Prototipteki renk/tipografi tokenları taşınır; açık/koyu tema |
| Veri | Supabase Postgres | Her tabloda RLS |
| Kimlik | Supabase Auth | E-posta bağlantısı + Google ile giriş |
| Dosya | Supabase Storage | Kullanıcı başına klasör, imzalı URL ile erişim |
| Sunucu işleri | Next.js route handler / server action | AI, Places, PDF, ödeme webhook'ları |
| Yayın | Vercel | Önizleme ortamı her PR'da |
| Test | Vitest, Playwright | Golden testler CI'da zorunlu |
| Analitik | PostHog | Olay listesi bölüm 9 |
| Hata | Sentry | |

## 2. Repo yapısı

```
apps/web
  app/[locale]/(marketing)/...        açılış sayfası, sektör sayfaları (video bağlantılı)
  app/[locale]/(app)/projects/...     analiz ekranları
  app/api/ai/*                        Claude çağrıları
  app/api/places/*                    Google Places proxy
  app/api/report/*                    PDF
  app/api/billing/*                   ödeme webhook'ları
  messages/tr.json, messages/en.json
packages/engine        saf TS, 0 bağımlılık
packages/archetypes    sektör + ülke ayar dosyaları ve zod şemaları
packages/ai            promptlar, şemalar, çağrı sarmalayıcıları
packages/pdf           rapor şablonu
supabase/migrations    şema + RLS
```

## 3. Ekranlar (prototip sekmeleri → ürün rotaları)

| Rota | İçerik |
|---|---|
| `/projects` | Analiz listesi, "Yeni analiz" |
| `/projects/new` | Hızlı mod sihirbazı: iş tipi → adres → kira → ekip → fiyat → ilk karar |
| `/projects/[id]` | Karar özeti (karar, başabaş, yatırım, nakit açığı, bayraklar, veri güveni) |
| `/projects/[id]/finance` | Prototip "Finans" |
| `/projects/[id]/area` | Prototip "Bölge ve rakipler" (otomatik doldurulmuş) |
| `/projects/[id]/location` | Prototip "Lokasyon" + saha sayacı |
| `/projects/[id]/media` | Foto & video |
| `/projects/[id]/pricing` | Fiyat stratejisi |
| `/projects/[id]/storefront` | Mağaza görseli |
| `/projects/[id]/compare` | Adaylar ve karşılaştırma |
| `/projects/[id]/report` | PDF önizleme ve indirme |
| `/projects/[id]/actuals` | Açılış sonrası aylık gerçekleşen (Faz 3) |

Bir **proje** bir iş fikridir (ör. "Moda'da kahve dükkânı"). Bir projenin 1–4 **adayı** (aday lokasyon) olur. Finansın lokasyondan bağımsız kısmı (menü, ekipman) projede, lokasyona bağlı kısmı (kira, rakipler, bölge, yaya, kontrol listesi) adayda tutulur.

## 4. Veri modeli

```sql
profiles(id uuid pk = auth.uid, locale text, country text, created_at)
projects(id uuid pk, owner uuid fk, archetype text, country text, currency text,
         name text, inputs jsonb,            -- menü, capex, fin, senaryolar (lokasyondan bağımsız)
         created_at, updated_at)
candidates(id uuid pk, project_id fk, name text,
           address text, lat double, lng double, geo_source text,
           inputs jsonb,                     -- kira ve sabit gider farkları, demo, loc, comp
           data_confidence numeric,          -- 0–1, bölüm 7
           result jsonb, result_version int, -- son motor çıktısı (önbellek)
           created_at, updated_at)
competitors(id uuid pk, candidate_id fk, source text check (source in ('google','osm','manual')),
            place_id text, name text, lat, lng, distance_m int,
            signature_price numeric, rating numeric, reviews int,
            strengths text[], weaknesses text[], note text, fetched_at)
area_stats(id pk, country text, geo_level text, geo_code text, year int,
           population int, age_18_34 numeric, age_35_54 numeric, age_55p numeric,
           household_size numeric, income_index numeric, income_value numeric, source text)
foot_counts(id pk, candidate_id fk, slot text, weekday bool, minutes int, count int, counted_at)
media(id pk, candidate_id fk, storage_path text, kind text, category text,
      competitor_id fk null, note text, faces_blurred bool, ai_result jsonb, created_at)
reports(id pk, project_id fk, storage_path text, engine_version text, created_at)
actuals(id pk, candidate_id fk, month date, units numeric, gross numeric, note text)
subscriptions(owner uuid pk, plan text, status text, provider text, renews_at)
usage_events(id pk, owner uuid, kind text, cost_estimate numeric, created_at)  -- AI/Places maliyet takibi
candidate_permits(candidate_id fk, item_id text, status text check (status in ('done','applied','todo','unknown','na')),
                  note text, updated_at, primary key (candidate_id, item_id))   -- SPEC-legal §5
site_attributes(candidate_id fk pk, m2 numeric, ground_floor bool, frontage_m numeric,
                hood_possible bool, water bool, storage bool)               -- SPEC-alternatives §2 (Faz 3)
alternative_runs(id pk, candidate_id fk, constraints jsonb, results jsonb, engine_version text, created_at)  -- Faz 3
sector_stats(country text, geo_level text, geo_code text, sector_code text, year int,
             survival_1y numeric, survival_3y numeric, survival_5y numeric, source text)  -- SPEC-alternatives §5
attribution(owner uuid pk, first_utm jsonb, first_sector text, first_seen_at)  -- STRATEGY §4
```

RLS: `owner = auth.uid()` (alt tablolarda proje üzerinden `exists` kontrolü). `area_stats` ve `sector_stats` herkese okunur, sadece servis rolü yazar. Mevzuat maddeleri veritabanında değil, `packages/archetypes/legal/` altında sürüm kontrollü dosyalardır; kullanıcı sadece durumunu (`candidate_permits`) yazar.

**Ülke destek seviyesi:** `countries/<code>.json` içindeki `supportLevel` (`full` | `generic`) ekranları belirler: `generic` ülkede otomatik demografi, mevzuat listesi ve ülke vergi varsayılanları kapalıdır; sabit bilgi bandı görünür (`STRATEGY.md` §2). Kod ülke kodu kontrol etmez, sadece `supportLevel`'a ve ülke dosyasındaki alanlara bakar.

Motor çıktısı istemcide anlık hesaplanır (motor saf ve hızlı). Sunucu kaydederken aynı motorla yeniden hesaplar ve `result` + `result_version` yazar; liste ve karşılaştırma ekranları bu önbelleği kullanır.

## 5. Entegrasyonlar

### 5.1 Adres ve rakipler — Google Maps Platform
- Geocoding: adres → koordinat.
- Places (New) Nearby Search: arketipteki place type'larıyla 1000 m yarıçap. Alınacak alanlar: ad, konum, puan, yorum sayısı, fiyat seviyesi, çalışma saatleri, `place_id`. Field mask dar tutulur (maliyet).
- Sonuçlar kullanıcıya liste olarak gelir; kullanıcı ekler/çıkarır, imza fiyatını ve etiketleri girer veya menü fotoğrafından Claude ile okutur.
- Google'ın kullanım ve önbellekleme şartlarına uyulur: kalıcı olarak `place_id` saklanır, diğer alanlar şartların izin verdiği süre kadar tutulup yenilenir; Google atfı gösterilir. Uygulamaya başlamadan önce güncel şartlar okunur.
- **OpenStreetMap yedeği:** Overpass API ile aynı yarıçapta, arketipteki `osmTags` eşlemesiyle sorgu. Places kotası dolduğunda, ücretsiz planda ve "bu dükkânda ne tutar" toplu sorgularında önce OSM denenir. OSM verisinde puan ve yorum yoktur; kaynak etiketi (`competitors.source = 'osm'`) ve ODbL atfı gösterilir. Ortak Overpass sunucularının kullanım sınırlarına uyulur; yük artınca kendi Overpass örneği veya ücretli sağlayıcı değerlendirilir.
- "Popüler saatler" resmi API'de yok; yaya trafiği için bölüm 5.4.

### 5.2 Demografi
- **Türkiye:** TÜİK ADNKS mahalle nüfusu ve yaş dağılımı toplu indirilir, `area_stats`'a ETL ile yüklenir (yılda bir). Mahalle düzeyinde resmi gelir verisi yok: gelir endeksi için vekil göstergeler kullanılır (ilçe/il gelir istatistikleri, konut m² fiyatı endeksleri). Kullanıcıya hangi kaynağın kullanıldığı ve güven seviyesi gösterilir.
- **ABD:** Census ACS 5 yıllık tahminleri (tract düzeyi): nüfus, yaş, medyan hane geliri. Koordinat → tract eşlemesi Census Geocoder ile.
- Gündüz nüfusu: Faz 2'de kullanıcı girdisi; Faz 4'te veri ortağı.
- Seçim verisi (YSK / ilçe seçim kurulları): isteğe bağlı, sadece bağlam; **puanlamaya girmez**.

### 5.3 Kira
- Faz 1–2: kullanıcı girer. Uygulama ilan sitelerinden alınmış semt ortalamasını "referans" olarak gösterebilir, ancak ilan sitelerinin otomatik veri çekmeye izin vermediği varsayılır: lisans/ortaklık olmadan kazıma yapılmaz.

### 5.4 Yaya trafiği
- Faz 2: **saha sayacı**. Telefonda büyük tek tuş; zamanlayıcı (varsayılan 15 dk); sabah/öğle/akşam × hafta içi/sonu dilimleri. Sonuç `foot_counts`'a yazılır, Lokasyon sekmesi bunu kullanır.
- Faz 4: mobil konum veri sağlayıcısıyla ortaklık değerlendirilir (maliyet yüksek).

### 5.5 Claude (Anthropic API)
- Sadece sunucudan, `packages/ai` üzerinden. Promptlar ve şemalar `docs/SPEC-ai.md`.
- Yapılandırılmış çıktı + zod doğrulama. Geçersiz yanıt kullanıcıya hata olarak döner.
- Görseller sunucuya imzalı URL ile değil, Storage'dan sunucu tarafında okunup gönderilir; yüzler bulanıklaştırılmış sürüm kullanılır.
- Kullanıcı başına günlük çağrı limiti; her çağrı `usage_events`'e maliyet tahminiyle yazılır.

### 5.6 PDF
- Sunucuda `@react-pdf/renderer` ile; Türkçe karakterli font (Noto Sans veya DejaVu Sans) gömülür.
- İçerik ve sıra prototipteki PDF ile aynı: kapak, karar, 6 temel sayı, aylık net grafiği, finans özeti, varsayımlar, 24 ay tablosu (isteğe bağlı), bölge, rakipler, fırsatlar, lokasyon karnesi, bayraklar, teyit listesi, fiyat stratejisi, Claude analizi, aday karşılaştırması (isteğe bağlı), mağaza görseli (isteğe bağlı), her sayfada uyarı metni ve sayfa numarası.
- Rapor üretildiğinde `reports`'a motor sürümüyle kaydedilir.

### 5.7 Ödeme (Faz 3)
- TR: iyzico; global: Stripe. Webhook'lar `subscriptions` tablosunu günceller. Ücretli özellikler sunucu tarafında kontrol edilir (istemci bayrağına güvenilmez).

## 6. Arketip ve ülke ayarları
`docs/SPEC-archetypes.md`. Sektör = ayar dosyası; ülke vergi/komisyon/faiz varsayılanları = ayrı ayar dosyası. Kodda sabit oran yok.

## 7. Veri güven göstergesi
Her girdi alanı bir kaynak etiketi taşır: `sample` (örnek), `estimate` (otomatik tahmin, ör. gelir vekili), `api` (resmi/API verisi), `user` (kullanıcı girdi veya onayladı), `measured` (sayaç, gerçekleşen). Karar ekranında: "Bu analizin %X'i örnek veya tahmini veriye dayanıyor". Ağırlıklar: başabaşı en çok etkileyen alanlar (kira, personel, fiyat, maliyet, baz senaryo, yaya sayımı) daha ağırdır. Güven %50'nin altındaysa karar damgasının yanında "ön değerlendirme" etiketi görünür.

Etiket alan grubu düzeyinde tutulur (`ProjectDoc.sources`); toplam ağırlık 100:

| Grup | Girdi alanları | Ağırlık | Başlangıç |
|---|---|---|---|
| `rent` | kira tipindeki sabit gider satırları | 15 | sample |
| `staff` | personel tipindeki sabit gider satırları | 13 | sample |
| `price` | ürün/hizmet fiyatları ve satış payları | 12 | sample |
| `base` | senaryolar, çalışma günü, kapasite | 12 | sample |
| `cost` | birim maliyetler | 10 | sample |
| `foot` | yaya sayımı, sayım süresi, açık saat | 10 | sample |
| `capex` | açılış yatırımı satırları, beklenmedik gider payı, güvenlik yastığı | 7 | sample |
| `area` | adres, nüfus, demografi | 5 | sample |
| `comp` | rakipler | 5 | sample |
| `otherFixed` | diğer sabit giderler | 4 | sample |
| `site` | dükkân geçmişi, kontrol listesi | 3 | sample |
| `fin` | vergi, komisyon, rampa, kredi | 2 | estimate (ülke varsayılanı) |
| `founder` | girişimci profili | 2 | sample |

`güven = Σ ağırlık (user, api, measured) / 100`; ekranda gösterilen oran `100 − güven`. Bir gruptaki herhangi bir değer değiştiğinde grup `user` olur; değeri değiştirmeden "Doğru" diyen kullanıcı da grubu `user` yapar. Hızlı modda cevaplanan gruplar (`area`, `rent`, `staff`, `founder`, `price`, `cost`, `base`, `capex`) `user` olarak başlar. "Örneğe dön" tüm etiketleri başlangıca döndürür.

## 8. Güvenlik ve KVKK
- Kişisel veri: e-posta, adres/konum, fotoğraflar (yüz içerebilir), girişimcinin finansal bilgileri.
- Yüz bulanıklaştırma: yüklemeden önce istemcide yüz algılama (ör. MediaPipe) ile; başarısız olursa sunucuda tekrar. Orijinal bulanıklaştırılmamış dosya saklanmaz.
- Aydınlatma metni, açık rıza (AI'ya görsel gönderimi dahil), çerez bildirimi, hesap ve tüm veriyi silme akışı (30 gün içinde kalıcı silme).
- Veri yurt dışına aktarımı (Supabase/Vercel/Anthropic/Google bölgeleri) için hukuki değerlendirme; Supabase projesi AB bölgesinde açılır.
- Yayın öncesi avukat görüşü: KVKK, kullanım şartları, "yatırım tavsiyesi değildir" çerçevesi, ödeme ve iade şartları.
- Rate limit: AI ve Places uçlarında kullanıcı + IP bazlı.

## 9. Analitik olayları
`project_created`, `quick_mode_completed`, `verdict_shown{verdict}`, `candidate_added`, `compare_viewed`, `pdf_downloaded`, `places_fetched`, `ai_called{kind}`, `foot_count_saved`, `media_uploaded{category}`, `paywall_shown`, `checkout_started`, `subscription_started`, `actuals_entered`. UTM parametreleri (`utm_source=youtube&utm_content=<video>`) ilk oturumda profile yazılır.

## 10. Uluslararasılaştırma
- `next-intl`; rota öneki `/tr`, `/en`.
- Para ve sayı: `Intl.NumberFormat(locale, {style:'currency', currency})`.
- Ülke ≠ dil: Türkçe arayüzle ABD analizi yapılabilir (prototipte olduğu gibi).
- Almanca (DACH) Faz 4: yeni `messages/de.json` + `countries/de.json`.
