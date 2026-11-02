# SPEC — Claude (AI) kullanımı

Prototipte Claude çağrıları tarayıcıdan, kullanıcının kendi Claude hesabıyla yapılıyordu. Üründe tüm çağrılar **sunucudan**, Anthropic API ile, `packages/ai` üzerinden yapılır. Maliyet ürünündür; her çağrı `usage_events`'e yazılır.

## 1. Genel kurallar

- Her çağrının girdi şablonu ve çıktı şeması bu dosyadadır; değişiklik önce burada yapılır.
- Çıktı yapılandırılmış JSON'dur ve zod ile doğrulanır. Rakip analizi gibi metin çıktısı olan çağrılar da bölümleri JSON alanları olarak döner (prototipteki Markdown yerine), böylece UI ve PDF aynı yapıyı kullanır.
- Claude'a sadece kullanıcının verisi gider. Prompt "sadece verilen veriyi kullan, eksikse söyle" kuralını içerir.
- **Seçim verisi** sadece "nötr bağlam" olarak gider ve prompt şu kuralı içerir: oy dağılımından bireysel zevk veya harcama çıkarımı yapma, siyasi yorum yapma.
- AI'ın önerdiği değerler (fiyat, kontrol listesi cevabı, etiket) kullanıcı onayı olmadan kaydedilmez.
- Model seçimi: hızlı/kısa işler (görsel prompt, etiket) düşük maliyetli modelle; rakip analizi ve görsel inceleme orta seviye modelle. Model adları ortam değişkeninde tutulur, kodda yazılmaz.
- Görseller: yüzleri bulanıklaştırılmış kopya; uzun kenar en fazla 1600 px JPEG.
- Kullanıcı başına günlük limit (plan bazlı); aşılırsa açık bir mesaj.

## 2. Rakip analizi

**Tetik:** Bölge ve rakipler ekranında "Analiz et".

**Girdi verisi (JSON):** iş tipi, şehir, para birimi, semt, 1 km nüfus, menü (ad, fiyat, birim maliyet, pay), imza fiyat, başabaş/gün, baz/gün, toplam yatırım, nakit açığı, aylık taksit, geri dönüş ayı, ilk kâr ayı, rakipler (id, ad, mesafe, imza fiyat, puan, yorum, güçlü, zayıf, not), saha gözlemleri (fotoğraf kategorisi, rakip, not, görsel özeti; en fazla 20), lokasyon (günlük geçen, gereken giriş oranı, kira/ciro, dükkân geçmişi, sahip profili, kontrol listesi 'hayır'ları, kırmızı bayraklar, lokasyon puanı), bölge profili (gelirler, yaş payları, hane, gündüz nüfusu, talep uyumu puanı, seçim katılımı ve özeti), hesaplanmış rekabet (rakip sayısı, işletme başına kişi, doygunluk, fiyat min/ort/maks).

**Prompt (prototipteki, yapılandırılmış çıktıya uyarlanmış):**

```
You are a seasoned retail investment advisor. Analyze the competition within 1 km for the business below.
Use ONLY the data given; do not invent competitors, prices or facts, and say so when data is missing.
Weigh the area profile (income vs city, age mix, daytime population) when judging demand and price level.
field_observations are the user's own photo notes and image summaries; use them as on-the-ground evidence.
Treat any election data only as neutral local context: never infer individual tastes or spending from how
people voted, and do not make political judgments.
Write all text in {Turkish|English}. Keep the whole answer under 260 words, plain and direct.
Return JSON matching the schema.

DATA:
{data}
```

**Çıktı şeması:**

```ts
z.object({
  marketRead: z.array(z.string()).max(5),        // talep, yaya, kira yükü, bayraklar, doygunluk, lider
  mustMatch: z.array(z.string()).max(5),         // rakiplerin güçlü yönleri
  openings: z.array(z.string()).max(5),          // rakiplerin zayıf yönleri = fırsat
  pricing: z.object({
    strategy: z.enum(['penetration','match','premium','current']),
    signaturePrice: z.number().positive(),
    reason: z.string()
  }),
  tactics: z.array(z.object({ competitor: z.string(), tactic: z.string() })).length(3),
  missingData: z.array(z.string()).max(5)
})
```

