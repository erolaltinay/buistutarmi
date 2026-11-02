# SPEC — Mevzuat yol haritası

Amaç: Kullanıcıya "dükkânı açmak için hangi belgeyi, hangi kurumdan, yaklaşık ne sürede alacağım?" sorusunun **kontrol listesi** olarak cevabını vermek. Uygulama bir hukuk motoru değildir: uygunluk kararı vermez, sadece yol gösterir ve kaynağı gösterir.

## 1. Kapsam ve sınırlar

**Yapar**
- Ülke × sektör (ve gerekiyorsa il/eyalet/şehir) için izin, kayıt ve belge listesi.
- Her maddenin kurumunu, resmi kaynağını, tahmini süresini ve maliyet aralığını gösterir.
- Kullanıcı maddeleri işaretler: `done` aldım, `applied` başvurdum, `todo` yapılacak, `unknown` bilmiyorum, `na` bana uygulanmaz.
- Kritik ve tamamlanmamış maddeleri karar ekranında ve PDF'te "açmadan önce teyit et" listesine koyar.
- Faz 2'den itibaren ruhsat süresini finans modeline bağlar (bölüm 6).

**Yapmaz**
- "Uygunsunuz", "bu belgeler yeterli", "ruhsat çıkar" gibi kesin ifade kurmaz.
- Kaynağı olmayan madde göstermez.
- Yapay zekâ ile serbest mevzuat metni üretmez (bölüm 7).
- Desteklenmeyen (`supportLevel: generic`) ülkelerde liste göstermez; yerine genel başlıklar ve "yerel belediyene ve mali müşavirine danış" metni çıkar.

Her ekranda ve PDF'te sabit uyarı: "Bu liste genel bir rehberdir ve değişebilir. Başvurmadan önce belediyene, ilgili kuruma ve mali müşavirine teyit ettir. Son kontrol: {lastReviewed}."

## 2. Dosya yapısı

```
packages/archetypes/legal/
  <COUNTRY>/common.json            # o ülkede her sektöre uygulanan maddeler
  <COUNTRY>/<sector>.json          # sektöre özel maddeler
  <COUNTRY>/regions/<REGION>.json  # il / eyalet / şehir eki veya geçersiz kılması (ör. US-NY-NYC, US-TX-AUSTIN)
```

Birleştirme: `common` → `sector` → `region` (aynı `id` sonradan gelenle geçersiz kılınır; `"removed": true` maddeyi kaldırır).

İlk taslaklar `seed/legal/` altında geldi (bölüm 8) ve Faz 0'da (İP-0.3) `packages/archetypes/legal/` altına taşındı.

## 3. Madde şeması (zod)

```ts
const LegalItem = z.object({
  id: z.string(),                                   // 'tr.common.workplace_license'
  title: z.object({ tr: z.string(), en: z.string() }),
  what: z.object({ tr: z.string(), en: z.string() }),          // 1–2 cümle, sade dil
  authority: z.object({ tr: z.string(), en: z.string() }),     // kurum adı
  sourceUrl: z.string().url().or(z.literal('')),               // resmi kaynak; yayında boş olamaz
  appliesTo: z.object({
    sectors: z.array(z.string()).or(z.literal('all')),
    condition: z.enum(['always','hasEmployees','servesFood','outdoorSeating','hasSign','sellsAlcohol','other']).default('always'),
  }),
  stage: z.enum(['before_lease','before_opening','after_opening']),
  critical: z.boolean(),                            // olmadan açılamaz mı?
  typicalDays: z.tuple([z.number(), z.number()]).nullable(),   // [min, max] takvim günü
  typicalCost: z.object({ min: z.number(), max: z.number(), currency: z.string() }).nullable(),
  dependsOn: z.array(z.string()).default([]),       // önce tamamlanması gereken maddeler
  verification: z.object({
    status: z.enum(['draft','verified']),
    reviewedBy: z.string().optional(),              // 'mali müşavir', 'avukat', 'resmi site'
    lastReviewed: z.string(),                       // YYYY-MM-DD
  }),
  notes: z.object({ tr: z.string(), en: z.string() }).optional(),
});
```

## 4. Doğrulama kuralları (CI)

1. `supportLevel: full` olan bir ülkede `verification.status = 'draft'` olan madde varsa **production build başarısız olur**. Taslak maddeler sadece önizleme ortamında "Taslak — doğrulanmadı" rozetiyle görünür.
2. Yayındaki her maddede `sourceUrl` dolu olmalı.
3. `lastReviewed` 6 aydan eskiyse yönetim panelinde uyarı; 12 aydan eskiyse madde "güncelliği doğrulanmadı" rozetiyle gösterilir.
4. `dependsOn` döngü içeremez.
5. Her `full` ülke × sektör için en az bir `critical` madde bulunmalı.

