# SPEC — Hesap motoru

Bu doküman `packages/engine` paketinin tek doğru kaynağıdır. Formüller prototiple (`prototype/bu-is-tutar-mi-mvp.html`) birebir aynıdır. `tests/fixtures/golden-cases.json` bu formüllerden üretilmiştir.

Gösterim: `pc(x) = x / 100` (yüzde girdileri kesire çevirir). `clamp(x) = min(1, max(0, x))`. Tüm para tutarları girildiği para biriminde, aylık.

## 1. Girdi modeli

Golden fixture'daki `input` nesnesi prototipin durum nesnesidir. Ürün modelinde alan adları aynı kalabilir; tek fark sabit gider satırlarına açık `type` alanı eklenmesidir (bkz. 3.2). **Fixture'lardaki satırlarda `type` yoktur;** motor `type` yoksa 3.2'deki anahtar/ad kuralına düşer, golden testler bu yolu sınar.

```ts
type AnalysisInput = {
  biz: string;               // arketip id: 'coffee' | 'barber' | ...
  city: string; cur: string;  // ISO 4217; genel modda kullanıcı seçer
  contPct: number;           // beklenmedik gider payı %
  wcMonths: number;          // ek güvenlik yastığı (ay × sabit gider)
  days: number;              // aylık çalışma günü
  scen: [number, number, number];   // kötümser / baz / iyimser günlük satış (veya müşteri)
  cap: [stations: number, hours: number, serviceMin: number] | null; // sadece hizmet arketipi
  capex: {k?: string; n?: string; v: number}[];
  fixed: {k?: string; n?: string; v: number; type?: 'rent'|'staff'|'other'}[];
  items: {k?: string; n?: string; price: number; cost: number; mix: number;   // ilk satır imza ürün
          kind?: 'product'|'service';   // hybrid arketipte zorunlu (§6); yoksa arketip modelinden
          minPrice?: number}[];         // düzenlemeli meslekte taban fiyat (§12.1); yoksa taban yok
  fin: FinParams;
  area: string; pop: number;
  demo: {inc; incCity; a1; a2; a3; hh; day; turnout; elec};
  comp: {k?; n?; dist; price; rating; reviews; s: string[]; w: string[]; note}[];
  loc: {foot: {wd: [n,n,n]; we: [n,n,n]}; countMin; openH;
        hist: {turnover; reason: 'unknown'|'grew'|'personal'|'rent'|'noProfit'; closures; talked: boolean};
        founder: {role: 'full'|'part'|'investor'; mgr; years; runway; equity};  // equity zorunlu
                                                                               // (prototip boşsa finansta 100, girişimci kontrolünde 0 sayıyordu)
        chk: Record<ChecklistKey, 1|0|null>};
};
type FinParams = {rampStart; rampMonths; priceInc; inflCost; rentInc; wageInc; ownerSalary;
  kdv; cardShare; cardFee; platShare; platFee; waste; stopaj; employer; profitTax; loanRate; loanTerm; depYears};
```

## 2. Birim ekonomisi

```
feeRate   = pc(cardShare)·pc(cardFee) + pc(platShare)·pc(platFee)
W(i)      = mix_i / Σmix            (Σmix ≤ 0 ise tüm sonuçlar 0)
ticket    = Σ price_i · W(i)        // KDV dahil ortalama sepet
costAvg   = Σ cost_i · W(i)         // KDV hariç girdi maliyeti
ticketNet = ticket / (1 + pc(kdv))
cm        = ticketNet − costAvg·(1 + pc(waste)) − ticket·feeRate   // birim katkı payı
```

Notlar: Komisyon KDV dahil tutar üzerinden alınır. Girdi KDV'si indirilebilir kabul edilir (maliyet KDV hariç girilir). ABD'de menü fiyatı satış vergisi hariçtir, bu yüzden `kdv = 0`.

## 3. Sabit giderler

