# ROADMAP

Her iş paketi (İP) Claude Code'a tek tek verilir. Bir İP, kabul kriterlerinin hepsi sağlanınca biter. Süreler tek geliştirici + Claude Code için kaba tahmindir.

Pazar sırası `STRATEGY.md`'dedir: Türkiye → Almanya'daki Türk diasporası → ABD (kapı geçilince). Ürün baştan her ülkeye uyarlanabilir kurulur.

## Faz 0 — Temel (≈1 hafta)

**İP-0.1 Monorepo kurulumu**
- pnpm workspaces; `apps/web`, `packages/engine`, `packages/archetypes`, `packages/ai`, `packages/pdf`.
- TypeScript strict, ESLint, Prettier, Vitest, Playwright; GitHub Actions'ta lint + typecheck + test.
- Kabul: `pnpm lint`, `pnpm typecheck`, `pnpm test` temiz repoda geçer; CI yeşil.

**İP-0.2 Hesap motoru**
- `docs/SPEC-calc-engine.md`'deki her bölüm ayrı modül: `unit.ts`, `fixed.ts`, `investment.ts`, `projection.ts`, `breakeven.ts`, `competition.ts`, `demand.ts`, `location.ts`, `verdict.ts`, `pricing.ts`. Tek giriş: `analyze(input, archetype, country) → Result`.
- Kabul: `golden-cases.json` 30/30 geçer; SPEC bölüm 15'teki ek birim testleri yazılmış ve geçiyor; motorun hiçbir dosyası `Date`, `Math.random`, `fetch`, `window` kullanmıyor (lint kuralıyla).

**İP-0.3 Arketip, ülke ve mevzuat dosyaları**
- `coffee`, `barber` sektörleri; `TR`, `US` ülkeleri (`supportLevel: full`) ve `GENERIC` ülke şablonu; zod şemaları; prototipteki sabitlerin taşınması.
- `seed/legal/` taslak dosyaları `packages/archetypes/legal/` altına `SPEC-legal.md` §3 şemasıyla taşınır.
- Kabul: şema doğrulaması CI'da; motor sektöre veya ülkeye özel `if` içermiyor; golden testler arketip dosyalarıyla çalışıyor; `SPEC-legal.md` §4'teki CI kuralları yazılmış (taslak madde varken production build kırmızı).

## Faz 1 — MVP, Türkiye lansmanı (≈4–5 hafta)

**İP-1.1 Kimlik ve projeler** — Supabase Auth, `profiles/projects/candidates` tabloları + RLS, proje listesi, oluşturma, silme.
Kabul: iki farklı kullanıcı birbirinin verisini göremiyor (Playwright testi).

**İP-1.2 Analiz ekranları** — Finans, Bölge ve rakipler (manuel), Lokasyon, Fiyat, Mağaza görseli; prototiple aynı davranış; her değişiklikte anlık hesap, 1 sn gecikmeyle otomatik kayıt.
Kabul: prototipteki her girdi alanı var; aynı girdiyle ekrandaki karar, başabaş, yatırım, nakit açığı ve geri dönüş prototiple aynı.

**İP-1.3 Karar özeti ve veri güveni** — `/projects/[id]` özet ekranı; SPEC-architecture bölüm 7'deki güven göstergesi.
Kabul: örnek veriyle açılan analizde güven < %50 ve "ön değerlendirme" etiketi görünüyor; kullanıcı kira, personel, fiyatı girince oran artıyor.

**İP-1.4 Hızlı mod sihirbazı** — 10 adım; sonunda karar ekranı. `?sector=<id>` parametresiyle o sektörle açılır; "Videodaki örneği yükle" düğmesi.
Kabul: mobilde (390 px) 3 dakikanın altında tamamlanabiliyor; terk edilen sihirbaz kaldığı yerden devam ediyor; `sector` parametresi doğru arketipi açıyor.

**İP-1.5 Aday karşılaştırma** — Bir projeye 4 adaya kadar; 12 ölçütlük tablo; en iyi değer vurgusu.
Kabul: prototipteki karşılaştırma tablosuyla aynı satırlar ve vurgu kuralı.

