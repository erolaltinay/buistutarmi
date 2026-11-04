# SPEC — Sektör arketipleri ve ülke ayarları

Hedef: yeni bir sektör eklemek kod değil, bir JSON dosyası işi olsun. Motor arketipten gelen ayarlarla çalışır; sektöre özel davranış `if (biz === 'coffee')` ile yazılmaz.

## 1. Arketip türleri

| model | Başabaş birimi | Sektöre özel blok | Örnek |
|---|---|---|---|
| `product` | satış / gün | Ürünler: fiyat, malzeme maliyeti, satış payı, fire | Kahve, fırın, dondurmacı |
| `service` | müşteri / gün | Hizmetler + kapasite (istasyon × saat ÷ süre) | Berber, oto yıkama, kuru temizleme, diş hekimi |
| `hybrid` | işlem / gün | İkisi birden; kapasite sadece hizmet kalemlerine uygulanır | Berber + ürün satışı, kafe + atölye, veteriner kliniği |

## 2. Dosya şeması (`packages/archetypes/sectors/<id>.json`)

```jsonc
{
  "id": "coffee",
  "version": 1,
  "model": "product",
  "name": { "tr": "Kahve dükkânı", "en": "Coffee shop" },
  "unit": { "tr": ["satış", "satış / gün"], "en": ["sales", "sales / day"] },
  "googlePlaceTypes": ["coffee_shop", "cafe"],
  "osmTags": [{ "amenity": "cafe" }],                         // OpenStreetMap yedeği (SPEC-architecture §5.1)
  "siteRequirements": { "minM2": 25, "groundFloor": true, "hood": false, "water": true },  // SPEC-alternatives §3.1
  "requiresCertificate": null,                                // barber: "mastery"; ülkeye göre legal dosyasıyla eşleşir

  "capexTemplate": [
    { "k": "espresso", "type": "equipment", "label": { "tr": "Espresso makinesi", "en": "Espresso machine" } },
    { "k": "stock", "type": "inventory", "depreciable": false, "label": { "tr": "İlk stok", "en": "Opening inventory" } },
    { "k": "permits", "type": "permit", "depreciable": false, "label": { "tr": "Ruhsat / kuruluş", "en": "Licenses + permits" } }
  ],
  "fixedTemplate": [
    { "k": "rent", "type": "rent", "label": { "tr": "Kira", "en": "Rent" } },
    { "k": "staff2", "type": "staff", "label": { "tr": "Personel (2 kişi)", "en": "Staff (2 people)" } },
    { "k": "utilities", "type": "other", "label": { "tr": "Elektrik / su / doğalgaz", "en": "Utilities" } }
  ],
  "itemTemplate": [
    { "k": "espresso_d", "signature": true, "label": { "tr": "Latte / espresso bazlı", "en": "Latte / espresso drink" } },
    { "k": "filter", "label": { "tr": "Filtre kahve", "en": "Drip coffee" } }
  ],
  "capacity": null,

  "competition": {
    "saturationPeoplePerBusiness": [1500, 3000],
    "qualityWeaknessKeys": ["ordinary"],
    "tags": {
      "strengths": { "fast": { "tr": "Hızlı servis", "en": "Fast service" }, "specialty": { "tr": "Spesiyalite kahve", "en": "Specialty coffee" } },
      "weaknesses": {
        "slow": { "tr": "Yavaş servis", "en": "Slow service",
                  "tactic": { "tr": "Sabah için \"kahven 2 dakikada\" sözü ver, mobil ön sipariş kur.", "en": "Promise \"your coffee in 2 minutes\" for the morning rush and add mobile pre-order." } }
      }
    }
  },

  "demandFit": {
    "features": [
      { "key": "young", "weight": 40, "expr": "clamp((a1-15)/25)" },
      { "key": "income", "weight": 35, "expr": "idx==null ? 0.5 : clamp((idx-70)/60)" },
      { "key": "daytime", "weight": 25, "expr": "clamp(dayR/0.5)" }
    ]
  },

  "location": {
    "captureRatePct": [2, 4],
    "rentToSalesPct": [12, 18],
    "checklistOverrides": { "staffAvail": { "tr": "Bölgede deneyimli barista bulmak kolay", "en": "Experienced baristas are easy to hire here" } }
  },

  "defaults": {
    "TR": { "days": 30, "scen": [70, 130, 190], "fin": { "kdv": 10, "platShare": 10, "waste": 5 } },
    "US": { "days": 30, "scen": [200, 320, 440], "fin": { "kdv": 0, "platShare": 8, "waste": 5 } }
  },

  "ai": {
    "businessNoun": { "tr": "kahve dükkânı", "en": "coffee shop" },
    "promptHints": "Morning commute and laptop workers drive demand; signature drink quality and speed matter most."
  },

  "storefront": {
    "sampleName": "Kahve Durağı",       // mağaza görselindeki varsayılan ad
    "decal": "cup",                     // vitrin simgesi: cup | scissors | none (varsayılan none)
    "pole": false                       // berber direği (varsayılan false)
  }
}
```