### 3.1 Yüklenmiş aylık sabit gider (1. ay)

```
stp    = min(0.9, pc(stopaj));  emp = pc(employer)
rent0  = Σ v / (1 − stp)        // kira satırları (brüte tamamlama)
staff0 = Σ v · (1 + emp)        // personel satırları
other0 = Σ v                    // diğerleri
mgrRaw = role=='investor' ? mgr : role=='part' ? mgr/2 : 0
mgrL   = mgrRaw · (1 + emp)
owner  = ownerSalary
opFixed = rent0 + staff0 + other0 + mgrL + owner
```

### 3.2 Satır tipleri

Prototip tipi anahtar ve ad ile tahmin eder: `k=='rent'` veya ad `/kira|rent/i` → kira; `k` `staff` ile başlıyorsa veya ad `/personel|staff|maaş|wage|payroll/i` → personel. **Üründe her satırın açık `type` alanı olur**; tahmin sadece eski verinin taşınmasında kullanılır.

## 4. Yatırım

```
capexSub   = Σ capex.v
capexTotal = capexSub · (1 + pc(contPct))
nonDep     = Σ capex.v  (k ∈ {stock, stockB, permits})     // amortismana tabi değil
depBase    = max(0, capexTotal − nonDep)
eq         = clamp(pc(founder.equity))                    // öz sermaye payı
cushion    = opFixed · wcMonths
```

Kredi ile nakit açığı birbirine bağlı olduğu için 5 tur sabit nokta iterasyonu yapılır:

```
trough = opFixed · 2                     // başlangıç tahmini
tekrar 5 kez:
  invest = capexTotal + trough + cushion
  loan   = invest · (1 − eq)
  pmt    = annuity(loan, pc(loanRate)/12, max(1, round(loanTerm)))
  proj   = project(...)                  // bölüm 5
  trough = proj.trough
invest = capexTotal + trough + cushion
wc     = trough + cushion

annuity(P, r, n) = P ≤ 0 ? 0 : (r > 0 ? P·r / (1 − (1+r)^−n) : P/n)
```

## 5. 60 aylık projeksiyon (baz senaryo)

```
rs  = clamp(pc(rampStart)); rm = max(1, round(rampMonths))
dep = depBase / (max(1, depYears) · 12)
g(rate, m)  = (1 + pc(rate))^((m−1)/12)          // aylık bileşik
st(rate, m) = (1 + pc(rate))^floor((m−1)/12)     // yıllık basamak (kira, maaş)
r   = pc(loanRate) / 12
bal = loan; cash = 0; trough = 0; lossPool = 0

m = 1..60 için:
  ramp   = m ≥ rm ? 1 : rs + (1 − rs)·(m−1)/max(1, rm−1)
  units  = base · days · ramp
  gross  = units · ticket · g(priceInc, m)
  net    = gross / (1 + pc(kdv))
  cogs   = units · costAvg · (1 + pc(waste)) · g(inflCost, m)
  fees   = gross · feeRate
  fixed  = rent0·st(rentInc,m) + (staff0 + mgrL + owner)·st(wageInc,m) + other0·g(inflCost,m)
  ebitda = net − cogs − fees − fixed
  interest  = bal > 0 ? bal·r : 0
  pay       = bal > 0 ? min(pmt, bal + interest) : 0
  principal = max(0, pay − interest); bal = max(0, bal − principal)
  ebt    = ebitda − dep − interest
  ebt > 0 ise: use = min(lossPool, ebt); lossPool −= use; taxable = ebt − use
  ebt ≤ 0 ise: taxable = 0; lossPool += −ebt
  tax    = taxable · pc(profitTax)
  ni     = ebt − tax
  cf     = ni + dep − principal
  cash  += cf
  m ≤ 24 ve cash < trough ise trough = cash, troughM = m
  firstProfit = ilk ni > 0 olan ay
  sum24 = Σ ni (m ≤ 24)
trough = −trough   (pozitif tutar)
```

