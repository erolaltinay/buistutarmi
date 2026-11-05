# CLAUDE.md — Bu İş Tutar mı? / Should You Open This?

Bu repo, perakende ve hizmet işletmesi açmak isteyenlere fizibilite analizi yapan iki dilli (TR/EN) bir web uygulamasıdır (PWA). Uygulama bir YouTube kanalının ürünüdür: videolar yöntemi öğretir, uygulama kullanıcının kendi rakamlarıyla analiz yapar.

Önce oku: `docs/PROJECT.md`, `docs/STRATEGY.md`, `docs/ROADMAP.md`. Hesapla ilgili her işte `docs/SPEC-calc-engine.md` tek doğru kaynaktır.

Hangi işte hangi doküman:

| İş | Doküman |
|---|---|
| Formül, karar, eşik | `docs/SPEC-calc-engine.md` |
| Teknoloji, veri modeli, entegrasyon, KVKK | `docs/SPEC-architecture.md` |
| Sektör ve ülke ayar dosyaları | `docs/SPEC-archetypes.md` |
| Claude çağrıları, promptlar, şemalar | `docs/SPEC-ai.md` |
| İzin ve belge listesi | `docs/SPEC-legal.md` |
| "Bu dükkânda ne tutar?", "en iyi semtler" | `docs/SPEC-alternatives.md` |
| Rakip inceleme, fiyat haritası | `docs/SPEC-competitor-research.md` |
| Pazar sırası, genel mod, fiyat, dağıtım | `docs/STRATEGY.md` |
| Rakipler ve ayrışma | `docs/COMPETITION.md` |

## Yığın

- Next.js (App Router) + TypeScript (strict), pnpm workspaces.
- Supabase: Postgres, Auth, Storage, Row Level Security.
- Vercel'de yayın. Sunucu tarafı işler route handler veya server action ile.
- Testler: Vitest (motor), Playwright (uçtan uca).
- i18n: `next-intl`. Diller: `tr`, `en`.

## Klasör yapısı

```
apps/web/            Next.js uygulaması
packages/engine/     Saf hesap motoru (UI, ağ, tarih/saat erişimi YOK)
packages/archetypes/ Sektör, ülke ve mevzuat (legal/) ayar dosyaları (JSON + zod şeması)
packages/ai/         Claude promptları, zod şemaları, çağrı sarmalayıcıları (sadece sunucu)
packages/pdf/        PDF rapor üretimi
supabase/            Migration'lar, RLS politikaları, seed
tests/fixtures/      golden-cases.json
tests/engine/        Golden testler ve motorun uç durum testleri
scripts/             legal:check, archetypes:check, i18n:check
prototype/           Referans prototip (değiştirme)
```

## Değişmez kurallar

