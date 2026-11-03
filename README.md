# Bu İş Tutar mı? / Should You Open This? — Claude Code Paketi

Bu klasör, prototip olarak çalışan fizibilite uygulamasını gerçek bir ürüne dönüştürmek için Claude Code'a verilecek her şeyi içerir.

## İçerik

| Dosya | Ne işe yarar |
|---|---|
| `CLAUDE.md` | Claude Code'un bu repoda uyacağı kurallar. Repo köküne konur, her oturumda otomatik okunur. |
| `docs/PROJECT.md` | Ürün vizyonu, kullanıcılar, kapsam, iş modeli, başarı ölçütleri. |
| `docs/STRATEGY.md` | Pazara giriş: Türkiye'de lansman, globale hazır mimari, genel mod, ABD kapısı, diaspora, dağıtım ve fiyat. |
| `docs/COMPETITION.md` | Yurtiçi ve yurtdışı rakipler, emsaller ve ayrışma noktaları (kaynaklarıyla). |
| `docs/ROADMAP.md` | Fazlar ve Claude Code'a sırayla verilecek iş paketleri (kabul kriterleriyle). |
| `docs/SPEC-architecture.md` | Teknoloji yığını, klasör yapısı, veri modeli, entegrasyonlar, güvenlik ve KVKK. |
| `docs/SPEC-calc-engine.md` | Hesap motorunun tüm formülleri, eşikleri ve karar mantığı. Prototiple birebir aynı. |
| `docs/SPEC-archetypes.md` | Sektör ve ülke ayar dosyaları; yeni sektör ve yeni ülke eklemenin kuralları. |
| `docs/SPEC-ai.md` | Claude çağrıları: rakip analizi, fotoğraf inceleme, görsel prompt. Promptlar ve JSON şemaları. |
| `docs/SPEC-legal.md` | Mevzuat yol haritası: şema, doğrulama kuralları, ekran, finans bağlantısı. |
| `docs/SPEC-alternatives.md` | "Bu dükkânda ne tutar?" ve "Bu iş için en iyi semtler": yöntem, puanlama, filtreler. |
| `seed/legal/` | TR (genel, kahve, berber) ve ABD (genel, New York, Austin) mevzuat taslakları. **Doğrulanmamıştır.** |
| `tests/fixtures/golden-cases.json` | Prototipten üretilmiş 30 test vakası (18 temel + 12 uç durum). Yeni motor bunları geçmeden ilerlenmez. |
| `prototype/bu-is-tutar-mi-mvp.html` | Çalışan prototip. Tarayıcıda açılır; davranış referansıdır. |
| `prototype/bu-is-tutar-mi-logo.svg` | Kanal logosu. |

## Claude Code ile başlamak

1. Yeni, boş bir klasör aç ve bu paketin içeriğini oraya kopyala (`CLAUDE.md` kökte kalsın).
2. Claude Code'u o klasörde başlat.
3. İlk mesaj olarak şunu yaz:

   > `CLAUDE.md`, `docs/PROJECT.md`, `docs/STRATEGY.md`, `docs/ROADMAP.md` ve `docs/SPEC-calc-engine.md` dosyalarını oku. ROADMAP'teki Faz 0'ı başlat: monorepo'yu kur, hesap motorunu `packages/engine` altına TypeScript olarak taşı, arketip, ülke ve mevzuat dosyalarını oluştur. `tests/fixtures/golden-cases.json` içindeki 30 vakanın hepsi geçene kadar bitmiş sayma. Başlamadan önce bana kısa bir plan göster.

4. Her iş paketinin sonunda Claude Code'a ROADMAP'teki kabul kriterlerini tek tek kontrol ettir. Bir faz bitince bir sonrakine geç.

## Önce kararlaştırılması gerekenler

- Alan adı ve uygulama adı (TR: Bu İş Tutar mı?, EN: Should You Open This?).
- GitHub, Supabase (AB bölgesi) ve Vercel hesapları (Faz 0–1).
- Google Maps Platform ve Anthropic API anahtarları (Faz 2).
- Ödeme sağlayıcısı: TR için iyzico, global için Stripe (Faz 3).
- Ücretli rapor fiyatı: lansman öncesi test (referans: Yapgitsin 999 ₺).
- Mevzuat maddelerinin doğrulanması için bir mali müşavir (İP-1.8).
- Diş hekimi ve veteriner mevzuatı ile (varsa) meslek tarifesindeki taban fiyatların doğrulanması için sağlık hukukçusu veya bu alanda çalışan bir mali müşavir (İP-3.1; erken başlanmalı).
- KVKK aydınlatma metni, kullanım şartları ve "yatırım tavsiyesi değildir" çerçevesi için avukat görüşü, yayına çıkmadan önce.