`expr` alanları güvenli bir ifade değerlendiricisiyle (whitelist: sayılar, değişkenler `a1 a2 a3 idx dayR pop hh`, `clamp`, `+ - * /`, `?:`, `==`, `null`) çalıştırılır; `eval` kullanılmaz. Alternatif: her özellik için önceden tanımlı fonksiyon adları.

Berber (`service`) için ek alan:

```jsonc
"capacity": { "defaults": { "stations": 3, "hours": 10, "serviceMin": 40 } },
"competition": { "saturationPeoplePerBusiness": [1200, 2500], "qualityWeaknessKeys": ["inconsistent", "shabby"] },
"location": { "captureRatePct": [0.6, 1.5], "rentToSalesPct": [15, 22] }
```

Prototipteki kahve ve berber ayarlarının tamamı (etiketler, taktikler, örnek veriler) `prototype/bu-is-tutar-mi-mvp.html` içindeki `TAGS`, `TACTIC`, `P`, `LOCP`, `QUALITY_GAP`, `SAT_T`, `CHK` sabitlerinden bu şemaya taşınır.

### 2.1 Düzenlemeli meslekler (diş hekimi, veteriner)

Ruhsatı meslek lisansına bağlı, reklamı kısıtlı ve fiyatı tarifeyle sınırlanabilen meslekler için ek alanlar. İlk iki sektör: `dentist` (diş hekimi muayenehanesi, `service`) ve `vet` (veteriner kliniği, `hybrid`). Hazırlık Faz 1'de (İP-1.12), yayın Faz 3'te (İP-3.1).

```jsonc
"regulated": {
  "profession": "dentist",            // meslek lisansı anahtarı; requiresCertificate ile aynı
  "marketingRestricted": true         // taktikler ve Claude önerileri indirim/kampanya/reklam iddiası içermez (SPEC-ai §1)
},
"location": {
  "footTraffic": "info",              // scored (varsayılan) | info — SPEC-calc-engine §10.1
  "captureRatePct": [0, 0], "rentToSalesPct": [..]
},
"checklist": {                        // ortak kontrol listesine göre fark
  "remove": ["commuteSide", "outdoor"],
  "add": [ { "k": "healthUseOk", "critical": true, "blocker": false, "label": {..}, "flag": {..} } ]
},
"itemTemplate": [
  { "k": "exam", "kind": "service", "signature": true, "label": {..} },
  { "k": "food", "kind": "product", "label": {..} }      // hybrid'de her kalemin kind'ı zorunlu
],
"defaults": {
  "TR": {
    "sample": "...", "fin": { .. },
    "priceFloors": {                  // SPEC-calc-engine §12.1; yoksa taban yok
      "sourceUrl": "https://...",     // meslek kuruluşunun resmi tarifesi
      "lastReviewed": "YYYY-MM-DD",
      "reviewedBy": "...",
      "items": { "exam": 0 }          // kalem anahtarı → taban fiyat (ülke para biriminde)
    }
  }
}
```

Kurallar:

- **Taban fiyatlar mevzuat gibi ele alınır.** `priceFloors` boş kaynakla veya doğrulanmadan (`reviewedBy` boş) production'a çıkamaz; `legal:check` bunu da denetler (`price-floor-source`, `price-floor-reviewed-by`). Tarife yıllık değişebildiği için `lastReviewed` 12 aydan eskiyse uyarı verir. Hangi meslekte gerçekten bağlayıcı bir taban olduğu İP-3.1'de resmi kaynaktan doğrulanır; doğrulanamazsa `priceFloors` hiç yazılmaz.
- **Kontrol listesi farkı:** `remove` ortak listedeki anahtarları çıkarır, `add` sektöre özel madde ekler. `blocker` maddeler (ör. `permitOk`) çıkarılamaz; eklenen anahtar ortak listedekiyle çakışamaz; `location.checklistOverrides` yalnız listede kalan etiketsiz maddeleri içerir. Hepsi şemada denetlenir. Eklenen maddeler kullanıcının cevapladığı sorulardır; hukuki hüküm içermez.
- **Taktik ve etiket metinleri** `marketingRestricted` sektörde indirim, kampanya, "en iyi / en ucuz" gibi karşılaştırmalı iddia içermez; bilgilendirici olur (randevu kolaylığı, şeffaf fiyat listesi, hijyen, erişilebilirlik gibi).
- **Mağaza görseli** bu sektörlerde tabela ve cephe taslağı olarak kalır; slogan alanı kapalıdır.

## 3. Ülke ayarları (`packages/archetypes/countries/<code>.json`)

