import {
  G, SEGCOL, BAND, bandBars, fitContent, parseRuns, sectionDefs, gapAt, extractPriority, hasBenefitBand, BENEFIT_LEGEND_H,
  extractComment, PRIORITY_COLORS, PRIORITY_ORDER, PRIORITY_UNSET_LABEL, PRIORITY_UNSET_COLOR, hasPriorityTags, logoPositions,
  segmentWidths,
} from "./geometry";
import { DEFAULT_CORNER_MESH } from "../assets/cornerMesh";
import { BENEFIT_CATEGORIES } from "./benefitTypes";

// Resim1 kose-mesh dekorasyonunun gercek en-boy orani (658x960 kaynak PNG) -
// hangi boyutta cizilirse cizilsin bu oranla hesaplanir ki gorsel gerilmesin.
const CORNER_MESH_RATIO = 658 / 960;

/** Kapak slaydini verilen pptx'e ekler - buildFullDeck tarafindan kullanilir. cornerMesh: sablon gorseli, verilmezse varsayilan Resim1 temasi kullanilir. */
export function addCoverSlide(pptx, data, assets, cornerMesh = DEFAULT_CORNER_MESH) {
  const TEAL = "164E63", ORANGE = "E67514", INK = "1F2937";
  const s1 = pptx.addSlide();
  s1.background = { color: "FFFFFF" };
  if (assets.cover_bg) s1.addImage({ data: assets.cover_bg, x: 0, y: 0, w: 13.333, h: 7.5 });
  // "Sunum arka planı" (bkz. useCoverBackground.js) - cover_bg (Kapak Görseli)
  // HER ZAMAN tuvalin tamamini kaplayan OPAK bir gorsel oldugundan, bunun
  // ARKASINA konan bir katman hic gorunmezdi - bu yuzden USTUNE (metnin/
  // logolarin ALTINDA kalacak sekilde, asagida eklenirler) yari-saydam
  // cizilir. Onizlemedeki SlideCanvas.jsx ".cov-page-bg" ile AYNI mantik
  // (bkz. kullanici bildirimi, 2026-08-17: "yüklenen sunum arka planı resmi
  // hiçbir zaman sunumun arka planını güncellemiyor").
  if (assets.slide_bg) s1.addImage({ data: assets.slide_bg, x: 0, y: 0, w: 13.333, h: 7.5, transparency: 12 });
  s1.addShape(pptx.ShapeType.rect, { x: 0, y: 0, w: 6.4, h: 7.5, fill: { color: "FFFFFF", transparency: 22 } });
  // Sablon (Resim1) dekorasyonu - sol (beyaz) panelin alt-sol kosesinde, metnin
  // ARKASINDA (once cizilir) ince bir marka dokusu olarak durur (bkz. kullanici
  // bildirimi: "her sayfada olsun - kapak-içerik-kapasite"). Kucuk boyut + yuksek
  // transparency: SADECE bir arka plan dokusu, hicbir metne/ogeye MUDAHALE
  // etmemeli (bkz. kullanici bildirimi: "yanlış yere yüklemişsin ... arka
  // plan olarak olacak, hiçbir yazıya müdahale etmeyecek").
  if (cornerMesh && !assets.slide_bg) {
    const cmW = 1.7, cmH = cmW / CORNER_MESH_RATIO;
    s1.addImage({ data: cornerMesh, x: -0.15, y: 7.5 - cmH + 0.15, w: cmW, h: cmH, transparency: 55 });
  }
  s1.addImage({ data: assets.logo_a, x: 0.55, y: 0.42, w: 1.35, h: 1.35 * (63 / 308) });
  s1.addImage({ data: assets.logo_b, x: 2.15, y: 0.36, w: 1.05, h: 1.05 * (83 / 227) });
  s1.addText(data.teamName || "Yapay Zeka Ekibi", { x: 0.55, y: 5.15, w: 8.0, h: 0.9, fontFace: "Calibri", fontSize: 40, bold: true, color: TEAL, margin: 0 });
  s1.addShape(pptx.ShapeType.line, { x: 0.6, y: 6.05, w: 2.6, h: 0, line: { color: ORANGE, width: 2.25 } });
  s1.addText(data.subtitle, { x: 0.55, y: 6.12, w: 9.0, h: 0.5, fontFace: "Calibri", fontSize: 18, color: INK, margin: 0 });
  return s1;
}

