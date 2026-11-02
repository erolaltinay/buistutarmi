# SPEC — "Bu dükkânda ne tutar?" ve "Bu iş için en iyi semtler"

İki özellik, aynı motorun iki yönde kullanılması:

| Özellik | Sabit | Değişen | Emsal |
|---|---|---|---|
| **Alternatif işler** (bölüm 2–3) | Dükkân (adres, kira, m², bölge, yaya) | İş tipi (arketip) | Seul "yakında patron olacaklar" listesi; emlakta "en verimli kullanım" |
| **En iyi semtler** (bölüm 4) | İş tipi | Semt / mahalle | Sebrae Radar de Negócios |

İkisi de **Faz 3** özelliğidir; ön koşulları bölüm 6'da.

## 1. İlkeler

1. **Öneriyi motor hesaplar, yapay zekâ uydurmaz.** Her alternatif, `SPEC-calc-engine.md`'deki `analyze()` ile aynı formüllerden geçer. Claude en fazla hesaplanmış sonuçları özetleyen kısa bir metin yazar ve bu metin "Claude özeti" olarak etiketlenir.
2. **Eşit koşul.** Kullanıcının kendi işi de alternatiflerle aynı varsayılanlarla bir kez daha hesaplanır ve listede "Senin fikrin (aynı koşulda)" satırı olarak durur. Kullanıcının ayrıntılı analizi ayrı bir satırda, açıkça etiketli gösterilir. Ayrıntılı analiz ile varsayılan analiz asla aynı sıralamada karıştırılmaz.
3. **Dil.** "Burada şunu açmalısın" denmez. Başlık: "Bu dükkânın verisine göre en güçlü alternatifler". Her satırda varsayımlar ve veri güveni görünür.
4. **Şeffaflık.** Her puanın bileşenleri tıklanınca açılır.

## 2. Alternatif işler: girdiler

**Dükkândan ortak alınanlar** (adaydan): adres ve koordinat, aylık kira, m², bölge profili (`demo`, `pop`), yaya sayımı (`loc.foot`, `countMin`), dükkân geçmişi, kontrol listesinin dükkâna ait maddeleri (`commuteSide, anchor, visible, access, futurePlus, noDisrupt, lowSeason, weekBalance, permitOk, outdoor`), girişimci profili.

**Her arketip için ayrı:** sektör varsayılanları (`defaults[country]`: menü, capex, personel, senaryolar, fin), 1 km içindeki o sektörün rakipleri (`googlePlaceTypes` ile Places veya OSM; bkz. bölüm 6), kontrol listesinin sektöre ait maddeleri (`staffAvail`, `wageOk`) `null` (bilinmiyor) başlar.

**Kira özel kuralı:** Arketip varsayılanındaki kira satırı yerine adayın gerçek kirası kullanılır. Diğer sabit giderler sektör varsayılanıdır.

**Kullanıcı kısıtları** (ekranın üstünde, hepsi isteğe bağlı):
- Toplam bütçe üst sınırı (`invest` için).
- Öz sermaye oranı (girişimci profilinden gelir).
- Tecrübe sahibi olduğu sektörler.
- İstemediği sektörler.
- Sahibi her gün başında olacak mı (girişimci profilinden).
- Belge gerektiren işler için: "Gerekirse belgeyi alabilirim" anahtarı.

**Dükkân nitelikleri** (adaya yeni alanlar): m², zemin kat mı, cephe genişliği (m), havalandırma/davlumbaz kurulabilir mi, su ve gider var mı, ayrı depo var mı.

## 3. Alternatif işler: yöntem

### 3.1 Uygunluk filtreleri (eleme)

Arketip dosyasına eklenecek alan:

```jsonc
"siteRequirements": { "minM2": 25, "maxM2": null, "groundFloor": true, "hood": false, "water": true },
"requiresCertificate": null            // ör. barber: "mastery" (ustalık belgesi); ülkeye göre legal dosyasından gelir
```

