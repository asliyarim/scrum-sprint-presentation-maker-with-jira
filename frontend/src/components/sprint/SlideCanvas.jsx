import { Fragment } from "react";
import {
  G, BAND, SEGCOL, bandBars, cardsTopFor, fitContent, parseRuns, sectionDefs,
  extractPriority, extractComment, PRIORITY_COLORS, PRIORITY_ORDER, PRIORITY_UNSET_LABEL, PRIORITY_UNSET_COLOR, hasPriorityTags, gapAt,
  segmentWidths,
} from "../../lib/geometry";
import { DEFAULT_CORNER_MESH } from "../../assets/cornerMesh";

const S = 96; // px per inch - orijinal ile birebir ayni olcek
// Resim1 sablon dekorasyonu - PPTX'teki (sprintDeckBuilder.js) AYNI inc
// koordinatlariyla, S carpani ile piksele cevrilir ki onizleme/PPTX birebir
// eslessin (bkz. kullanici bildirimi: "her sayfada olsun").
const CORNER_MESH_RATIO = 658 / 960;
function CornerMesh({ w, x, y, opacity, flip }) {
  const h = w / CORNER_MESH_RATIO;
  return (
    <img
      className="corner-mesh-deco"
      src={DEFAULT_CORNER_MESH}
      alt=""
      aria-hidden="true"
      style={{
        position: "absolute", left: x * S, top: y * S, width: w * S, height: h * S, opacity, pointerEvents: "none",
        // PPTX'te blur desteklenmedigi icin oradaki denk gorunumu yuksek
        // transparency ile taklit ediyoruz - web onizlemede ekstra bir
        // yumusaklik bonus olarak eklenebilir (bkz. kullanici bildirimi:
        // "gerekirse blur vs falan ekle"). flip: PPTX tarafindaki flipH ile
        // AYNI - "sivri uc" disariya degil slaytin icine dogru baksin diye.
        filter: "blur(1.5px)",
        transform: flip ? "scaleX(-1)" : undefined,
      }}
    />
  );
}

function BulletText({ text }) {
  return (
    <>
      {parseRuns(text).map((run, i) =>
        run.bold ? <b key={i}>{run.text}</b> : <Fragment key={i}>{run.text}</Fragment>
      )}
    </>
  );
}

function PriorityLegend() {
  return (
    <div className="s-legend">
      {PRIORITY_ORDER.map((p) => (
        <span className="s-legend-item" key={p}>
          <i style={{ background: "#" + PRIORITY_COLORS[p] }} />
          {p}
        </span>
      ))}
      <span className="s-legend-item">
        <i style={{ background: "#" + PRIORITY_UNSET_COLOR }} />
        {PRIORITY_UNSET_LABEL}
      </span>
    </div>
  );
}

