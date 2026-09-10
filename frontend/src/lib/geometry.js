// Sprint slaytinin canli onizleme ve PPTX ciktisinda AYNI konumlandirmayi
// kullanmasini saglayan paylasilan geometri sabitleri/fonksiyonlari.
// Orijinal Sprint_Sunum_Uretici.html'deki mantikla birebir aynidir.

export const G = {
  COL_W: 6.16, GAP_X: 0.35, X_L: 0.35, Y_TOP: 1.28, Y_BOT: 7.0, GAP_Y: 0.18,
  PAD_T: 0.12, PAD_B: 0.16, PAD_R: 0.18, ACC_ZONE: 0.30, TITLE_H: 0.46, BUL_GAP: 0.055, ICON: 0.34,
};
G.X_R = G.X_L + G.COL_W + G.GAP_X;

// Kart icin denenecek yazi boyutlari, en buyukten en kucuge (normal/kucultme
// yolu). Cok fazla madde eklenirse (bkz. pickCardFS) kucuk uclara kadar
// inilir ki icerik hicbir zaman slayt sinirlarinin disina tasip sessizce
// kaybolmasin.
export const FS_CANDIDATES = [12.5, 12, 11.5, 11, 10.5, 10, 9.5, 9, 8.5, 8, 7.5, 7, 6.5, 6, 5.5, 5, 4.5, 4];
export const FS_MIN = FS_CANDIDATES[FS_CANDIDATES.length - 1];
export const FS_BASE = FS_CANDIDATES[0];

// Bir kartta az madde varsa (bkz. GROW_ITEM_THRESHOLD), kart bos/dagitik
// gorunmesin diye yazi FS_BASE'in UZERINE de cikabilir - GROW_MAX'e kadar.
// Oran, istenen "normal 14 ise 18'i gecmesin" (goz yormayacak ust sinir)
// orneginden turetildi: 18/14 ≈ 1.286 * FS_BASE(12.5) ≈ 16.
export const GROW_MAX = 16;
export const GROW_CANDIDATES = [16, 15.5, 15, 14.5, 14, 13.5, 13, FS_BASE];
export const GROW_ITEM_THRESHOLD = 5;

// Az maddeli (GROW_ITEM_THRESHOLD altinda) bir kartin merdiveni: ONCE
// GROW_CANDIDATES (kart bos/dagitik gorunmesin diye FS_BASE ustune cikabilir),
// SONRA normal kucultme rungslari (FS_BASE'in ALTI, FS_MIN'e kadar). FS_BASE
// (12.5) iki listede de oldugu icin FS_CANDIDATES'in ilk elemani atlanir.
//
// Kritik: eskiden az maddeli kart SADECE GROW_CANDIDATES kullaniyordu, yani
// tabani 12.5pt idi. 4 uzun maddesi olan bir kart 12.5pt'de sigmayinca daha
// kucuk font DENENEMEDIGI icin madde KIRPILIP "+N madde" yaziliyordu (kullanici
// bildirimi 2026-09-03, Ece/İş Zekası: "Yapılacak İşler kartında 2 madde
// gorunup +2 madde yaziyor, oysa sutunda 14'un cok altinda madde var"). Artik
// once buyur, SIGMAZSA 4pt'ye kadar kucul - kirpma yalnizca gercekten (en kucuk
// fontta bile) sigmayan durumda son care olarak yapilir.
export const GROW_THEN_SHRINK = [...GROW_CANDIDATES, ...FS_CANDIDATES.slice(1)];

// Slaytta okunabilir kabul edilen en kucuk punto. Madde siniri kaldirildiktan
// sonra cok maddeli slaytlar FS_MIN'e (4pt) kadar kuculebiliyor; onizleme
// tuvali 1280px olup sag panelde ~0.33 olcekle cizildigi icin 4pt ekranda
// ~2 piksele denk geliyor ve kart BOS gorunuyor (kullanici bildirimi
// 2026-09-07: "Gozde'nin 10 ve 11. sprintlerin icerik slayti bos gorunuyor" -
// Urun Gelistirme S10 31 madde -> 4pt, S11 40 madde -> 4pt).
//
// Madde ATILMAZ, punto da zorla buyutulmez (kullanici karari 2026-09-07:
// "sadece PO'ya uyari"); sadece contentReadability ile PO uyarilir, kisaltma
// karari onundur.
export const FS_READABLE_MIN = 7.5;