// Onizlemedeki koyu tema paleti (bkz. theme.css .theme-dark .slidecanvas.tab-content)
// ile birebir ayni degerler - "PPTX koyu temada da onizlemeyle eslessin" istegi.
const CONTENT_PALETTE = {
  light: { PAGE_BG: "FFFFFF", CARD_BG: "FFFFFF", HEADER: "164E63", CARD_LINE: "E5E7EB", TXT_BOLD: "1F2937", TXT_NORMAL: "374151", CMT_TXT: "166534", CMT_BG: "D1FAE5" },
  dark: { PAGE_BG: "131C27", CARD_BG: "1C2733", HEADER: "4A9FE0", CARD_LINE: "3A4756", TXT_BOLD: "E7EDF5", TXT_NORMAL: "B7C4D3", CMT_TXT: "9BF0B4", CMT_BG: null },
};

/** Icerik slaydini verilen pptx'e ekler - buildFullDeck tarafindan kullanilir. cornerMesh: sablon gorseli, verilmezse varsayilan Resim1 temasi kullanilir. */
export function addContentSlide(pptx, data, assets, theme = "light", cornerMesh = DEFAULT_CORNER_MESH) {
  const P = CONTENT_PALETTE[theme] || CONTENT_PALETTE.light;
  const TEAL = "164E63", ORANGE = "E67514";
  const SEC = sectionDefs(assets);

  const s2 = pptx.addSlide();
  s2.background = { color: P.PAGE_BG };
  // "Sunum arka planı" - PO'nun yukledigi gorsel TUM slaytlarin zeminidir
  // (kullanici bildirimi 2026-08-20: "tüm pptx ve preview sayfalarına
  // uygulanan background"). Slaydin ILK ogesi olarak, tam sayfa ve OPAK
  // cizilir; geri kalan her sey uzerine gelir. Onizlemedeki
  // SlideCanvas ".slide-page-bg" ile AYNI davranis.
  if (assets.slide_bg) s2.addImage({ data: assets.slide_bg, x: 0, y: 0, w: 13.333, h: 7.5 });
  // Hafif, dikkat dagitmayan arka plan cilasi - iki buyuk, cok saydam marka
  // rengi daire (aksa mavi/yesil), koselerde. Onizlemedeki (theme.css
  // --page-gradient) radyal gecis hissiyle AYNI fikir; pptxgenjs gercek CSS
  // gradient fill desteklemedigi icin (surumler arasi guvenilmez) bunun
  // yerine cok yuksek transparency'li duz renk sekillerle taklit edilir -
  // "PPTX'lere güzel yakışır bir arka tema" (bkz. kullanici bildirimi).
  s2.addShape(pptx.ShapeType.ellipse, { x: 10.6, y: -2.6, w: 6.5, h: 6.5, fill: { color: "4A9FE0", transparency: 93 }, line: { type: "none" } });
  s2.addShape(pptx.ShapeType.ellipse, { x: -3.2, y: 4.6, w: 6.5, h: 6.5, fill: { color: "8DC63F", transparency: 94 }, line: { type: "none" } });
  s2.addText(data.subtitle, { x: 0.4, y: 0.24, w: 9.8, h: 0.6, fontFace: "Calibri", fontSize: 25, bold: true, color: P.HEADER, margin: 0, valign: "middle" });
  // Onizlemedeki .s-logos (right:24px, top:14px, flex row, img height:34px) ile
  // birebir ayni konumlandirma - bkz. geometry.js/logoPositions.
  const contentLogos = logoPositions({ rightEdge: 13.195, top: 0.147, height: 0.357, gap: 0.084 });
  s2.addImage({ data: assets.logo_b, ...contentLogos.b });
  s2.addImage({ data: assets.logo_a, ...contentLogos.a });
  // Takim bilgisi (baslik) altindaki serit - marka renklerinde iki parcali
  // "bayrak" cizgisi (bkz. kullanici bildirimi: "takım bilgisi altına bir
  // şerit istiyorum"), eskiden tek duz turuncu cizgiydi.
  s2.addShape(pptx.ShapeType.rect, { x: 0, y: 1.0, w: 3.4, h: 0.05, fill: { color: TEAL } });
  s2.addShape(pptx.ShapeType.rect, { x: 3.4, y: 1.0, w: 13.333 - 3.4, h: 0.05, fill: { color: ORANGE } });

  const bars = bandBars(data);
  function drawBand() {
    const n = bars.length;
    if (!n) return G.Y_TOP;
    const barW = (BAND.W - (n - 1) * BAND.GAP) / n;
    bars.forEach((bar, i) => {
      const bx = BAND.X + i * (barW + BAND.GAP);
      const labelW = Math.min(1.2, Math.max(0.55, barW * 0.32));
      // Cubuk ETIKETI (orn. "HEDEFLER"/"FTE") artik RENKSIZ - eskiden koyu
      // teal bir dolgu vardi ve etiket, degerleri gosteren renkli segmentlerin
      // (yani "barin") bir parcasiymis gibi gorunuyordu (PO notu 2026-08-19:
      // "Bu alanın renksiz olması gerekiyor sanki barın bir parçasıymış gibi
      // görünmemeli"). Sadece metin kalir; onizlemedeki .plabel ile ayni.
      s2.addText((bar.label || "").toUpperCase(), { x: bx + 0.03, y: BAND.Y, w: labelW - 0.06, h: BAND.H, fontFace: "Calibri", fontSize: 8.5, bold: true, color: P.TXT_NORMAL, align: "center", valign: "middle", margin: 0, fit: "shrink" });
      const segX0 = bx + labelW + 0.04, segW = barW - labelW - 0.04;
      const segs = bar.segments.filter((s) => s && String(s.value).trim() !== "");
      // segmentWidths, degere ORANTILI genislik yerine once her segmentin
      // KENDI metnini (orn. "1.26") tek satirda gosterebilecegi bir taban
      // genislik ayirir - onceki surumde kucuk bir oran, uzun bir metinden
      // dar bir kutu demekti ve PowerPoint metni IKI SATIRA kirip (fit:"shrink"
      // burada hic yoktu) gorsel olarak bozuk/tasmis gosteriyordu.
      const widths = segmentWidths(segs, segW);
      let cx = segX0;
      segs.forEach((s, si) => {
        const w = widths[si];
        s2.addShape(pptx.ShapeType.rect, { x: cx, y: BAND.Y, w, h: BAND.H, fill: { color: SEGCOL[s.color] || "456BBA" } });
        s2.addText(String(s.value), { x: cx, y: BAND.Y, w, h: BAND.H, fontFace: "Calibri", fontSize: 10, bold: true, color: "FFFFFF", align: "center", valign: "middle", margin: 0, fit: "shrink" });
        cx += w;
      });
    });
    // ZAMAN DISI FAYDA renk aciklamasi - bandin hemen altinda, kucuk punto.
    // Onizlemedeki BenefitLegend ile AYNI icerik ve AYNI konum; iki taraf da
    // BENEFIT_CATEGORIES / BENEFIT_LEGEND_H'ten besleniyor ki birbirinden
    // sapmasin (bkz. lib/benefitTypes.js).
    if (hasBenefitBand(data)) {
      const runs = BENEFIT_CATEGORIES.flatMap((k, i) => [
        ...(i > 0 ? [{ text: "     ", options: {} }] : []),
        { text: "\u25CF  ", options: { color: SEGCOL[k.color] || "456BBA", fontSize: 8 } },
        { text: k.label, options: { color: "4B5563" } },
      ]);
      s2.addText(runs, {
        x: BAND.X, y: BAND.Y + BAND.H + 0.03, w: BAND.W, h: BENEFIT_LEGEND_H,
        fontFace: "Calibri", fontSize: 8.5, margin: 0, valign: "middle", align: "left",
      });
      return BAND.Y + BAND.H + 0.16 + BENEFIT_LEGEND_H;
    }
    return BAND.Y + BAND.H + 0.16;
  }

  const footerTeam = (data.teamName || "Ekip").trim();
  s2.addShape(pptx.ShapeType.rect, { x: 0, y: 7.14, w: 13.333, h: 0.36, fill: { color: TEAL } });
  s2.addText(`Gizli & Dahili Kullanım   |   ${footerTeam}`, { x: 0.4, y: 7.14, w: 7, h: 0.36, fontFace: "Calibri", fontSize: 10, color: "D6E4EA", margin: 0, valign: "middle" });

  if (hasPriorityTags(data)) {
    const legendEntries = [...PRIORITY_ORDER.map((p) => [p, PRIORITY_COLORS[p]]), [PRIORITY_UNSET_LABEL, PRIORITY_UNSET_COLOR]];
    const legendRuns = legendEntries.flatMap(([label, color], i) => [
      ...(i > 0 ? [{ text: "     ", options: {} }] : []),
      { text: "●  ", options: { color, fontSize: 9 } },
      { text: label, options: { color: "D6E4EA" } },
    ]);
    s2.addText(legendRuns, { x: 6.6, y: 7.14, w: 6.3, h: 0.36, fontFace: "Calibri", fontSize: 9.5, margin: 0, valign: "middle", align: "right" });
  }

  const CARDS_TOP = drawBand();
  const { sections, fsByKey, columns, ekAralik } = fitContent(data, CARDS_TOP);
  // Her sutun kendi dikey bolunmesini kullanir (bkz. geometry.fitContent) -
  // onizlemedeki SlideCanvas ile BIREBIR ayni.
  const sol = columns.left, sag = columns.right;

  // ek: sutunda artan payin madde BASINA dusen kismi (inc) - onizlemedeki
  // --item-extra-gap ile AYNI deger (bkz. geometry.js ADIM 7). 0 iken
  // paraSpaceAfter eskisiyle birebir ayni kalir.
  function drawCard(x, y, items, sec, fs2, h, ek = 0) {
    s2.addShape(pptx.ShapeType.roundRect, { x, y, w: G.COL_W, h, rectRadius: 0.06, fill: { color: P.CARD_BG }, line: { color: P.CARD_LINE, width: 1 }, shadow: { type: "outer", color: "9CA3AF", blur: 6, offset: 2, angle: 90, opacity: 0.28 } });
    // Onizlemedeki (.card-watermark, bkz. theme.css) kosede buyuk soluk filigran
    // ikon - onceden SADECE canli onizlemede vardi ("bu CSS'i pptx hic gormez"
    // yorumu artik gecersiz, bkz. kullanici bildirimi). Karta girmeden once
    // (arka planin USTUNDE, metin/ikonun ALTINDA) cizilir ki cizim sirasi
    // (=pptx katman sirasi) onizlemedeki gorsel dili birebir yansitsin.
    const wmSize = Math.min(1.1458, G.COL_W * 0.34, h * 0.75);
    s2.addImage({
      data: sec.icon,
      x: x + G.COL_W - wmSize - 0.08,
      y: y + h - wmSize - 0.08,
      w: wmSize,
      h: wmSize,
      rotate: -8,
      transparency: theme === "dark" ? 86 : 91,
    });
    s2.addShape(pptx.ShapeType.roundRect, { x: x + 0.07, y: y + 0.12, w: 0.075, h: h - 0.24, rectRadius: 0.04, fill: { color: sec.accent }, line: { type: "none" } });
    s2.addImage({ data: sec.icon, x: x + G.ACC_ZONE, y: y + G.PAD_T + 0.02, w: G.ICON, h: G.ICON });
    s2.addText(sec.title, { x: x + G.ACC_ZONE + G.ICON + 0.12, y: y + G.PAD_T, w: G.COL_W - G.ACC_ZONE - G.ICON - 0.3, h: G.TITLE_H - 0.06, fontFace: "Calibri", fontSize: 14.5, bold: true, color: sec.accent, valign: "middle", margin: 0 });
    if (items.length) {
      const runs = items
        .map((t, i) => {
          const { text: withoutComment, comment: rawComment } = extractComment(t);
          const comment = rawComment.trim();
          const { priority, text } = extractPriority(withoutComment);
          const bulletColor = priority ? PRIORITY_COLORS[priority] : PRIORITY_UNSET_COLOR;
          // **bold** parcalar - onizlemede (bkz. app.css .card li b) yesil
          // "highlight" kutusu olarak gosteriliyor; ayni renk cifti (D1FAE5/166534)
          // burada da PowerPoint'in native metin vurgusuyla (highlight) taklit
          // edilir - "yorum" ozelligiyle (asagida) BİREBİR AYNI gorsel dil.
          const mainRuns = parseRuns(text).map((r) => ({
            text: r.text,
            options: r.bold ? { bold: true, color: "166534", highlight: "D1FAE5" } : { color: P.TXT_NORMAL },
          }));
          // Oncelik ADI ("KRİTİK"/"ORTA" gibi) madde basina GERI eklenir -
          // PO notu 2026-08-20: onizlemedeki (SlideCanvas.jsx) etiketli
          // gorunume donuldugu icin PPTX ciktisi da AYNI kalsin diye.
          if (priority) {
            // Renkli/kalin bir metin etiketi ("KRİTİK " gibi) - bkz. asagidaki dot
            // ile ayni renk mantigi.
            mainRuns.unshift({ text: priority.toUpperCase() + "  ", options: { bold: true, color: bulletColor } });
          }
          // Oncelik noktasi: pptxgenjs/PowerPoint'te native "bullet" ozelliginin
          // rengi (bullet:{color}) guvenilir basilmiyor - oncelik BELIRTILMEMIS
          // maddelerde (bkz. kullanici bildirimi) bu yuzden PRIORITY_UNSET_COLOR
          // (siyaha yakin) yerine PowerPoint'in varsayilan/tema rengi (gri, "Düşük"
          // ile ayni gorunen) basiliyordu. Guvenilir tek yol, noktayi normal bir
          // METIN karakteri olarak (native bullet KULLANMADAN) elle eklemek -
          // oncelik etiketinde ("KRİTİK " gibi) zaten kullanilan ayni yontem.
          mainRuns.unshift({ text: "●  ", options: { color: bulletColor } });
          // NOT: burada breakLine SET EDILMEZ - mainRuns[0] madde metninin
          // sadece ILK run'i olabilir (orn. "metin " + "**Departman**" gibi
          // ic ice bold varsa). breakLine, madde SONUNDAKI run'a (asagida,
          // yorum/isLastItem mantigiyla) ait bir ozellik - buraya konursa
          // bold departman/etiket parcasi, ait oldugu satirdan kopup bir
          // ALT SATIRA duserdi (bkz. kullanici bildirimi: "bold yazılar
          // aşağı satıra kayıyor").
          mainRuns[0].options = Object.assign({}, mainRuns[0].options, {
            paraSpaceAfter: (gapAt(fs2) + ek) * 72,
          });
          const isLastItem = i === items.length - 1;
          if (comment) {
            // Maddeye ozel yorum: ana metnin hemen altina, agac (tree) gorunumunde
            // ("  * yorum") ve yesil serit (highlight) ile vurgulanmis bir alt satir
            // olarak eklenir - bkz. SlideCanvas.jsx'teki .item-comment ile
            // onizlemede ayni gorsel dil (emoji kullanilmaz).
            mainRuns[mainRuns.length - 1].options = Object.assign({}, mainRuns[mainRuns.length - 1].options, { breakLine: true });
            mainRuns.push({
              text: "  * " + comment,
              options: {
                italic: true,
                // Koyu temada koyu yesil metin kart zeminine gomulup
                // okunmuyordu (kullanici bildirimi 2026-08-19): o temada
                // acik yesil metin kullanilir ve acik yesil vurgu seridi
                // (highlight) hic uygulanmaz - onizlemedeki
                // ".theme-dark ... .item-comment" ile ayni tercih.
                color: P.CMT_TXT,
                ...(P.CMT_BG ? { highlight: P.CMT_BG } : {}),
                fontSize: fs2 * 0.84,
                breakLine: !isLastItem,
                paraSpaceAfter: (gapAt(fs2) + ek) * 72,
              },
            });
          } else {
            mainRuns[mainRuns.length - 1].options = Object.assign({}, mainRuns[mainRuns.length - 1].options, { breakLine: !isLastItem });
          }
          return mainRuns;
        })
        .flat();
      s2.addText(runs, {
        x: x + G.ACC_ZONE, y: y + G.PAD_T + G.TITLE_H, w: G.COL_W - G.ACC_ZONE - G.PAD_R, h: h - G.PAD_T - G.TITLE_H - G.PAD_B + 0.05,
        fontFace: "Calibri", fontSize: fs2, color: P.TXT_NORMAL, valign: "top", margin: 0, lineSpacingMultiple: 1.0,
        // Onizlemedeki (geometry.js/fitContent) font hesabi bir TAHMIN (karakter/
        // satir yaklasimidir) - gercek PowerPoint metin sarma davranisiyla birebir
        // eslesmeyebilir. fit:"shrink", PowerPoint'in kendi autofit motorunu devreye
        // sokup kutuya HIC BIR ZAMAN tasmayacagini garanti eder (guvenlik agi).
        fit: "shrink",
      });
    }
    return h;
  }

  // Sablon (Resim1) dekorasyonu - Riskler kartinin (alt-sol) SOLUNDA, kartin
  // ARKASINDA (kartlardan ONCE cizilir). sol.yBot/sol.botH burada (CARDS_TOP/
  // fitContent'ten SONRA) kullanilir ki konum, Riskler kartinin GERCEK
  // (icerige gore degisen) konumuyla HER ZAMAN eslessin - eskiden sabit bir
  // y degeri kullanilinca kart kisa/uzun oldukca "kayık" gorunuyordu (bkz.
  // kullanici bildirimi). flipH ile "sivri uc" sol kenara degil slaytin
  // icine dogru baksin diye yatay olarak aynalanir.
  if (cornerMesh && !assets.slide_bg) {
    const cmH = sol.botH * 0.92, cmW = cmH * CORNER_MESH_RATIO;
    // x: eskiden neredeyse tamami slayt disina taşiyordu (bkz. kullanici
    // bildirimi: "hala sayfa dışında kalıyor") - artik gorselin yaklasik
    // yarisi slayt icinde gorunur kalacak sekilde saga kaydirildi.
    s2.addImage({
      data: cornerMesh, x: -cmW * 0.42, y: sol.yBot + (sol.botH - cmH) / 2, w: cmW, h: cmH,
      transparency: 45, flipH: true,
    });
  }

  drawCard(G.X_L, CARDS_TOP, sections.done, SEC.done, fsByKey.done, sol.topH, ekAralik.done);
  drawCard(G.X_L, sol.yBot, sections.risk, SEC.risk, fsByKey.risk, sol.botH, ekAralik.risk);
  drawCard(G.X_R, CARDS_TOP, sections.active, SEC.active, fsByKey.active, sag.topH, ekAralik.active);
  drawCard(G.X_R, sag.yBot, sections.pending, SEC.pending, fsByKey.pending, sag.botH, ekAralik.pending);

  return s2;
}