function Card({ x, y, w, h, items, sec, fontSize, extraGap = 0 }) {
  return (
    // --item-gap: geometrinin madde araligi (gapAt) - eskiden CSS'te sabit
    // 5px'ti ve modelin kullandigi degerle UYUSMUYORDU; kucuk puntolarda CSS
    // daha genis oldugu icin metin karta sigmiyor, .card overflow:hidden
    // yuzunden son madde(ler) sessizce kirpilabiliyordu (tarayicida olculdu,
    // 2026-09-09). Artik iki taraf da AYNI kaynaktan besleniyor.
    // --item-extra-gap: sutunda artan payin madde BASINA dusen kismi
    // (bkz. geometry.js ADIM 7).
    <div
      className="card"
      style={{
        left: x * S, top: y * S, width: w * S, height: h * S,
        "--item-gap": gapAt(fontSize) * S + "px",
        "--item-extra-gap": extraGap * S + "px",
      }}
    >
      <img className="card-watermark" src={sec.icon} alt="" aria-hidden="true" />
      <div className="acc" style={{ background: "#" + sec.accent, boxShadow: "0 0 10px #" + sec.accent + "70" }} />
      <div className="chd">
        <img src={sec.icon} alt="" />
        <span className="ct" style={{ color: "#" + sec.accent }}>{sec.title}</span>
      </div>
      <ul style={{ fontSize: fontSize * 1.333 }}>
        {items.map((t, i) => {
          const { text: withoutComment, comment } = extractComment(t);
          const { priority, text } = extractPriority(withoutComment);
          const bulletColor = priority ? PRIORITY_COLORS[priority] : PRIORITY_UNSET_COLOR;
          // Oncelik ADI ("Orta"/"Kritik") madde basina rozet olarak GERI
          // YAZILIR - PO notu 2026-08-20: onceki "sadece nokta" hali
          // (2026-08-19'daki degisiklik) geri alindi, eski (etiketli)
          // gorunume donuldu. Rozet boyutu sektor etiketiyle (.card li b)
          // AYNI (PO notu: "bu label ın büyüklüğü sektör label ı ile aynı
          // olacak").
          return (
            <li key={i} style={{ "--bullet-color": "#" + bulletColor }}>
              <span className="dot" />
              {priority && (
                <span className="priority-label" style={{ background: "#" + bulletColor }}>
                  {priority}
                </span>
              )}
              <BulletText text={text} />
              {comment.trim() && <div className="item-comment">* {comment.trim()}</div>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Band({ bars }) {
  if (!bars.length) return null;
  const n = bars.length, totalW = BAND.W * S, gap = BAND.GAP * S, barW = (totalW - (n - 1) * gap) / n;
  return (
    <>
      {bars.map((bar, i) => {
        const bx = BAND.X * S + i * (barW + gap);
        const labelW = Math.min(1.2, Math.max(0.55, (barW / S) * 0.32)) * S;
        const segs = bar.segments.filter((s) => s && String(s.value).trim() !== "");
        // charW/padding S (piksel) birimine gore, geometry.js'in varsayilan
        // (inc bazli) degerlerinden turetildi - onizleme S=96px/inc kullanir.
        const widths = segmentWidths(segs, barW - labelW - 4, 0.078 * S, 0.14 * S);
        return (
          <div className="pbar" key={i} style={{ left: bx, top: BAND.Y * S, width: barW, height: BAND.H * S }}>
            <div className="plabel" style={{ width: labelW }}>{(bar.label || "").toUpperCase()}</div>
            <div className="psegs">
              {segs.map((s, si) => (
                <div key={si} className="pseg" style={{ width: widths[si], background: "#" + (SEGCOL[s.color] || "456BBA") }}>
                  {String(s.value)}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}

/**
 * Sprint slaytini (kapak veya icerik) 1280x720 sabit tuval uzerinde,
 * PPTX ile birebir ayni geometriyle (lib/geometry.js) cizer. Kucuk canli
 * onizleme (UnifiedPreviewPane) ve buyutulmus "Preview" (ZoomModal) AYNI
 * bilesen/AYNI (salt-okunur, bicimlendirilmis) goruntuyu kullanir - onceden
 * ZoomModal'da bir duzenlenebilir textarea moduna geciyordu, bu da ** kalin
 * isaretleyicilerinin ve madde yorumlarinin duz metin olarak gorunmesine
 * (canli onizlemeyle tutarsiz gorunmesine) yol aciyordu.
 */
export default function SlideCanvas({ data, tab, assets, scale }) {
  const SEC = sectionDefs(assets);

  let content;
  if (tab === "cover") {
    content = (
      <div className="cov" style={{ backgroundImage: `url(${assets.cover_bg || ""})` }}>
        {/* "Sunum arka planı" (bkz. useCoverBackground.js) - varsayilan
            "Kapak Görseli" (cover_bg, yukarida .cov'un KENDI CSS zemini) HER
            ZAMAN tuvalin TAMAMINI kaplayan OPAK bir gorseldir (tek bir
            duzlestirilmis PNG - gradyan + illustrasyon birlikte) - bu yuzden
            arkasina konan bir katman ASLA gorunmezdi (bkz. kullanici
            bildirimi, 2026-08-17: "yüklenen sunum arka planı resmi hiçbir
            zaman sunumun arka planını güncellemiyor"). Duzeltme: bu katman
            cover_bg'nin USTUNE (ama metnin/logolarin ALTINA) yari-saydam
            cizilir - boylece yuklendiginde GERCEKTEN gorunur bir degisiklik
            olur, hicbir sey yuklenmezse (varsayilan) hic render edilmeyip
            bugunku gorunum AYNEN korunur. */}
        {assets.slide_bg && (
          <div className="cov-page-bg" style={{ backgroundImage: `url(${assets.slide_bg})` }} />
        )}
        <div className="wash" />
        {!assets.slide_bg && <CornerMesh w={1.7} x={-0.15} y={5.169} opacity={0.45} />}
        <div className="clogos">
          <img className="a" src={assets.logo_a} alt="" />
          <img className="b" src={assets.logo_b} alt="" />
        </div>
        <div className="ctitle">{data.teamName}</div>
        <div className="cline" />
        <div className="csub">{data.subtitle}</div>
      </div>
    );
  } else {
    const bars = bandBars(data);
    const cardsTop = cardsTopFor(data);
    const { sections, fsByKey, columns, ekAralik } = fitContent(data, cardsTop);
    // Her sutun kendi dikey bolunmesini kullanir - sol sutundaki uzun bir kart
    // artik sag sutundaki karti daraltmaz (bkz. geometry.fitContent).
    const sol = columns.left, sag = columns.right;
    const footerTeam = (data.teamName || "Ekip").trim();
    content = (
      <>
        {/* "Sunum arka planı" (bkz. useCoverBackground.js) - PO'nun yukledigi
            gorsel SADECE kapagin degil, TUM slaytlarin zeminidir (kullanici
            bildirimi 2026-08-20: "sunum arka planı dediğim şey tüm pptx ve
            preview sayfalarına uygulanan background"). Ilk cocuk olarak,
            konumlandirilmis diger tum ogelerin (bant/kartlar/logo/altbilgi)
            ALTINDA cizilir. Yukleme yoksa hic render edilmez - bugunku duz
            zemin gorunumu aynen korunur. */}
        {assets.slide_bg && (
          <div className="slide-page-bg" style={{ backgroundImage: `url(${assets.slide_bg})` }} />
        )}
        <div className="s-header">{data.subtitle}</div>
        <div className="s-logos">
          <img src={assets.logo_b} alt="" />
          <img src={assets.logo_a} alt="" />
        </div>
        <div className="s-rule" />
        {/* Riskler kartinin (alt-sol) SOLUNDA, kartin GERCEK (icerige gore
            degisen) konum/yuksekligiyle hizali - bkz. kullanici bildirimi:
            "tam olarak yer alacağı yer riskler kartının sol tarafı" +
            "hala kayık" (sabit y kullanildiginda kart kisa/uzun oldukca
            hizasi kayiyordu). sprintDeckBuilder.addContentSlide ile AYNI
            hesap (sol.botH*0.92, dikey ortalanmis). */}
        {/* Ozel bir sunum arka plani yuklendiyse sablonun kose deseni CIZILMEZ -
            zemini tamamen yuklenen gorsel belirlesin (kullanici teyidi
            2026-08-20: "Gizlensin"). */}
        {!assets.slide_bg && (
          <CornerMesh
            w={(sol.botH * 0.92) * CORNER_MESH_RATIO}
            x={-((sol.botH * 0.92) * CORNER_MESH_RATIO) * 0.42}
            y={sol.yBot + (sol.botH - sol.botH * 0.92) / 2}
            opacity={0.55}
            flip
          />
        )}
        <Band bars={bars} />
        <Card x={G.X_L} y={cardsTop} w={G.COL_W} h={sol.topH} items={sections.done} sec={SEC.done} fontSize={fsByKey.done} extraGap={ekAralik.done} />
        <Card x={G.X_L} y={sol.yBot} w={G.COL_W} h={sol.botH} items={sections.risk} sec={SEC.risk} fontSize={fsByKey.risk} extraGap={ekAralik.risk} />
        <Card x={G.X_R} y={cardsTop} w={G.COL_W} h={sag.topH} items={sections.active} sec={SEC.active} fontSize={fsByKey.active} extraGap={ekAralik.active} />
        <Card x={G.X_R} y={sag.yBot} w={G.COL_W} h={sag.botH} items={sections.pending} sec={SEC.pending} fontSize={fsByKey.pending} extraGap={ekAralik.pending} />
        <div className="s-footer">
          Gizli &amp; Dahili Kullanım&nbsp;&nbsp;|&nbsp;&nbsp;{footerTeam}
          {hasPriorityTags(data) && <PriorityLegend />}
        </div>
      </>
    );
  }

  return (
    <div className={`slidecanvas tab-${tab}`} style={{ transform: `scale(${scale})` }}>
      {content}
    </div>
  );
}