// Ayni SUTUNDAKI iki kartin puntolari arasinda izin verilen en buyuk oran.
// 16pt'lik bir kartin yaninda 7.5pt'lik bir kart slaytta garip duruyordu
// (kullanici istegi 2026-09-07: "sutunda o dengeyi korumak lazim, puntolar
// birbirinden cok farkli durmamali - bu sunum yoneticiye sunulacak").
// Buyuk puntolu kart bu orana inene kadar kucultulur, bosalan yer digerine
// verilir - bkz. fitContent ADIM 4.
export const FS_SPREAD_MAX = 1.6;

// Sutunda artan pay kartlara YUKSEKLIK olarak degil, MADDE ARALIGI olarak
// verilir (bkz. fitContent ADIM 7) ve bu pay sinirlidir: bir maddenin normal
// araligi en fazla bu katsayi kadar acilabilir. Sinir olmasaydi 3 maddelik bir
// kartta maddeler arasi bosluk parmak kadar acilir, "yayilmis" degil "dagilmis"
// gorunurdu. Sigmayan pay sutunun altinda bos kalir - kartin ICINDE sahte
// bosluk birakmaktan iyidir (kullanici bildirimi 2026-09-08, Gözde:
// "altinda buyuk bir bosluk varmis gibi gosterip ilgili alana doldurmuyor").
export const MAX_EXTRA_GAP_FACTOR = 2;

// NOT: MAX_ITEMS_PER_COLUMN (sutun basina 14 madde siniri) KALDIRILDI
// (kullanici karari 2026-09-07). Madde sayisina gore kirpma yapilmaz; PO'nun
// yazdigi tum maddeler slayta girer, sigdirma yalnizca yazi boyutuyla olur -
// bkz. fitContent. Slaytta artik "+N madde" notu HIC gorunmez.

// Sutunlar: [ust kart, alt kart].
const COLUMN_KEYS = [["done", "risk"], ["active", "pending"]];

/** Maddeler arasi bosluk, yazi boyutuyla orantili kuculur (sabit kalirsa kucuk fontlarda oranti bozulur). */
export function gapAt(f) {
  return Math.max(0.01, f * 0.0052);
}

// logo_a (aksa) 308x63, logo_b (Kazancı Holding) 227x83 piksel - assets/pptxAssets.js.
export const LOGO_RATIO_A = 308 / 63;
export const LOGO_RATIO_B = 227 / 83;

/**
 * Iki logoyu (aksa + Kazancı Holding) sag kenara dayali, YAN YANA ve ayni
 * yukseklikte konumlandirir - onizlemedeki (.s-logos/.dlogos: display:flex,
 * align-items:center, sabit img height) duzenle BIREBIR AYNI. PPTX export
 * (sprintDeckBuilder/dashboardDeckBuilder) bunu kullanmadan once logolari
 * dikey istifleyip birbirinden bagimsiz x/y degerleriyle konumlandiriyordu -
 * bu da onizlemeyle uyusmayan, "kaymis" gorunen bir export'a yol aciyordu.
 */
export function logoPositions({ rightEdge, top, height, gap = 0.0833 }) {
  const wA = height * LOGO_RATIO_A;
  const wB = height * LOGO_RATIO_B;
  const xA = rightEdge - wA;
  const xB = xA - gap - wB;
  return {
    a: { x: xA, y: top, w: wA, h: height },
    b: { x: xB, y: top, w: wB, h: height },
  };
}

export const SECTION_KEYS = ["done", "active", "risk", "pending"];

/**
 * Bir metni satirlara ayirir (bos satirlar atilir). SectionEditor ve
 * useSprintForm ayni fonksiyonu kullanir. Sadece maddenin ANA metni trim
 * edilir - yorum kismina dokunulmaz, yoksa kullanici yorum kutusuna yazarken
 * her tuş vurusunda (state round-trip'inde) satirin sonundaki bosluk
 * karakteri aninda silinip bosluk hic yazilamiyormus gibi gorunuyordu.
 */
export function linesOf(text) {
  return String(text || "")
    .split("\n")
    .map((line) => {
      const { text: base, comment } = extractComment(line);
      const trimmedBase = base.trim();
      if (!trimmedBase) return "";
      return comment !== "" ? trimmedBase + COMMENT_SEP + comment : trimmedBase;
    })
    .filter(Boolean);
}

// Bir maddeye (satira) yorum eklemek icin, gorunmez bir kontrol karakteriyle
// (kullanicinin klavyeden asla yazamayacagi) metnin sonuna eklenir - boylece
// mevcut string tabanli bolum modeli (useSprintForm.sections) degismeden,
// SectionEditor/SlideCanvas/sprintDeckBuilder ayni satirdan hem metni hem
// yorumu cikarabilir. Sadece Iş Zekası ekibine ozel "yorum ekle" ozelligi icin.
const COMMENT_SEP = "";