```jsonc
{
  "code": "TR", "currency": "TRY", "locale": "tr-TR",
  "supportLevel": "full",                                     // full | generic (STRATEGY §2)
  "launched": true,                                           // false: veri hazır ama pazarlama/ödeme kapalı (US kapısı)
  "priceRounding": 5,
  "pricing": { "detailedReport": null, "currency": "TRY" },   // lansman öncesi test edilip doldurulur; kodda fiyat yok
  "legal": "legal/TR",                                        // SPEC-legal §2
  "fin": { "rampStart": 50, "rampMonths": 6, "priceInc": 30, "inflCost": 30, "rentInc": 30, "wageInc": 30,
           "cardShare": 80, "cardFee": 2.5, "platFee": 25, "stopaj": 20, "employer": 20,
           "profitTax": 25, "loanRate": 45, "loanTerm": 36, "depYears": 5 },
  "taxNote": { "tr": "Oranlar sık değişir; muhasebecine teyit ettir.", "en": "Rates change often; confirm with your accountant." },
  "dataSources": { "demographics": "TUIK_ADNKS", "income": "PROXY", "elections": "YSK" },
  "lastReviewed": "YYYY-MM-DD"
}
```

ABD: `currency USD`, `priceRounding 0.25`, `kdv 0`, `stopaj 0`, `employer 10`, `loanRate 10`, `loanTerm 60`, artışlar 3–4. Oranlar en az altı ayda bir gözden geçirilir; `lastReviewed` 6 aydan eskiyse yönetim panelinde uyarı çıkar.

Birleştirme sırası: `ülke.fin` → `sektör.defaults[ülke].fin` → kullanıcı girdisi.

**`GENERIC` şablonu (`countries/GENERIC.json`):** `supportLevel: "generic"`, `legal: null`, `dataSources` boş. `fin` içinde vergi, stopaj, işveren yükü, komisyon, artış ve faiz alanları `null`: boş alan hesapta 0 sayılır ama kullanıcı doldurana kadar sonuçlar "eksik veri" uyarısıyla gösterilir (`STRATEGY.md` §2: boş ve elle). Fiyat veya baz satış gibi temel girdi boşken karar damgası yerine "eksik veri" görünür. Proje örnek veri olmadan, boş girdiyle başlar (`buildBlankInput`); ülkeye özgü terimler (KDV, SGK, stopaj) yerine genel adlar kullanılır (`messages` → `genericTerms`). Para birimi kullanıcı seçer; `priceRounding` para biriminden türetilir. Listede olmayan her ülke bu şablonu kullanır.

**DE (Faz 3):** `currency EUR`, `supportLevel: full`, Türkçe ve (sonra) Almanca arayüz; Meisterpflicht gerektiren sektörlerde (ör. berber) `requiresCertificate` legal dosyasıyla eşleşir.

## 4. Yeni sektör ekleme kontrol listesi

1. `sectors/<id>.json` oluştur; zod şemasından geçsin.
2. En az 6 güçlü ve 6 zayıf etiket; her zayıflığa bir taktik.
3. Doygunluk, giriş oranı ve kira/ciro eşiklerini kaynakla gerekçelendir (PR açıklamasında).
4. TR ve US için örnek veri.
5. `googlePlaceTypes`, `osmTags`, `siteRequirements` ve gerekiyorsa `requiresCertificate` dolu.
6. `full` destekli her ülke için `legal/<ÜLKE>/<id>.json` mevzuat dosyası; maddeler doğrulanmadan sektör o ülkede yayına çıkmaz (`SPEC-legal.md` §4).
7. Motor testleri: yeni sektör için en az 2 golden vaka eklenir.
8. Düzenlemeli meslekte (§2.1): `regulated`, `footTraffic`, kontrol listesi farkı ve (varsa) doğrulanmış `priceFloors`; taktikler reklam kısıtına uygun; mevzuat ve taban fiyat doğrulaması meslek alanını bilen bir uzmanla (sağlık hukukçusu veya bu alanda çalışan mali müşavir) yapılır.
9. Videosu yayımlanınca sektör sayfası açılır (`/[locale]/sektor/<id>`), video gömülür, "Kendi rakamlarınla hesapla" butonu sihirbazı bu arketiple başlatır.

## 5. İlk yıl sektör sırası (öneri)

Ürün: kahve, fırın, dondurmacı, çiçekçi, kuruyemiş, kasap.
Hizmet: berber, kuaför, oto yıkama, kuru temizleme, terzi, evcil hayvan bakımı, spor stüdyosu.
Karma: berber + ürün, pastane + kafe, bisiklet tamir + satış.
Düzenlemeli meslekler (öncelikli, İP-3.1'in ilk iki sektörü): diş hekimi (`dentist`, service), veteriner kliniği (`vet`, hybrid).