## 5. Ekran ve rapor

- **Rota:** `/projects/[id]/legal` (sekme adı: TR "Mevzuat", EN "Permits").
- **Görünüm:** `stage`'e göre gruplu liste (kiralamadan önce / açılıştan önce / açılıştan sonra). Her satırda başlık, kurum, kritik rozeti, tahmini süre, durum seçici, "Resmi kaynak" bağlantısı.
- **Zaman çizelgesi:** `dependsOn` ve `typicalDays` ile kritik yol; "tahmini toplam süre: X–Y gün".
- **Karar ekranı:** kritik ve `done` olmayan madde sayısı rozet olarak; Lokasyon kontrol listesindeki `permitOk` maddesiyle bağlantılı (kullanıcı `permitOk = hayır` derse karar zaten TUTMAZ).
- **PDF:** "Mevzuat yol haritası" bölümü: madde, kurum, durum, süre, kaynak; sabit uyarı ve son kontrol tarihi.
- **Durum saklama:** `candidate_permits(candidate_id, item_id, status, note, updated_at)`; RLS.

## 6. Finans bağlantısı (Faz 2, motor değişikliği)

Ruhsat beklerken kira ödenir, satış olmaz. Motora yeni girdi:

```
preOpenMonths = kullanıcı girdisi; varsayılan = ceil(kritik yol üst sınırı (gün) / 30), en fazla 6
preOpenRentShare = 1.0 (kira tamamen), preOpenOtherShare = 0.3 (diğer sabitlerin bir kısmı), personel 0
```

Projeksiyondan önce `preOpenMonths` kadar "0. aylar" eklenir: ciro 0, gider = rent0 + other0 · preOpenOtherShare, kredi faizi işler. Bu aylar nakit açığına (`trough`) girer, dolayısıyla işletme sermayesine ve toplam yatırıma yansır.

Bu bir formül değişikliğidir. `CLAUDE.md` kural 2 uygulanır: önce `SPEC-calc-engine.md`'ye yeni bölüm yazılır, `preOpenMonths = 0` iken mevcut 30 golden vakanın değişmediği doğrulanır, sonra `preOpenMonths > 0` için yeni golden vakalar eklenir.

## 7. Yapay zekâ kullanımı (Faz 3+)

- Sadece **kaynaklı soru-cevap**: Claude'a kullanıcının sorusu + o ülke/sektörün doğrulanmış maddeleri + bu maddelerin resmi kaynaklarından alınmış metin parçaları verilir. Cevap sadece bu parçalara dayanır ve her iddia için madde `id`'si veya kaynak gösterir.
- Kaynaklarda cevap yoksa: "Bu konuda doğrulanmış bilgimiz yok; {kurum}'a veya mali müşavirine danış." Tahmin yapılmaz.
- Cevaplar maddeleri değiştirmez; yeni madde önerisi sadece yönetim paneline "inceleme bekliyor" olarak düşer.

## 8. İlk taslak içerik (`packages/archetypes/legal/`, eski adı `seed/legal/`)

Pakette şu dosyalar **taslak** olarak vardır. Hepsinde `verification.status = 'draft'` ve `sourceUrl = ''`. Başlıklar genel bilgiye dayanır; **hiçbiri doğrulanmamıştır.**

| Dosya | Kapsam |
|---|---|
| `legal/TR/common.json` | Vergi mükellefiyeti, esnaf/ticaret sicil kaydı, işyeri açma ve çalışma ruhsatı, SGK işyeri tescili, yangın uygunluğu, tabela izni ve ilan-reklam vergisi, ödeme kaydedici cihaz / POS, kira sözleşmesi ve stopaj |
| `legal/TR/coffee.json` | Gıda işletmesi kaydı, personel hijyen eğitimi, kaldırıma masa (işgaliye) izni |
| `legal/TR/barber.json` | Ustalık belgesi, hijyen ve sterilizasyon şartları |
| `legal/US/common.json` | EIN, işletme kaydı (LLC / DBA), eyalet satış vergisi izni, yapı kullanım belgesi, tabela izni |
| `legal/US/regions/US-NY-NYC.json` | Gıda servis işletmesi izni ve gıda koruma sertifikası (kahve), berber lisansı (berber), kaldırım kafe izni |
| `legal/US/regions/US-TX-AUSTIN.json` | Gıda işletmesi izni, gıda yöneticisi / çalışanı sertifikası (kahve), eyalet berber lisansı ve berber dükkânı izni (berber) |

**Doğrulama görevi (ROADMAP İP-1.8):** Her madde resmi kaynağından kontrol edilir, `sourceUrl` ve tahmini süre/maliyet doldurulur, `reviewedBy` yazılır. Türkiye için mali müşavir, ABD için yerel danışman görüşü alınır. Doğrulanmayan madde silinir, tahminle doldurulmaz.