1. **Hesap motoru saf ve deterministiktir.** `packages/engine` içindeki fonksiyonlar sadece girdi alır, çıktı döner. `Date.now()`, `Math.random()`, ağ, DOM, global durum yasak.
2. **Golden testler her zaman geçmeli.** `tests/fixtures/golden-cases.json` içindeki 30 vaka, göreli %0,5 / mutlak 0,05 toleransla geçmeden motorda yapılan hiçbir değişiklik birleştirilmez. Formül bilerek değişiyorsa: önce `docs/SPEC-calc-engine.md` güncellenir, sonra fixture yeniden üretilir ve PR açıklamasında hangi sayının neden değiştiği yazılır.
3. **Yuvarlama sadece gösterimde.** Motor ham `number` döner; para birimi biçimlendirmesi `Intl.NumberFormat` ile UI'da yapılır.
4. **Metinler kodda yazılmaz.** Her kullanıcı metni `messages/tr.json` ve `messages/en.json` içinde anahtar olarak bulunur; ikisi aynı anahtarlara sahip olmalı (CI kontrol eder).
5. **Seçim verisi asla puana girmez.** Bölge profilindeki seçim alanları sadece bağlam olarak saklanır ve AI'ya "nötr bağlam" etiketiyle gider. Bunu değiştiren bir PR reddedilir.
6. **AI çıktısı doğrudan veriye yazılmaz.** Claude'un önerdiği her değer (rakip fiyatı, kontrol listesi cevabı, etiket) kullanıcıya gösterilir ve kullanıcı "Uygula" demeden kaydedilmez. Her AI yanıtı zod şemasıyla doğrulanır; geçersizse kullanıcıya hata gösterilir, tahmin yapılmaz.
7. **Sırlar sunucuda kalır.** Anthropic, Google ve Supabase service-role anahtarları istemciye hiçbir yolla gitmez.
8. **Her tabloda RLS açık.** Kullanıcı sadece kendi projelerini, medyasını ve raporlarını görür. Yeni tablo eklerken politikası aynı migration'da yazılır.
9. **KVKK.** Sokak ve dükkân fotoğraflarında yüzler yüklemeden önce bulanıklaştırılır (Faz 2). Kişisel veri saklama süreleri ve silme akışı `docs/SPEC-architecture.md` içindedir.
10. **Yatırım tavsiyesi değildir.** Karar ekranında ve PDF'te uyarı metni her zaman görünür; kaldırılamaz.
11. **Mevzuat içeriği uydurulmaz.** Her maddenin resmi `sourceUrl`'i ve `lastReviewed` tarihi olur. `draft` madde production'a çıkamaz (CI). Arayüz "uygunsunuz", "bu belgeler yeterli" gibi kesin hukuki ifade kurmaz. Mevzuat bilgisini Claude'a ürettirme; sadece doğrulanmış kaynaklar üzerinden kaynak gösteren soru-cevap (Faz 3+). Doğrulayamadığın maddeyi sil, tahminle doldurma.
12. **Alternatif öneriler motordan gelir.** "Bu dükkânda ne tutar?" sıralaması `analyze()` çıktılarıyla hesaplanır; Claude sadece hesaplanmış sonucu özetler ve metin "Claude özeti" olarak etiketlenir. Kullanıcının fikri aynı varsayılanlarla da hesaplanıp listede gösterilir.
13. **Ülke kodu kontrol edilmez.** Ülkeye göre davranış sadece `countries/*.json` (`supportLevel`, `fin`, `legal`, `pricing`) üzerinden gelir. `if (country === 'TR')` yazılmaz. Desteklenmeyen ülke `GENERIC` şablonunu kullanır.
14. **Fiyatlar kodda yazılmaz.** Ücretli rapor fiyatları ve plan sınırları ülke dosyasında ve sunucu tarafında kontrol edilir.

## Çalışma şekli

- Her iş paketi ROADMAP'teki kabul kriterleriyle biter. Bitirdiğinde kriterleri tek tek kontrol et ve sonucu yaz.
- Motor fonksiyonu eklerken önce testini yaz.
- Prototip (`prototype/bu-is-tutar-mi-mvp.html`) davranış referansıdır. Bir ekranın nasıl çalışması gerektiği belirsizse önce prototipe bak; spesifikasyon ile prototip çelişirse spesifikasyon kazanır ve çelişkiyi raporla.
- Para birimi ve ülke varsayılanları (vergi, komisyon, faiz) `packages/archetypes/countries/*.json` içindedir; kodda sabit oran yazılmaz.

## Komutlar

```
pnpm dev                      # web uygulaması
pnpm test                     # tüm birim testleri (motor, golden, arketip, mevzuat)
pnpm test:engine              # motor + golden testler
pnpm test:e2e                 # Playwright (ilk sefer: pnpm --filter @bitm/web exec playwright install chromium)
pnpm lint && pnpm typecheck
pnpm format:check
pnpm i18n:check               # tr/en anahtar eşitliği
pnpm archetypes:check         # sektör ve ülke dosyaları şemadan geçiyor mu
pnpm legal:check              # mevzuat kuralları; --production ile taslak madde hata olur
```

Production derlemesi (`VERCEL_ENV=production` veya `BITM_RELEASE=production`) `legal:check --production` kuralıyla çalışır; taslak mevzuat maddesi varken kırmızı olur.