**İP-1.6 PDF rapor** — `packages/pdf`; prototipteki bölüm sırası + mevzuat bölümü; Türkçe karakter testi (ş, ğ, ı, İ, ₺).
Kabul: üretilen PDF'in metni çıkarıldığında Türkçe karakterler doğru; 24 ay tablosu ve karşılaştırma isteğe bağlı; mevzuat uyarısı ve son kontrol tarihi her zaman var.

**İP-1.7 Mevzuat yol haritası ekranı** — `SPEC-legal.md` §5: liste, durum işaretleme, kritik yol süresi, karar ekranı rozeti, `candidate_permits` + RLS.
Kabul: TR kahve ve TR berber için liste görünüyor; durum değişikliği kaydediliyor; desteklenmeyen ülkede liste yerine genel uyarı çıkıyor; ekran hiçbir yerde "uygunsunuz" benzeri ifade içermiyor.

**İP-1.8 Mevzuat içeriğinin doğrulanması (TR)** — `packages/archetypes/legal/TR/*` maddeleri resmi kaynaklarından kontrol edilir; `sourceUrl`, `typicalDays`, `typicalCost`, `reviewedBy` doldurulur. Claude Code web araştırması yapabilir ama son onay insandadır (mali müşavir).
Kabul: TR'de `draft` madde kalmadı; doğrulanamayan madde silindi (tahminle doldurulmadı); production build yeşil.

**İP-1.9 Genel mod** — `STRATEGY.md` §2: `supportLevel: generic` ülkelerde para birimi seçimi, vergi/komisyon alanları boş ve elle, mevzuat ve otomatik demografi kapalı, sabit bilgi bandı.
Kabul: ülke olarak Fransa seçilince uygulama baştan sona çalışıyor, hiçbir TR/US varsayılanı sızmıyor, bilgi bandı her ekranda görünüyor.

**İP-1.10 Dağıtım: sektör sayfaları ve UTM** — `/[locale]/sektor/<id>`: video bağlantısı, kısa özet, "Kendi rakamlarınla hesapla". UTM parametreleri ilk oturumda profile yazılır.
Kabul: `?utm_content=<video-id>` ile gelen kullanıcının hızlı analiz tamamlama ve ücretli rapor olayları video bazında raporlanabiliyor.

**İP-1.11 TR/EN ve yayın** — `next-intl`, iki dilde tüm metinler; Vercel prod; yatırım ve mevzuat uyarıları her ekranda.
Kabul: `pnpm i18n:check` geçiyor; Lighthouse mobil performans ≥ 85, erişilebilirlik ≥ 95; KVKK aydınlatma metni ve kullanım şartları avukat görüşüyle yayında.

**İP-1.12 Düzenlemeli meslekler için motor ve şema hazırlığı (diş hekimi, veteriner)** — `SPEC-calc-engine.md` §6 (`svcShare`, hibrit kapasite), §10.1 (yaya trafiği `info` modu), §10.5 (sektöre özel kontrol listesi), §12.1 (taban fiyat); `SPEC-archetypes.md` §2.1 (`regulated`, `footTraffic`, `checklist.remove/add`, `priceFloors`, kalem `kind`); `legal:check`'in `priceFloors` kaynağını da denetlemesi. Yeni sektör bu İP'de yayına çıkmaz; Faz 1 içinde herhangi bir sırada yapılabilir, lansmanı bekletmez.
Kabul: 30 golden vaka değişmeden geçiyor; SPEC-calc-engine §15'teki yeni birim testleri yazılmış ve geçiyor (`info` modunda yaya bayrağı ve "say" teyidi yok; hiçbir kart taban fiyatın altına düşmüyor, `now` kartı değişmiyor; hibritte kapasite yalnız hizmet payına uygulanıyor); kaynaksız `priceFloors` varken production build kırmızı; `blocker` madde sektör listesinden çıkarılamıyor (şema testi).

## Faz 2 — Otomatik veri ve saha (≈4–5 hafta)

**İP-2.1 Adres ve rakipler** — Geocoding + Places Nearby; OpenStreetMap yedek kaynak; rakip listesi önerisi; kullanıcı onayı; atıf; önbellek kuralları.
Kabul: adres girildiğinde 1 km içindeki aynı tipteki işletmeler 5 sn içinde listeleniyor; kullanıcı çıkarıp ekleyebiliyor; Places kotası dolunca OSM'ye düşüyor ve kaynak etiketi değişiyor.