UI'da "Fiyat önerisini fiyat stratejisine uygula" düğmesi `pricing.signaturePrice`'ı kullanıcı onayıyla uygular.

## 3. Fotoğraf / video karesi inceleme

**Tetik:** Medya ekranında bir öğe açıldığında "Claude ile incele". Video için kullanıcının durdurduğu kare istemcide JPEG'e çevrilip gönderilir.

**Ortak başlık:**

```
You are a retail site-selection advisor helping someone decide whether to open a {businessNoun} in {area}.
Look only at the attached image{ (a frame from the user's video)}. User note: "{note}".
Describe only what is visible; use null when the image does not show something.
Write all text values in {language}. Return JSON matching the schema.
```

**Kategoriye göre ek talimat ve şema:**

| Kategori | Ek talimat | Şema | Kullanıcının uygulayabileceği |
|---|---|---|---|
| `ext` dış cephe | The image shows the shop space being considered, from outside. | `{summary, visible: bool\|null, access: bool\|null, strengths: string[], fixes: string[]}` | Kontrol listesi `visible`, `access` |
| `int` iç mekan | The image shows the interior of the space being considered. | `{summary, seatsEstimate: number\|null, condition: 'good'\|'fair'\|'poor'\|null, renovation: string[]}` | (bilgi) |
| `street` sokak | The image shows the street in front of the space. A single frame cannot measure daily traffic. | `{summary, peopleVisible: number\|null, anchorsSeen: string[], anchor: bool\|null, caution: string}` | Kontrol listesi `anchor` |
| `menu` rakip menüsü | The image shows a competitor's menu or price list (competitor: {name}). Currency: {cur}. | `{items: {name, price}[] (≤15), signatureMatch: {name, price}\|null (closest to "{signatureItem}"), summary}` | Rakibin imza fiyatı |
| `comp` rakip dükkân | The image shows a competitor's shop ({name}). Strengths/weaknesses may only use the given keys. | `{summary, strengths: Key[], weaknesses: Key[]}` (anahtarlar arketipten) | Rakip etiketleri |
| `other` | — | `{summary, observations: string[]}` | (bilgi) |

`menu` ve `comp` kategorilerinde rakip seçilmemişse sonuç gösterilir ama "uygula" çıkmaz; kullanıcıdan rakip seçmesi istenir.

## 4. Mağaza görseli promptu

**Tetik:** Mağaza görseli ekranında "Prompt üret". Çıktı düz metin (tek prompt, İngilizce, 90–130 kelime); kullanıcı kopyalayıp görsel üretim aracında kullanır.

```
Write ONE photorealistic image-generation prompt in English (90-130 words) for the street-level exterior of a
newly opened {independent coffee shop|barbershop} in {area}. Shop sign reads exactly "{name}"{, window lettering
"{slogan}"}. Facade style: {modern vertical cladding | warm wood planks with glowing pendant lights | minimal clean lines}.
Color palette: {palette name} (wall {hex}, sign {hex}). {Striped fabric awning. | No awning.}
Positioning: {premium, crafted | friendly, great value | welcoming neighborhood spot}.
Include camera (35mm lens, eye level, slight angle), golden-hour light, a chalkboard sidewalk sign, interior visible
through the big window, a couple of passers-by, realistic local street details. Reply with only the prompt text.
```

Faz 3 seçeneği: prompt doğrudan bir görsel üretim API'sine gönderilip sonuç projeye eklenir (lisans ve maliyet kontrolüyle).

## 5. Gelecek çağrılar (Faz 3+)

- **Hızlı mod yardımcısı:** Kullanıcının serbest metin cevabını ("kira 60 bin civarı, 2 kişi çalışacak") alanlara dönüştürür; kullanıcı onaylar.
- **Gerçekleşen yorumu:** Açılış sonrası girilen aylık rakamları tahminle karşılaştırıp sapmanın olası nedenlerini sıralar.
- **Video senaryosu:** Kanal için, aynı motor çıktısından 4 perdelik video taslağı (iç araç; kullanıcıya açık değil).