/** Bir maddenin (ham satirin) metnini ve varsa yorumunu ayirir. */
export function extractComment(t) {
  const str = String(t);
  const idx = str.indexOf(COMMENT_SEP);
  if (idx === -1) return { text: str, comment: "" };
  return { text: str.slice(0, idx), comment: str.slice(idx + 1) };
}

/**
 * Bir maddenin metnini (yorumu koruyarak) veya yorumunu (metni koruyarak)
 * gunceller. Yorum burada TRIM EDILMEZ - kullanici hala yaziyorken (orn. iki
 * kelime arasina bosluk koyarken) trim, her tus vurusunda son karakteri
 * (bosluk) silip bosluk yazilamiyormus hissi yaratirdi. Baştaki/sondaki
 * fazladan bosluklar sadece goruntulenirken (SlideCanvas/sprintDeckBuilder)
 * temizlenir.
 */
export function withComment(text, comment) {
  const base = String(text || "");
  const c = String(comment || "");
  return c !== "" ? base + COMMENT_SEP + c : base;
}

export function sectionDefs(assets) {
  return {
    done: { title: "Tamamlanan İşler", icon: assets.icon_check, accent: "16A34A" },
    active: { title: "Yapılacak İşler", icon: assets.icon_rocket, accent: "2563EB" },
    risk: { title: "Riskler", icon: assets.icon_warn, accent: "E0761F" },
    pending: { title: "Bekleyen Konular", icon: assets.icon_clock, accent: "7C3AED" },
  };
}

const textW = G.COL_W - G.ACC_ZONE - G.PAD_R - 0.16;

// Bu iki sabit, bir maddenin kac satir tutacagini ve bir satirin yuksekligini
// TAHMIN eder. Tahmin GERCEKTEN fazla yer ayirirsa kart icerikten uzun cizilir
// ve altinda bosluk kalir; ayrica gereksiz yere daha kucuk punto secilir
// (kullanici bildirimi 2026-09-08, Gözde: "yazi boyutunu kucultuyor, ilgili
// alana doldurmuyor, gorunum estetik degil").
//
// Tarayicida (Segoe UI, .card li line-height 1.28, font-size = punto*1.333)
// olculdu, 7-16pt araliginda:
//   - karakter genisligi sabiti gercekte 0.00681 (eski deger 0.0086, yani her
//     karakter %26 GENIS sayiliyordu - metin sarmadigi halde "sarar" deniyordu)
//   - satir yuksekligi tam olarak f*0.0178; eski formuldeki +0.02 (satir basina
//     ~2px) tamamen fazladan ayrilan paydi
//
// Olculen degerlere YAPISMIYORUZ, guvenlik payi birakiyoruz: PPTX Calibri
// kullanir (Segoe UI'dan dar, yani orada daha da rahat sigar) ama PowerPoint'in
// kendi sarma davranisi birebir ayni degil. Model fazla iyimser olursa metin
// karta sigmaz ve .card overflow:hidden yuzunden SESSIZCE KIRPILIR - bu, bosluk
// birakmaktan cok daha kotudur (bkz. app.css'teki 2026-08-25 bildirimi).
// Bu yuzden: karakter sabiti olculenin (0.00681) ustunde 0.0070, satir payi
// 0.02 yerine 0.006. Tarayicida dogrulandi: her senaryoda model >= gercek,
// yani hicbir yerde kirpma olmuyor. PPTX tarafinda ayrica fit:"shrink" son
// guvenlik agi olarak duruyor.
export const cplAt = (f) => Math.floor(textW / (f * 0.0070));
export const lhAt = (f) => f * 0.0178 + 0.006;