**İP-2.2 Demografi** — TÜİK ETL (mahalle nüfus/yaş), gelir vekili; ABD Census ACS (tract). `area_stats` + kaynak etiketi.
Kabul: İstanbul'da 3 farklı mahallede ve New York'ta 3 farklı adreste nüfus ve yaş otomatik doluyor; kaynak ve yıl görünüyor.

**İP-2.3 Saha sayacı** — Mobil tam ekran tek tuş, zamanlayıcı, dilim seçimi; sonuç Lokasyon'a yazılıyor.
Kabul: çevrimdışıyken sayılan veri bağlantı gelince kaydediliyor.

**İP-2.4 Medya ve AI inceleme** — Supabase Storage, yüz bulanıklaştırma, SPEC-ai bölüm 3; "uygula" akışları.
Kabul: yüz içeren bir sokak fotoğrafı yüklendiğinde saklanan dosyada yüzler bulanık; menü fotoğrafından fiyat okuma onayla rakibe yazılıyor.

**İP-2.4a Dış cephe incelemesi ve konum teyidi** — SPEC-ai §3.1, SPEC-architecture §5.8: telefonda rehberli 1–4 kare, yüz bulanıklaştırma, plaka gibi alanları elle kapatma, Claude incelemesi (köşe, komşular, tabela yeri, cephe önerisi), tek okumalık konum kaydı. Kareler sunucuda saklanmaz, bu yüzden Supabase beklemez; herkese açılmadan önce kullanıcı başına limit (İP-1.1) ve açık rıza metni (İP-1.11) gerekir.
Kabul: yüz içeren kare sunucuya bulanık gidiyor; elle işaretlenen alan sunucuya düz renk gidiyor, geri alınınca kare eski haline dönüyor; görselde görünmeyen bilgi `null` ve "görünmüyor" olarak çıkıyor, tahmin yapılmıyor; hiçbir öneri "Uygula" denmeden kaydedilmiyor; geçersiz AI yanıtı hata gösteriyor; konum izni reddedilince inceleme çalışıyor ve "konum teyidi yok" görünüyor; koordinat Claude isteğinde yok; ekran izin konusunda kesin ifade kurmuyor.

**İP-2.5 Rakip analizi** — SPEC-ai bölüm 2; yapılandırılmış çıktı; PDF'e ekleme.
Kabul: geçersiz AI yanıtı kullanıcıya hata olarak gösteriliyor, kısmi veri yazılmıyor.

**İP-2.6 Maliyet takibi** — `usage_events`; analiz başına Places + AI maliyet raporu (yönetim sayfası).
Kabul: son 30 günde analiz başına ortalama maliyet (USD) ve TL geliri yan yana görülebiliyor.

**İP-2.7 Ruhsat süresi finansa** — `SPEC-legal.md` §6: `preOpenMonths`; önce `SPEC-calc-engine.md` güncellenir.
Kabul: `preOpenMonths = 0` iken 30 golden vaka değişmeden geçiyor; `preOpenMonths > 0` için en az 4 yeni golden vaka eklendi; nakit açığı ve toplam yatırım ruhsat süresiyle artıyor.

### Rakip inceleme ve fiyat haritası (`SPEC-competitor-research.md`)

Sıra bilerek böyledir: İP-2.8 ve İP-2.9 API anahtarı, ödeme ve Supabase beklemez; kalanlar ayrı ayrı açılır.

**İP-2.8 Rakip inceleme kartı (≈3–4 gün)** — Rakip kartında kaynak bağlantıları, sektöre göre kontrol listesi, sepet kalemi başına elle fiyat girişi; kaynak ve gözlem tarihi zorunlu; servis ücreti, fiyat görünürlüğü, kampanya. Arketip ve ülke dosyasına `research`; şema ve `archetypes:check` güncellenir.
Kabul: dış çağrı olmadan çalışıyor; tarihsiz gözlem kaydedilmiyor; bağlantı kartta tıklanıp açılıyor; `generic` ülkede kaynak sırası ülke dosyasından geliyor; kodda ülke kontrolü yok; imza kalemi gözlemi yalnız "Uygula" ile `Competitor.price` oluyor; TR/EN anahtarları eşit; 30 golden vaka değişmedi.