Bir arketip şu durumlarda listeden **çıkarılır** ve "Elenenler" bölümünde nedeniyle gösterilir:
- Dükkân niteliği `siteRequirements`'ı karşılamıyorsa (ör. davlumbaz gerekli, kurulamıyor).
- Kullanıcının hariç tuttuğu sektörse.
- Belge gerekiyor, kullanıcıda yok ve "belgeyi alabilirim" kapalıysa.

Şu durumlarda listede **kalır ama işaretlenir**:
- `invest` bütçe üst sınırını aşıyorsa ("bütçeyi aşıyor").
- Belge gerekiyor ve "alabilirim" açıksa ("belge gerekir").
- Nitelik bilinmiyorsa ("dükkân niteliği teyit edilmeli").

### 3.2 Fırsat puanı (0–100)

Her arketip için `r = analyze(inputFor(archetype), archetype, country)`:

```
vScore   = r.verdict == GO ? 100 : r.verdict == MID ? 55 : 10
pScore   = isFinite(r.payAll) ? clamp((48 − r.payAll) / 36) · 100 : 0
dScore   = r.demandFit.score
sScore   = { lo: 100, mid: 60, hi: 20 }[r.competition.saturation]   (rakip verisi yoksa 50)
lScore   = r.location.score
fScore   = 100 · (0.5 · deneyimVar + 0.5 · bütçeİçinde)               (kısıt girilmemişse 50)

opportunity = 0.30·vScore + 0.20·pScore + 0.15·dScore + 0.15·sScore + 0.10·lScore + 0.10·fScore
```

Ağırlıklar `packages/archetypes/alternatives.json` içinde tutulur, kodda yazılmaz. Sıralama: `opportunity` azalan; eşitlikte `payAll` artan; sonra arketip `id` alfabetik (deterministik).

`blocker` (ruhsat çıkmıyor) dükkân geneline uygulanır: tüm alternatifler TUTMAZ olur ve ekranın üstünde "Bu dükkânda belediye ruhsat vermiyor; önce bunu çöz" uyarısı çıkar.

### 3.3 Gerekçe cümleleri

Gerekçe şablonla üretilir (Claude değil). Bileşenlerden en güçlü iki olumlu ve en zayıf bir olumsuz seçilir:

- TR: "{sektör}: 1 km'de {n} rakip ({doygunluk}), talep uyumu {d}/100, başabaş günde {be} {birim}, geri dönüş {pay} ay."
- Olumsuz ek: "Dikkat: {en zayıf bileşen}."

Şablonlar `messages/*.json` içindedir.

### 3.4 Ekran

- Aday sayfasında "Bu dükkânda başka ne tutar?" düğmesi → `/projects/[id]/candidates/[cid]/alternatives`.
- Üstte kısıtlar ve dükkân nitelikleri; altında sıralı liste: sıra, sektör, karar damgası, fırsat puanı, 4 temel sayı, gerekçe, rozetler (bütçeyi aşıyor, belge gerekir, teyit edilmeli), veri güveni.
- "Senin fikrin (aynı koşulda)" satırı her zaman listede, sırası ne olursa olsun.
- Her satırda "Bunu ayrıntılı analiz et": aynı adayla, seçilen arketiple yeni proje açar.
- "Elenenler" katlanır bölümü.
- PDF'te isteğe bağlı "Bu dükkân için alternatifler" bölümü.

### 3.5 B2B: mal sahibi raporu

Mal sahibi veya emlakçı için aynı hesap, kullanıcı kısıtları olmadan: "Bu dükkân en çok ne için uygun?" Raporda ilk 5 sektör, her biri için beklenen kira taşıma kapasitesi (`rr` eşiğine göre bu sektörün sağlıklı ödeyebileceği azami kira = `t0 · base · days · ticketNet / 100`). Ücretli ürün (Faz 3, İP-3.8).