function stripPriorityTag(t) {
  return String(t).replace(/##(.+?)##/g, "");
}

// Kalin ("**metin**") karakterler tarayicida (canvas measureText ile Segoe UI
// 700 vs 400 icin olculdu, ~%7) ve PPTX ciktisinda (Calibri Bold, pptxgenjs
// autoFit kullanmiyor) normalden daha genis yer kaplar. Bu agirlik
// uygulanmazsa itemLineCount kalin metinlerde gercekte kirilacak satir
// sayisini az tahmin eder, kart yuksekligi (cardH) buna gore az hesaplanir
// ve son satir(lar) sabit yukseklikli karttan tasip alt karti kaydiriyormus
// gibi gorunurdu (PPTX'te ise gercekten tasar, autoFit yok).
const BOLD_WIDTH_FACTOR = 1.08;

function weightedLen(t) {
  return parseRuns(stripPriorityTag(t)).reduce(
    (sum, run) => sum + run.text.length * (run.bold ? BOLD_WIDTH_FACTOR : 1),
    0
  );
}

export function plainLen(t) {
  const { text } = extractComment(t);
  return weightedLen(text);
}

/** Bir maddenin (yorum dahil) kac satir yer kaplayacagini tahmin eder - bkz. bulletsBlockH. */
export function itemLineCount(t, cpl) {
  const { text, comment } = extractComment(t);
  let L = Math.max(1, Math.ceil((weightedLen(text) || 1) / cpl));
  if (comment) {
    L += Math.max(1, Math.ceil((comment.length || 1) / cpl));
  }
  return L;
}

export function bulletsBlockH(items, f) {
  const cpl = cplAt(f), lh = lhAt(f), gap = gapAt(f);
  let h = 0;
  items.forEach((t, i) => {
    const L = itemLineCount(t, cpl);
    h += L * lh + (i < items.length - 1 ? gap : 0);
  });
  return h;
}

export const SEGCOL = { green: "8BC34A", lightgreen: "A8E6A1", blue: "456BBA", orange: "E67514", amber: "E8A64D", red: "D9534F", gray: "9AA3AF", purple: "7C3AED" };
export const BAND = { Y: 1.14, H: 0.44, GAP: 0.30, X: 0.35, W: 13.333 - 0.70 };

export function num(v) {
  const n = parseFloat(String(v).replace(",", "."));
  return isFinite(n) ? n : 0;
}

export function bandBars(d) {
  return d.showBand && Array.isArray(d.targets)
    ? d.targets.filter((b) => b && (b.segments || []).filter((s) => s && String(s.value).trim() !== "").length)
    : [];
}

/**
 * Hedefler bandindaki segmentlerin genisligini hesaplar. Onceden SADECE degere
 * orantili genislik kullaniliyordu (kucuk bir deger kucuk genislik demekti) -
 * degerin kendisi "1.26" gibi birkaç haneli oldugunda, orantili genislik metnin
 * KENDISINDEN dar kalabiliyor ve sayi kutunun icinde IKI SATIRA kirilip
 * (gorsel olarak asagiya "taşıyormuş" gibi) bozuk gorunuyordu.
 *
 * Once her segmentin KENDI metnini tek satirda gosterebilecegi bir TABAN
 * genislik ayrilir (karakter sayisina gore); geriye kalan alan (varsa)
 * degerlere ORANTILI dagitilir - boylece "buyuk deger = genis bar" gorsel
 * mantigi korunurken hicbir segment kendi metninden dar olamaz. Taban
 * genislikler toplami mevcut alani asarsa (asiri dar bir bant), hepsi ayni
 * oranda kucultulur ki toplam GENISLIK HER ZAMAN tam olarak totalW'ye esit
 * kalsin - bandin kendisi tasmaz/kaymaz.
 *
 * Onizleme (SlideCanvas) ve PPTX (sprintDeckBuilder) AYNI fonksiyonu kullanir.
 */
export function segmentWidths(segs, totalW, charW = 0.078, padding = 0.14) {
  const values = segs.map((s) => Math.max(0.0001, num(s.value)));
  const sum = values.reduce((a, b) => a + b, 0) || 1;
  const mins = segs.map((s) => Math.max(0.3, String(s.value).trim().length * charW + padding));
  const minTotal = mins.reduce((a, b) => a + b, 0);

  if (minTotal >= totalW) {
    const scale = totalW / minTotal;
    return mins.map((m) => m * scale);
  }
  const remaining = totalW - minTotal;
  return values.map((v, i) => mins[i] + (v / sum) * remaining);
}


/** Bandda zaman disi fayda cubugu var mi? (renk aciklamasi buna bagli) */
export function hasBenefitBand(d) {
  return bandBars(d).some((b) => b && b.kind === "benefit");
}

export function cardsTopFor(d) {
  return bandBars(d).length ? BAND.Y + BAND.H + 0.16 : G.Y_TOP;
}

export function cardH(items, f) {
  return G.PAD_T + G.TITLE_H + bulletsBlockH(items, f) + G.PAD_B;
}

/**
 * Bir TEK kartin (bolumun) en iyi yazi boyutunu, verilen yukseklik butcesine
 * gore secer - digerBölumlerden BAGIMSIZ. Madde sayisi GROW_ITEM_THRESHOLD'in
 * altindaysa (kart bos/dagitik gorunmesin diye) once GROW_CANDIDATES (FS_BASE
 * ustu, GROW_MAX'e kadar) denenir; degilse veya hicbiri sigmazsa normal
 * FS_CANDIDATES (FS_BASE'ten FS_MIN'e kucule kucule) denenir.
 */
function ladderFor(items) {
  return items.length > 0 && items.length < GROW_ITEM_THRESHOLD ? GROW_THEN_SHRINK : FS_CANDIDATES;
}

export function pickCardFS(items, availH) {
  const ladder = ladderFor(items);
  for (const c of ladder) {
    if (cardH(items, c) <= availH) return c;
  }
  return FS_MIN;
}

/**
 * Icerik slaytinin 4 kartini da (her biri KENDI madde sayisina gore BAGIMSIZ
 * yazi boyutuyla) sigdirir. Dikey alan SUTUN basina paylastirilir: sol sutun
 * (Tamamlanan Isler + Riskler) ve sag sutun (Yapilacak Isler + Bekleyen
 * Konular) birbirinden BAGIMSIZ bolunur, yani iki karti ayiran sinir sutunlarda
 * farkli yuksekliklerde olabilir. Boylece bir sutundaki bos kart, ayni satirdaki
 * dolu kartin yerini daraltmaz.
 *
 * MADDE KIRPMA YOKTUR (kullanici karari 2026-09-07: "madde restriction kalksin,
 * kendileri okunabiliyor mu diye bakarlar"). PO ne yazdiysa TAMAMI slayta
 * girer; sigdirma YALNIZCA yazi boyutuyla yapilir - az maddeli kart buyur
 * (GROW_CANDIDATES), cok maddeli kart FS_MIN'e (4pt) kadar kuculur. En kucuk
 * puntoda bile sigmiyorsa tasmaya izin verilir; PO onizlemede gorup kendi
 * kisaltir. Eskiden once sutun basina 14 madde siniri uygulanir, sonra da
 * geometri geregi madde atilip yerine "+N madde" notu birakilirdi - ikisi de
 * kaldirildi.
 *
 * Onizleme (SlideCanvas) ve PPTX (sprintDeckBuilder) AYNI fonksiyonu kullanir,
 * ikisi de senkron kalir.
 */
export function fitContent(d, cardsTop) {
  const avail = G.Y_BOT - cardsTop;

  const items = { done: [...d.done], active: [...d.active], risk: [...d.risk], pending: [...d.pending] };
  const ladder = {};
  const idx = {};

  /** Kartta cizilecek satirlar - artik maddelerin TAMAMI (kirpma/not yok). */
  const shown = (k) => items[k];

  SECTION_KEYS.forEach((k) => {
    ladder[k] = ladderFor(shown(k));
    idx[k] = 0;
  });

  const fsOf = (k) => ladder[k][idx[k]];

  // Dikey butce SUTUN basina paylastirilir, SATIR basina DEGIL.
  //
  // Eskiden iki sutunun ust kartlari (Tamamlanan|Yapilacak) ortak bir yukseklik
  // paylasiyordu (max of the two), alt kartlar da (Riskler|Bekleyen) oyle. Bu
  // yuzden BIR sutundaki dolu kart, DIGER sutundaki bos kartin bosuna ayirdigi
  // yeri kullanamiyordu: 6 tamamlanan + 6 risk (sol) yaninda 17 bekleyen konu
  // (sag, ustundeki Yapilacak Isler kartı BOS) yazildiginda ust satir sirf sol
  // sutun yuzunden 2.58" yer kapliyor, Bekleyen Konular 5.5 pt'ye kadar
  // kuculuyordu - okunamayacak kadar (kullanici bildirimi 2026-08-26: "punto
  // cok kuculdu yapilacak isler karti bos olmasina ragmen").
  //
  // Artik her sutun kendi 2 kartiyla avail'i paylasir; kartlar arasindaki
  // sinir sutunlarda FARKLI yuksekliklerde olabilir (kullanici istegi:
  // "kartlardaki madde sayisina gore kartlarin dikey olarak kaymasi").
  // Iki sutunun icerigi dengeliyse sonuc eskisiyle AYNI kalir - kartlar yine
  // hizali gorunur.
  const columns = {};
  // Kart basina, mevcut madde araligina EKLENECEK pay (inc). Bkz. ADIM 7.
  const ekAralik = {};
  COLUMN_KEYS.forEach(([ust, alt], i) => {
    const butce = avail - G.GAP_Y; // iki kart + aralarindaki bosluk
    const cift = [ust, alt];

    // ADIM 1 - Her kartin "icerik ihtiyaci": FS_BASE'te kaplayacagi yukseklik.
    // Bos kart yalnizca basligini ister, dolayisiyla payi da kucuk cikar.
    const ihtiyac = {};
    cift.forEach((k) => { ihtiyac[k] = cardH(shown(k), FS_BASE); });
    const toplamIhtiyac = ihtiyac[ust] + ihtiyac[alt];

    // ADIM 2 - Sutun butcesi ihtiyaca ORANTILI bolunur.
    //
    // Eskiden iki kart butcenin TAMAMINI bagimsiz kullaniyor, artan yer de
    // stretchRowHeights ile ESIT (extra/2) paylastiriliyordu. Sonuc: 13
    // maddelik "Yapilacak İşler" 7.5pt'de kalirken yanindaki 5 maddelik
    // "Bekleyen Konular" 16pt'ye buyuyup daha buyuk bir kart kapliyordu
    // (kullanici bildirimi 2026-09-07: "yapilacak islerde daha cok madde var
    // ama kart daha kucuk gibi duruyor, cok madde olan kart buyusun ve
    // puntosu artsin"). Artik cok maddeli kart daha genis bir pay alir.
    const pay = {};
    cift.forEach((k) => {
      pay[k] = toplamIhtiyac > 0 ? butce * (ihtiyac[k] / toplamIhtiyac) : butce / 2;
    });

    // ADIM 3 - Her kart KENDI payina sigan en buyuk puntoyu secer.
    const payaGoreSec = (k, kBrutce) => {
      idx[k] = 0;
      while (idx[k] < ladder[k].length - 1 && cardH(shown(k), fsOf(k)) > kBrutce) idx[k]++;
    };
    cift.forEach((k) => payaGoreSec(k, pay[k]));

    // ADIM 4 - PUNTO DENGELEME. Ayni sutundaki iki kartin puntosu birbirinden
    // cok ayrilirsa slayt garip gorunuyor (kullanici istegi 2026-09-07:
    // "sutunda o dengeyi korumak lazim, puntolar birbirinden cok farkli
    // durmamali"). Buyuk puntolu kart FS_SPREAD_MAX oranina inene kadar bir
    // kademe kucultulur; bosalan yukseklik digerine gecer ve o kart
    // BUYUYEBILIR. Buyuk kart yalnizca kuculur, kucuk kart yalnizca buyur -
    // guard zaten sonsuz donguyu engeller, sonucta ADIM 5 tasmayi kapatir.
    // Bos kartlar dengeye girmez (puntolari zaten gorunmuyor).
    let dengeGuard = 0;
    while (dengeGuard++ < 40 && shown(ust).length > 0 && shown(alt).length > 0) {
      const buyukK = fsOf(ust) >= fsOf(alt) ? ust : alt;
      const kucukK = buyukK === ust ? alt : ust;
      if (fsOf(buyukK) <= fsOf(kucukK) * FS_SPREAD_MAX) break;
      if (idx[buyukK] >= ladder[buyukK].length - 1) break;
      idx[buyukK]++;
      const kalan = butce - cardH(shown(buyukK), fsOf(buyukK));
      while (idx[kucukK] > 0 && cardH(shown(kucukK), ladder[kucukK][idx[kucukK] - 1]) <= kalan) {
        idx[kucukK]--;
      }
    }

    // ADIM 5 - Iki kart butceyi asiyorsa YALNIZCA yazi boyutu kucultulur; her adimda o
    // an DAHA UZUN olan kart bir kademe iner. Ikisi de en kucuk puntoya
    // (FS_MIN) geldiyse dongu biter ve TASMAYA IZIN VERILIR - madde ATILMAZ
    // (bkz. fonksiyon basindaki not, kullanici karari 2026-09-07).
    let guard = 0;
    while (guard++ < 2000) {
      const hU = cardH(shown(ust), fsOf(ust));
      const hA = cardH(shown(alt), fsOf(alt));
      if (hU + hA <= butce) break;
      const tallerKey = hU >= hA ? ust : alt;
      if (idx[tallerKey] >= ladder[tallerKey].length - 1) {
        // Uzun olan kart zaten FS_MIN'de; digeri de kuculemiyorsa cikilir.
        const otherKey = tallerKey === ust ? alt : ust;
        if (idx[otherKey] >= ladder[otherKey].length - 1) break;
        idx[otherKey]++;
        continue;
      }
      idx[tallerKey]++;
    }

    // ADIM 6 - ARTAN YERI PUNTOYA CEVIR. ADIM 2'deki orantili paylastirma az
    // maddeli karta kucuk bir pay verir; o kart payina sigmak icin gereginden
    // fazla kuculmus (orn. 2 maddelik "Riskler" 4pt) ama sutunda hala BOS yer
    // kalmis olabilir. Burada bos yer bitene kadar EN KUCUK puntolu karttan
    // baslayarak puntolar birer kademe geri buyutulur - FS_SPREAD_MAX kurali
    // korunur ve buyutme yalnizca SIGDIGI kadar yapildigi icin tasma olusmaz.
    let buyutGuard = 0;
    while (buyutGuard++ < 80) {
      const kalanYer = butce - (cardH(shown(ust), fsOf(ust)) + cardH(shown(alt), fsOf(alt)));
      if (kalanYer <= 0.0001) break;
      const adaylar = cift
        .filter((k) => shown(k).length > 0 && idx[k] > 0)
        .sort((a, b) => fsOf(a) - fsOf(b));
      let buyudu = false;
      for (const k of adaylar) {
        const yeniFs = ladder[k][idx[k] - 1];
        if (cardH(shown(k), yeniFs) - cardH(shown(k), fsOf(k)) > kalanYer) continue;
        const diger = k === ust ? alt : ust;
        if (shown(diger).length > 0 && yeniFs > fsOf(diger) * FS_SPREAD_MAX) continue;
        idx[k]--;
        buyudu = true;
        break;
      }
      if (!buyudu) break;
    }

    // ADIM 7 - KART YUKSEKLIGI ve ARTAN PAYIN DAGITIMI.
    //
    // Eskiden artan yer kartlara dogrudan YUKSEKLIK olarak ekleniyordu
    // (stretchRowHeights): kart uzuyor ama icindeki yazi ayni kaldigi icin
    // ALTINDA BUYUK BIR BOSLUK olusuyordu. En uc ornek: 1 maddelik bir kart
    // 1.04" icerikle 3.19" yuksekliginde ciziliyordu, yani kartin %67'si bos
    // (kullanici bildirimi 2026-09-08, Gözde: "yazi boyutunu kucultuyor,
    // ilgili alana doldurmuyor, gorunum estetik degil").
    //
    // Artik kart icerigi kadar cizilir; artan pay ancak MADDE ARALIGINI
    // acacak kadar verilir (kart dolu gorunur, yazi yayilir) ve bu da
    // sinirlidir - tek maddelik kart HIC gerilmez, cunku yayilacak bir
    // araligi yoktur. Sigmayan pay sutunun altinda bos kalir; kartin
    // icinde sahte bosluk birakmaktan iyidir.
    const dogalUst = cardH(shown(ust), fsOf(ust));
    const dogalAlt = cardH(shown(alt), fsOf(alt));
    const bosPay = butce - (dogalUst + dogalAlt);

    /** Bir kartin madde araligi acilarak en fazla ne kadar uzayabilecegi. */
    const esneklik = (k) => {
      const n = shown(k).length;
      if (n <= 1) return 0;
      return (n - 1) * gapAt(fsOf(k)) * MAX_EXTRA_GAP_FACTOR;
    };

    let ekUst = 0;
    let ekAlt = 0;
    if (bosPay > 0) {
      const esnUst = esneklik(ust);
      const esnAlt = esneklik(alt);
      const toplamEsn = esnUst + esnAlt;
      if (toplamEsn > 0) {
        ekUst = Math.min(esnUst, bosPay * (esnUst / toplamEsn));
        ekAlt = Math.min(esnAlt, bosPay * (esnAlt / toplamEsn));
      }
    }

    const topH = dogalUst + ekUst;
    const botH = dogalAlt + ekAlt;
    // Madde BASINA dusen ek aralik - SlideCanvas ve sprintDeckBuilder bunu
    // mevcut aralige EKLER (deger 0 iken davranis eskisiyle birebir ayni).
    ekAralik[ust] = shown(ust).length > 1 ? ekUst / (shown(ust).length - 1) : 0;
    ekAralik[alt] = shown(alt).length > 1 ? ekAlt / (shown(alt).length - 1) : 0;
    columns[i === 0 ? "left" : "right"] = { topH, botH, yBot: cardsTop + topH + G.GAP_Y };
  });

  const sections = {};
  const fsByKey = {};
  SECTION_KEYS.forEach((k) => { sections[k] = shown(k); fsByKey[k] = fsOf(k); });

  // topH/botH geriye donuk uyumluluk icin SOL sutunun degerleridir - kose
  // deseni (CornerMesh) zaten sol-alt Riskler kartina hizalanir.
  return { sections, fsByKey, columns, ekAralik, topH: columns.left.topH, botH: columns.left.botH };
}

// Öncelik degerlerinin slaytta/PPTX'te gosterilecegi renkler (SEGCOL paletiyle
// tutarli). Metnin yanina yazmak yerine maddenin BAŞINDAKI isaret (•) bu renkte
// gosterilir - bkz. extractPriority. Oncelik belirtilmemis maddelerde isaret
// varsayilan (siyah/INK) kalir.
export const PRIORITY_COLORS = { Kritik: "D9534F", Yüksek: "E67514", Orta: "E8A64D", Düşük: "9AA3AF" };
export const PRIORITY_ORDER = ["Kritik", "Yüksek", "Orta", "Düşük"];
export const PRIORITY_UNSET_LABEL = "Belirtilmedi";
export const PRIORITY_UNSET_COLOR = "1F2937";

/**
 * Madde metninden "##Öncelik##" isaretleyicisini ayiklar (varsa) ve geriye
 * hem oncelik degerini hem de isaretleyici temizlenmis metni doner. Excel'den
 * gelen (formatWorkItemName) ve manuel eklenen (SectionEditor) maddeler ayni
 * kalibi kullanir - bkz. excelParsers.js.
 */
export function extractPriority(t) {
  const str = String(t);
  const m = str.match(/##(.+?)##/);
  if (!m) return { priority: null, text: str };
  let text = str.slice(0, m.index) + str.slice(m.index + m[0].length);
  text = text.replace(/\s*—\s*$/, "").trimEnd();
  return { priority: m[1], text };
}

/**
 * Icerik az oldugunda kartlar sadece basligin sigacagi kadar kucuk kaliyor,
 * slaytin buyuk kismi bos gorunuyordu. Dogal (icerik bazli) yukseklikleri
 * hesapladiktan sonra, cardsTop-Y_BOT arasindaki bosluk kalirsa iki satira
 * esit dagitip kartlari alani dolduracak sekilde gerer. fitSectionItems'in
 * dondurdugu (mumkun olan en cok icerigi gosteren) topH/botH uzerine uygulanir -
 * onizleme (SlideCanvas) ve PPTX (sprintDeckBuilder) AYNI fonksiyonu kullanir,
 * ikisi de senkron kalir.
 */
export function stretchRowHeights(topH, botH, cardsTop, ustPayi = 0.5) {
  const avail = G.Y_BOT - cardsTop;
  const extra = avail - (topH + G.GAP_Y + botH);
  if (extra <= 0) return { topH, botH };
  // ustPayi: artan yerin ust karta dusen orani. Varsayilan 0.5 (eski
  // yariyariya davranis, disaridan cagiran olursa bozulmasin); fitContent
  // icerik ihtiyacina gore hesaplanmis orani gecirir (kullanici istegi
  // 2026-09-07: cok maddeli kart daha uzun olsun).
  const oran = Math.min(1, Math.max(0, ustPayi));
  return { topH: topH + extra * oran, botH: botH + extra * (1 - oran) };
}

/** "**metin**" isaretlemesini kalin run'lara ayirir. SlideCanvas ve sprintDeckBuilder ayni sekilde tuketir. */
export function parseRuns(t) {
  const parts = String(t).split("**");
  const out = [];
  for (let i = 0; i < parts.length; i++) {
    if (parts[i] === "") continue;
    out.push({ text: parts[i], bold: i % 2 === 1 });
  }
  return out.length ? out : [{ text: String(t), bold: false }];
}

/** Bir bolumdeki (done/active/...) maddelerden herhangi biri ##Öncelik## isaretleyicisi iceriyor mu? */
export function hasPriorityTags(data) {
  return SECTION_KEYS.some((k) => (data[k] || []).some((t) => /##(.+?)##/.test(String(t))));
}

/**
 * Icerik slaytindaki en kucuk punto FS_READABLE_MIN'in altina dustuyse
 * PO'yu uyarmak icin gereken bilgiyi dondurur, aksi halde null. Slayti
 * DEGISTIRMEZ - madde kirpmaz, punto zorlamaz (bkz. FS_READABLE_MIN).
 *
 * `d` SlideCanvas/sprintDeckBuilder'a verilen sprintData ile ayni bicimde
 * olmali: { done, active, risk, pending: string[], showBand, targets }.
 */
export function contentReadability(d) {
  if (!d) return null;
  // Bolum dizileri eksik/tanimsiz olabilir (orn. yeni sunum) - fitContent
  // yayilma operatoru kullandigi icin once guvenli bir kopya kurulur.
  const safe = { ...d };
  SECTION_KEYS.forEach((k) => { safe[k] = Array.isArray(d[k]) ? d[k] : []; });
  const dolu = SECTION_KEYS.filter((k) => safe[k].length > 0);
  if (dolu.length === 0) return null;

  const { fsByKey } = fitContent(safe, cardsTopFor(safe));
  const fs = Math.min(...dolu.map((k) => fsByKey[k]));
  if (fs >= FS_READABLE_MIN) return null;

  return {
    fs,
    itemCount: dolu.reduce((toplam, k) => toplam + safe[k].length, 0),
    // 5pt ve altinda yazi ekranda ~2 piksel kaliyor, kart tamamen BOS gorunuyor.
    critical: fs <= 5,
  };
}