**İP-2.9 Fiyat haritası (≈3–4 gün)** — `SPEC-calc-engine.md`'ye formül eklenir; test önce yazılır; `packages/engine` içinde `analyze()`'dan ayrı saf fonksiyon; Fiyat ekranında tablo, kendi yerin, paket indirimi, kanal farkı; PDF'e kaynak ve tarihle bölüm.
Kabul: aynı girdi ve `asOf` aynı sonucu veriyor; motor saat okumuyor; eski gözlem medyana girmiyor ama görünüyor; teslimat ve dükkân fiyatı karışmıyor; 3 rakip ve rakip başına 2 kalem altında "veri yetersiz" çıkıyor; tek gözlemden zam ritmi çıkmıyor; 30 golden vaka değişmedi; PDF'te yatırım uyarısı duruyor.

**İP-2.10 Görselden fiyat okuma (≈1 hafta)** — Önce `SPEC-ai.md`; kapı listesi, menü, web, randevu, teslimat ve sosyal medya görüntüsü için tek çağrı; öneriler kalem eşleşmesiyle gösterilir, kullanıcı satır satır onaylar. İP-2.4a'daki yüz kapatma ve elle alan kapatma kullanılır. Kullanıcı başına limit (İP-1.1) ve açık rıza (İP-1.11) gelmeden yayın derlemesinde kapalıdır. Görseldeki metin yalnız veridir.
Kabul: görselde olmayan fiyat `null` dönüyor; onaysız hiçbir değer yazılmıyor; geçersiz AI yanıtı hata gösteriyor ve kısmi veri yazılmıyor; yorum sahibi adı, kullanıcı adı ve kişi bilgisi çıktıda yok; görsele gömülü talimat testi sonucu değiştirmiyor; görsel saklanmıyor; yüz kapatılamazsa görsel gitmiyor; görsel başına gerçek maliyet ölçüldü ve `usage_events`'e yazıldı.

**İP-2.11 Bağlantıdan okuma (≈1 hafta, avukat görüşü şart)** — Kullanıcının yapıştırdığı işletme sitesi veya dijital menü için kullanıcı isteğiyle tek sayfa (HTML veya PDF). Sosyal medya, teslimat ve randevu alan adları engelli listededir; bu uygulamalar ekran görüntüsüyle ilerler. Toplu çekim, zamanlanmış çekim ve tarayıcı otomasyonu yok; okunamayan sayfada ekran görüntüsü önerilir.
Kabul: `robots.txt` izni yoksa çekim yapılmıyor; iç ağ ve yerel adresler reddediliyor (yönlendirme sonrası da); boyut, süre ve yönlendirme sınırı var; engelli alan adı reddediliyor; ham sayfa saklanmıyor; sayfadaki talimat testi sonucu değiştirmiyor; kullanıcı başına limit çalışıyor.