Nakit 1–24. aylarda hiç eksiye düşmezse `trough = 0` ve `troughM = 0`. Hiç kâra geçilmezse `firstProfit = null`.

Geri ödeme hesabı, 5. turun projeksiyonu ve son `invest` değeriyle yapılır (iterasyon yakınsadığı için tekrar hesaplamak aynı sonucu verir).

Nakit açığı penceresinin 24 ayla sınırlı olmasının nedeni: hiç kâra geçmeyen bir işte 60 aylık zarar "işletme sermayesi" sayılmamalı. Böyle bir iş zaten karar adımında TUTMAZ olur.

## 6. Başabaş ve senaryolar

```
fixed   = opFixed + pmt                     // nakit sabit çıkış (taksit dahil)
beMonth = cm > 0 ? fixed / cm : ∞
beDay   = beMonth / days
nets[i] = scen[i] · days · cm − fixed       // 1. ay fiyatlarıyla, vergi öncesi aylık nakit
beDayNoMgr = cm > 0 ? (fixed − mgrL) / cm / days : ∞
maxDaily (hizmet) = stations · hours · 60 / serviceMin
svcShare = model 'service' ise 1; 'hybrid' ise Σ mix(kind = 'service') / Σ mix; 'product' ise 0
```

Kapasite sadece hizmet işlemlerine uygulanır: hibrit arketipte (ör. veteriner kliniği: muayene + mama/aksesuar satışı) günlük işlemlerin yalnızca `svcShare` kadarı koltuk/oda kapasitesi kullanır. `service` modelinde `svcShare = 1` olduğundan kahve ve berber sonuçları değişmez. Hibritte `kind` yazılmamış kalem hizmet sayılır (kapasite açısından ihtiyatlı); arketip şeması hibritte `kind`'ı zorunlu tuttuğu için bu yalnız eksik kullanıcı verisinde olur.

Geri ödeme (projeksiyon satırları üzerinde): `cum += ni + dep`; `payOpen` = ilk `cum ≥ capexTotal` olan ay; `payAll` = ilk `cum ≥ invest` olan ay. 60 ayda olmuyorsa ∞.

Duyarlılık tablosu: `cm × {1, 0.9, 0.8}` için `fixed / cm' / days`.

## 7. Finansal karar

Sırayla, ilk eşleşen döner:

1. `cm ≤ 0` → NO (her satış zarar).
2. kapasiteli arketip ve `beDay · svcShare > maxDaily` → NO (kapasite yetmez).
3. `base < beDay` → NO.
4. `base < 1.25 · beDay` → MID (ince pay).
5. `payAll > 36` → MID (geri dönüş uzun).
6. → GO.

## 8. Rekabet (1 km)

```
within  = dist ≤ 1000 olan rakipler; n = |within|
perBiz  = pop > 0 ? pop / (n + 1) : yok        // yeni dükkân dahil; nüfus yoksa perBiz ve satKey null (prototiple aynı)
eşik    = coffee [1500, 3000], barber [1200, 2500] (arketipten gelir)
satKey  = perBiz < t0 ? 'hi' (doymuş) : perBiz < t1 ? 'mid' : 'lo' (boşluk var)
pavg    = within içinde fiyatı > 0 olanların ortalaması; yoksa null. pmin/pmax aynı küme üzerinden
share(etiket) = n > 0 ? etiketi taşıyan rakip / n : 0
sıralama: etiketler, `within` sırasıyla rakipler ve her rakibin dizisi gezilerek ilk görülme sırasına göre listelenir;
          sonra share'e göre azalan, kararlı sıralanır (eşit paylar ilk görülme sırasını korur)
gaps    = zayıflıklardan share ≥ 0.5 olanlar; hiç yoksa sıralı listenin ilk 2'si
stakes  = güçlü yönlerden share ≥ 0.5 olanlar
lider   = argmax rating · log10(reviews + 10)
density = n / π   (rakip / km²)
```