## 4. Bu iş için en iyi semtler

**Girdi:** arketip, şehir, (isteğe bağlı) bütçe ve kira aralığı.

**Birimler:** Türkiye'de mahalle, ABD'de census tract. Şehir başına en fazla 60 birim (maliyet).

**Her birim için:**
- `area_stats` → talep uyumu (§9 formülü).
- O sektörün rakip sayısı (birimin merkezinden 1 km; Places veya OSM) → doygunluk.
- Kira referansı: kullanıcının girdiği ya da semt referans değeri (kaynak etiketiyle; yoksa şehir ortalaması ve "düşük güven").
- Bu kirayla ve sektör varsayılanlarıyla `analyze()` → karar, başabaş, geri dönüş.

**Sıralama:** `0.35·dScore + 0.25·sScore + 0.25·vScore + 0.15·pScore` (yaya verisi semt düzeyinde olmadığı için lokasyon puanı girmez). Ağırlıklar `alternatives.json` içinde.

**Ekran:** harita + liste; her semtte "Burada aday dükkân ekle". Uyarı: "Semt düzeyinde ön eleme; dükkân seçimi için sokak düzeyinde sayım ve lokasyon karnesi gerekir."

## 5. Sektör hayatta kalma göstergesi (bağlam)

Karar ve alternatif ekranlarında, sektörün bölgedeki hayatta kalma göstergesi **bağlam satırı** olarak gösterilir; ilk sürümde puana girmez.

- **Türkiye:** TOBB kurulan / kapanan şirket istatistikleri (il ve sektör düzeyi). Uyarı: esnaf işletmelerinin önemli kısmı şirket değildir; gösterge eksik kalabilir.
- **ABD:** Census Business Dynamics Statistics (BDS): sektör ve eyalet/metro düzeyinde işyeri çıkış oranları.
- **Yerel:** Kullanıcıların girdiği "dükkân geçmişi" ve açılış sonrası verileri (`actuals`) birikince semt düzeyinde gösterge üretilir (Faz 4, en az 30 kayıt eşiği, anonim ve toplu).
- Veri çekme işi ETL'dir, `area_stats` gibi `sector_stats(country, geo_code, sector_code, year, survival_1y, survival_3y, survival_5y, source)` tablosuna yazılır. Kaynağın kullanım şartları ve yıl her gösterimde yazılır.

## 6. Ön koşullar ve özellik bayrağı

- En az **8 arketip** yayında (ROADMAP İP-3.1).
- Otomatik rakip verisi (İP-2.1) ve `googlePlaceTypes` her arketipte dolu.
- Her arketipte `siteRequirements` ve gerekiyorsa `requiresCertificate` dolu.
- `area_stats` hedef şehirlerde dolu (İP-2.2).
- Özellik bayrağı: `alternatives.enabled` (ülke bazında). Koşullar sağlanmadıysa düğme görünmez.

**Maliyet:** Bir alternatif çalıştırması = arketip sayısı kadar rakip sorgusu. Kurallar: aynı koordinat + tip için Places sonucu şartların izin verdiği süre kadar önbellek; OSM önce denenir; ücretsiz planda alternatif çalıştırma sayısı sınırlı. Her çalıştırma `usage_events`'e yazılır.

## 7. Test

- **Birim:** puan bileşenleri, filtreler, eşitlik kırma, `blocker` davranışı.
- **Özellik testleri:** (a) kira artınca hiçbir arketipin puanı artmaz; (b) bir sektörün rakibi eklenince o sektörün `sScore`'u artmaz; (c) sıralama aynı girdiyle her çalıştırmada aynı.
- **Golden:** İP-3.7 sırasında, Moda kahve adayı ve Park Slope berber adayı için 8 arketiplik sonuç `tests/fixtures/alternatives-cases.json` olarak üretilir ve sabitlenir.