**İP-2.12 Kaynak keşfi (≈3 gün, İP-2.1'den sonra)** — OSM `website` ve `contact:*` etiketleri, Places `websiteUri` canlı gösterim, işletme sitesindeki sosyal bağlantılar. İsimden tahminle hesap eşleştirilmez.
Kabul: önerilen bağlantı kullanıcı onaylamadan rakibe bağlanmıyor; Places'ten gelen ad, puan ve site projeye yazılmıyor; atıf görünüyor; Places sonucu Google dışı haritada gösterilmiyor.

## Faz 3 — Ölçek, gelir ve ikinci pazar (≈7–8 hafta)

- **İP-3.1** Arketip motoru genişletme: +8 sektör (SPEC-archetypes bölüm 5), her biri için golden vaka, `siteRequirements` ve `requiresCertificate` alanları, TR mevzuat dosyası. **İlk ikisi diş hekimi (`dentist`) ve veteriner kliniği (`vet`)**; İP-1.12'deki alanları kullanır.
  Kabul (diş hekimi ve veteriner için ek): TR mevzuat dosyası ve (varsa) taban fiyat kaynağı, meslek alanını bilen bir uzmanla (sağlık hukukçusu veya bu alanda çalışan mali müşavir) resmi kaynaktan doğrulandı, doğrulanamayan madde silindi; her sektör için en az 2 golden vaka, temel sayıları motordan bağımsız hesap tablosuyla elle doğrulanarak eklendi; taktik metinleri ve Claude promptları reklam kısıtına uygun (indirim, kampanya, karşılaştırmalı iddia yok); her iki sektörün videosu yayımlanınca sektör sayfası açıldı.
- **İP-3.2** Ödeme: iyzico + Stripe; freemium sınırları sunucuda; fiyatlar ülke dosyasında.
- **İP-3.3** Açılış sonrası takip (`actuals`), tahmin/gerçekleşen grafiği, e-posta hatırlatması.
- **İP-3.4** Kalibrasyon paneli: gerçekleşen verilerden eşiklerin (giriş oranı, kira/ciro, doygunluk) şehir/sektör bazında güncellenmesi önerisi (otomatik değil, insan onayıyla).
- **İP-3.5** Paylaşım bağlantısı (salt okunur rapor) ve danışman paketi (marka logolu PDF).
- **İP-3.6** Sektör hayatta kalma göstergesi: `sector_stats` ETL (TOBB, Census BDS); karar ekranında bağlam satırı (`SPEC-alternatives.md` §5).
- **İP-3.7** "Bu dükkânda ne tutar?" (`SPEC-alternatives.md` §1–3). Kabul: §7'deki birim ve özellik testleri geçiyor; `alternatives-cases.json` üretildi; "Senin fikrin (aynı koşulda)" satırı her zaman görünüyor; öneri metni hiçbir yerde "şunu açmalısın" demiyor.
- **İP-3.8** Mal sahibi / emlakçı raporu (`SPEC-alternatives.md` §3.5), ücretli.
- **İP-3.9** Almanya diaspora paketi: `DE` ülke dosyası (`full`), Türkçe arayüzle; `packages/archetypes/legal/DE/*` hazırlanıp doğrulanır (Gewerbeanmeldung, Meisterpflicht, gıda kayıtları); KfW kredi varsayılanları.
  Kabul: Türkçe arayüzle Berlin'de kahve ve berber analizi baştan sona çalışıyor; DE mevzuat maddeleri doğrulanmış.
- **İP-3.10** Rakip fiyat takibi (`SPEC-competitor-research.md`): gözlem yenileme hatırlatması, tarihli iki gözlemden zam ritmi, kendi fiyatının farkı.
  Kabul: hatırlatma kullanıcının açtığı rakiplerle sınırlı; hatırlatma otomatik veri çekmiyor; tarihi 30 günden yakın iki gözlemden ritim çıkmıyor.
- **İP-3.11** Dış veri kapıları (karar işi; kod yalnız karar çıkarsa): Fiyat Etiketi Yönetmeliği md. 8/5'teki Bakanlık fiyat sistemi yayımlanır ve erişim şartları uygunsa kaynak olarak değerlendirilir; Meta Business Discovery API yalnız aktiflik verisi için ve Meta incelemesi gerekliliğiyle yeniden tartılır (varsayılan: yapma).
  Kabul: her kapı için güncel şartlar okunmuş, karar ve gerekçe spesifikasyona yazılmış.

## Faz 4 — Genişleme

- **ABD lansmanı** — kapı (`STRATEGY.md` §3) geçilince: US mevzuat doğrulaması (NYC, Austin), İngilizce sektör sayfaları, Stripe.
- "Bu iş için en iyi semtler" (`SPEC-alternatives.md` §4).
- Kaynaklı mevzuat soru-cevap (`SPEC-legal.md` §7).
- Bölge takip bildirimi: "takip ettiğin semtte aynı sektörde yeni işletme açıldı / kapandı".
- Almanca arayüz; yaya trafiği veri ortağı (ör. `COMPETITION.md` §6'daki yerli oyuncular).
- Banka / franchise B2B entegrasyonları; uygulama mağazaları.
- Mevsimsellik profili (motor değişikliği → golden fixture yenilenir).

## Faz geçiş kontrolü

Her faz sonunda Claude Code'a şunu sor: "Bu fazın tüm İP kabul kriterlerini tek tek kontrol et; geçmeyen varsa listele." Liste boşsa bir sonraki faza geç.