## 9. Talep uyumu (0–100)

```
idx  = inc>0 ve incCity>0 ise inc/incCity·100, değilse yok
dayR = pop > 0 ? day / pop : 0
coffee: y = clamp((a1−15)/25); i = idx yok ? 0.5 : clamp((idx−70)/60); d = clamp(dayR/0.5)
        score = 40y + 35i + 25d
barber: w = clamp((a1+a2−40)/30); i = idx yok ? 0.5 : clamp((idx−60)/60); dn = clamp(pop/15000)
        score = 40w + 30i + 30dn
seviye: ≥67 yüksek, ≥40 orta, aksi düşük
```

Ağırlıklar arketip dosyasından gelir. **Seçim alanları (`turnout`, `elec`) hiçbir hesaba girmez.**

## 10. Lokasyon

### 10.1 Yaya trafiği
```
hasFoot = wd ve we içinde en az bir sayı > 0
daily  = (5·avg(wd) + 2·avg(we)) / 7 / max(1, countMin) · 60 · openH   // hizmet arketipinde openH = cap.hours
         (sayım yoksa daily = 0 olarak döner)
reqCap = hasFoot ve daily > 0 ve beDay sonlu ise beDay / daily · 100, aksi null
baseCap = hasFoot ve daily > 0 ise base / daily · 100, aksi null (sadece bilgi)
durum  = reqCap üzerinden: ≤t0 iyi, ≤t1 dikkat, aksi risk; reqCap null ise veri yok
eşik   = coffee [2, 4], barber [0.6, 1.5]
```

**Yaya trafiği modu** (arketipte `location.footTraffic`, varsayılan `scored`): randevuyla çalışan mesleklerde (diş hekimi, veteriner) müşteri kapının önünden geçenlerden gelmez. `footTraffic = 'info'` iken `daily`, `reqCap` ve `baseCap` hesaplanıp bilgi olarak döner; yaya durumu `null` olur, dolayısıyla puana girmez, kırmızı bayrak üretmez ve teyit listesine "say" eklenmez. Kahve ve berber `scored` modundadır.

### 10.2 Kira yükü
```
rent   = rent0 (tüm kira satırlarının stopajlı toplamı; kira satırı yoksa null)
rr     = rent / (base · days · ticketNet) · 100
rrBE   = rent / (beMonth · ticketNet) · 100   (sadece bilgi)
durum  = sadece rr üzerinden: ≤t0 iyi, ≤t1 dikkat, aksi risk; rr null ise veri yok
eşik   = coffee [12, 18], barber [15, 22]
```

### 10.3 Dükkân geçmişi
- `turnover ≥ 3` risk; `== 2` dikkat.
- `reason == noProfit` risk; `reason == rent` dikkat.
- `closures ≥ 4` risk; `≥ 2` dikkat.
- En kötü durum geçerlidir.

### 10.4 Girişimci
- `mgrRaw > 0` dikkat (mesaj: başabaş `beDayNoMgr → beDay`).
- `years < 1` dikkat.
- `runway < 3` risk; `< 6` dikkat.
- `equity < 40` risk; `< 60` dikkat.

### 10.5 Kontrol listesi
12 madde (anahtarlar arketipte): `commuteSide, anchor, visible, access, futurePlus, noDisrupt*, lowSeason, weekBalance, permitOk*, outdoor, staffAvail, wageOk` (* kritik). Arketip ortak listeden madde çıkarabilir ve sektöre özel madde ekleyebilir (`SPEC-archetypes.md` §2.1); motor arketipten gelen listeyi olduğu gibi kullanır, madde sayısı sabit değildir.
```
y = evet, n = hayır, u = bilinmiyor
cs = (y + 0.5u) / (y+n+u) · 100
durum = kritik bir 'hayır' varsa risk; cs ≥ 70 iyi; ≥ 45 dikkat; aksi risk
```

### 10.6 Kırmızı bayraklar ve puan
```
bayraklar: yaya=risk, kira=risk, geçmiş=risk, her kritik 'hayır' (noDisrupt ve permitOk ayrı ayrı), girişimci=risk.
           Kontrol listesinin 'risk' durumu tek başına bayrak değildir; sadece kritik 'hayır'lar bayraktır.
blocker  : arketipte `blocker` işaretli herhangi bir madde == 0 (bugün yalnız permitOk)
puan     : bloklar (yaya, kira, geçmiş, girişimci, liste) için iyi=100, dikkat=60, risk=20; veri olmayan blok hariç ortalama
teyit listesi: sayım yoksa "say" (sadece footTraffic = scored), bilinmeyen kritik maddeler, komşu esnafla konuşulmadıysa
```

## 11. Nihai karar

```
blocker → NO
finansal ≠ NO ve bayrak ≥ 2 → NO
finansal GO ve bayrak == 1 → MID
finansal MID ve bayrak == 1 → MID (gerekçeye bayrak eklenir)
aksi → finansal karar
```

## 12. Fiyat stratejisi

```
your = imza ürün fiyatı (items[0].price); ref = pavg ?? your
roundP(v) = TRY: max(5, round(v/5)·5);  USD ve EUR: max(0.25, round(v·4)/4)  (adım ülke dosyasındaki priceRounding)
kartlar: now = your; pen = roundP(ref·0.90); match = roundP(ref); prem = roundP(ref·1.15)
her kart: oran = price/your; menü = items[0].price = price, diğerleri roundP(price_i·oran)
          cm', beDay' = fixed/cm'/days, net' = base·days·cm' − fixed
öneri (rec, gerekçe kodu):
  pavg yok                          → now,   null
  satKey == hi                      → match, 'sat'
  qShare ≥ 0.5                      → prem,  'prem'
  share('expensive') ≥ 0.5          → pen,   'pen'
  gelir endeksi ≥ 125               → prem,  'incHi'
  gelir endeksi ≤ 85                → pen,   'incLo'
  aksi                              → match, 'match'
qShare = arketipin kalite etiketleri (coffee: ordinary; barber: inconsistent, shabby) içinde EN YÜKSEK TEK etiket payı
```

### 12.1 Taban fiyat (düzenlemeli meslekler)

Bazı mesleklerde meslek kuruluşunun asgari ücret tarifesi gibi bir alt sınır olabilir. Kalemin `minPrice` alanı varsa:

```
floorP(i, v) = minPrice_i varsa max(v, minPrice_i), yoksa v
kartlar (now hariç): her kalemin fiyatı = floorP(i, roundP(...)); floored = en az bir kalem tabana çekildiyse true
now kartı: kullanıcının fiyatıdır, değiştirilmez
belowFloor = kullanıcının fiyatı minPrice_i altında olan kalemlerin anahtarları (uyarı; karar değişmez)
```

Öneri kuralları değişmez. Taban değerleri ülke × sektör için doğrulanmış kaynaktan gelir (`SPEC-archetypes.md` §2.1); motor kaynağı bilmez, sadece `minPrice` alanını uygular. Kahve ve berberde `minPrice` yoktur, sonuçları değişmez.

## 13. Bilinen basitleştirmeler (bilinçli)

- Mevsimsellik yok (kontrol listesinde soru olarak var). Faz 3'te aylık mevsim profili eklenebilir; eklenirse golden fixture yeniden üretilir.
- Vergi aylık hesaplanır, geçmiş zarar mahsubu var; yıllık beyan dönemleri modellenmez.
- Kredi tek parça annüite; ödemesiz dönem yok.
- Senaryo kartları ve başabaş 1. ay fiyatlarıyla hesaplanır; projeksiyon artışları içerir.
- Kapasite tek bir ortalama işlem süresiyle hesaplanır (`serviceMin`); diş hekiminde muayene ile implant gibi süreleri çok farklı işlemler için kullanıcı ağırlıklı ortalama girer.

## 14. Çıktı şeması (golden `expected` alanları)

| Alan | Kaynak |
|---|---|
| `unit.ticket / ticketNet / cm` | §2 |
| `fixed.opFixed / loan / monthlyLoanPayment` | §3.1, §4 (`pmt`) |
| `breakEven.perDay / perMonth` | `beDay`, `beMonth` |
| `investment.capexTotal / cashTrough / troughMonth / cushion / total` | §4–5 (`trough`, `troughM`, `invest`) |
| `projection.firstProfitMonth / sum24NetProfit / paybackTotalMonths / paybackStartupMonths` | `firstProfit`, `sum24`, `payAll`, `payOpen` |
| `projection.month1/month12/month24` | ilgili satırın `units, gross, ebitda, ni (netIncome), cash` |
| `scenarios` | `nets` |
| `competition.*` | §8 (`saturation` = satKey: `hi/mid/lo`) |
| `demandFit.score / level / incomeIndex` | §9 (`level`: `hi/mid/lo`) |
| `location.score / dailyPassersby / captureNeededPct / rentToSalesPct` | `score`, `daily`, `reqCap`, `rr` |
| `location.foot / rent / history / founder / checklist` | durumlar: `good/mid/bad`, veri yoksa `null` |
| `location.redFlagCount / blocker` | §10.6 |
| `pricing.recommended / reason / cards[]` | §12 (`cards[].k, price, cm, bePerDay, baseNet`) |
| `pricing.belowFloor / cards[].floored` | §12.1 (golden fixture'da yok; kahve ve berberde `[]` / `false`) |
| `breakEven.serviceShare`, kapasite gerekçesinde `serviceBePerDay` | §6–7 (golden fixture'da yok; kahve 0, berber 1) |
| `verdict` | §11: `GO/MID/NO` |

Kurallar: Türkçe etiketler (iyi/dikkat/risk, yüksek/orta/düşük) sadece arayüzdedir; motor kod döner. ∞ ve "yok" JSON'da `null` olarak yazılır.

## 15. Test

- `golden-cases.json`: 30 vaka.
  - 18 vaka: {coffee, barber} × {ist, nyc, aus} × {default, investor_owner, permit_refused}.
  - 12 uç durum (coffee-ist ve barber-nyc için): `part_owner`, `no_rivals` (rakip yok), `no_foot_count` (sayım yok), `disruption_coming` (noDisrupt = hayır), `all_equity` (kredi yok), `strong_open` (rampa yok, yüksek satış; nakit hiç eksiye düşmez).
  - Tolerans: göreli 0,005 veya mutlak 0,05 (hangisi gevşekse).
- Bu şartname, prototipe bakmadan yalnızca bu dokümandan yazılan bağımsız bir motorla test edildi; ilk 18 vakanın tamamı geçti, uç durumlar bu sürümde netleştirildi.
- Ek birim testleri: `annuity` sınır durumları, `mix` toplamı 0, `cm ≤ 0`, kapasite aşımı, sayım yokken lokasyon puanı, `equity = 100` iken kredi = 0.
- Düzenlemeli meslek eklemeleri (§6 `svcShare`, §10.1 yaya modu, §10.5 sektöre özel liste, §12.1 taban fiyat) mevcut 30 vakayı değiştirmez; bu, eklemeler yapılırken golden testlerle kanıtlanır. Ek birim testleri: `footTraffic = 'info'` iken yaya bayrağı ve "say" teyidi oluşmaz; hiçbir kart `minPrice` altına düşmez, `now` kartı değişmez; hibrit arketipte kapasite yalnızca hizmet payına uygulanır.
- Yeni sektörlerin golden vakaları prototipten üretilemez: her vaka için temel sayılar (cm, başabaş, toplam yatırım, karar) motordan bağımsız bir hesap tablosuyla elle doğrulanır ve PR'da gösterilir.
