import { logoPositions } from "./geometry";

// Onizlemedeki .theme-dark .slidecanvas.tab-velocity ile birebir ayni degerler.
const VELO_PALETTE = {
  light: { PAGE_BG: "FFFFFF", CARD_BG: "FFFFFF", HEADER: "164E63", CARD_LINE: "E5E7EB", LABEL: "164E63", MUT: "6B7280" },
  dark: { PAGE_BG: "131C27", CARD_BG: "1C2733", HEADER: "4A9FE0", CARD_LINE: "3A4756", LABEL: "4A9FE0", MUT: "9CB0C6" },
};

// Onizlemedeki (app.css .velo-box-*) piksel konumlarinin AYNISI, 96px/inch'e
// bolunerek inc'e cevrilmis - iki tuval (canli onizleme / PPTX) birebir ayni
// yerlesimi kullanir.
const BOX_X = 38 / 96, BOX_W = 1204 / 96;
const TOP_Y = 112 / 96, BOTTOM_Y = 396 / 96, BOX_H = 270 / 96;
const PAD_TOP = 38 / 96, PAD_SIDE = 20 / 96, PAD_BOTTOM = 16 / 96;

/**
 * Bir gorsel kutusunu (Burndown veya Velocity) cizer - "orantı motoru":
 * pptxgenjs'in yerlesik `sizing:{type:"contain"}` ozelligi, verilen ic
 * dikdortgene gorselin GERCEK piksel en-boy oranini bozmadan sigdirir
 * (harici bir kutuphaneye gerek yok). Gorsel yoksa sadece kart + etiket +
 * "yüklenmedi" notu cizilir - onizlemedeki .velo-box-empty ile AYNI durum.
 *
 * DIKKAT: pptxgenjs'in "contain" hesaplamasi, addImage'a KENDI w/h'i olarak
 * verilen deger ile sizing.w/h (hedef kutu) oranini KARSILASTIRIR - eger
 * addImage'in kendi w/h'i de hedef kutuyla AYNI verilirse (kolay yanlisin
 * budur) oranlar hep esit cikar ve "contain" sessizce duz "stretch"e
 * (gercek en-boy oranini yok sayip kutuyu tamamen doldurma) doner - HICBIR
 * hata vermez, sadece yanlis sonuc uretir (dogrulandi: uretilen dosyanin
 * srcRect degerleri hep 0 cikiyordu). Bu yuzden buraya gorselin GERCEK
 * piksel boyutu (naturalWidth/naturalHeight - bkz. useUploadedImage.js)
 * ayrica gecirilir ve addImage'in KENDI w/h'i icin kullanilir; nihai
 * gorunen boyut/konum yine de sizing.w/h (hedef kutu) tarafindan belirlenir.
 */
/**
 * PO'nun "Yatay genişlet"/"Dikey genişlet" kaydırıcılarıyla sectigi (bkz.
 * VelocityBurndownPage.jsx / useUploadedImage.js) BAGIMSIZ eksen zoom'larini
 * PPTX'e tasir. Onizlemedeki (.velo-box-imgwrap + .velo-box-img{transform:
 * scaleX/scaleY}) AYNI geometri: gorsel once kutuya "contain" sigdirilir,
 * sonra merkezden `zoomX`/`zoomY` kadar (eksenler BAGIMSIZ) buyutulup kutu
 * disina tasan kismi kirpilir - burada bunu bir canvas'a birebir cizerek
 * (drawImage'in kendi tuval sinirlarinin disina tasan pikselleri OTOMATIK
 * kirpmasindan yararlanarak) taklit ediyoruz, pptxgenjs'in sizing:contain'i
 * boyle bir kismi kirpma ozelligini desteklemedigi icin. zoomX<=1 VE zoomY<=1
 * (varsayilan, hicbir sey degistirilmemis) ise dokunulmaz - orijinal gorsel
 * oldugu gibi kullanilir (gereksiz yeniden kodlama/kalite kaybi olmaz).
 */
function cropToZoom(imageUrl, natW, natH, boxAspect, zoomX, zoomY, bgColor) {
  return new Promise((resolve) => {
    const zx = zoomX || 1, zy = zoomY || 1;
    if (!imageUrl || !natW || !natH || (zx <= 1.001 && zy <= 1.001)) {
      resolve({ url: imageUrl, width: natW, height: natH });
      return;
    }
    const img = new Image();
    img.onload = () => {
      const targetW = 1600;
      const targetH = Math.round(targetW / boxAspect);
      const canvas = document.createElement("canvas");
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#" + (bgColor || "FFFFFF");
      ctx.fillRect(0, 0, targetW, targetH);
      const c = Math.min(targetW / natW, targetH / natH);
      const dispW = natW * c * zx;
      const dispH = natH * c * zy;
      ctx.drawImage(img, (targetW - dispW) / 2, (targetH - dispH) / 2, dispW, dispH);
      resolve({ url: canvas.toDataURL("image/png"), width: targetW, height: targetH });
    };
    img.onerror = () => resolve({ url: imageUrl, width: natW, height: natH });
    img.src = imageUrl;
  });
}

async function drawImageBox(pptx, s, y, label, imageUrl, naturalW, naturalH, zoomX, zoomY, P) {
  s.addShape(pptx.ShapeType.roundRect, {
    x: BOX_X, y, w: BOX_W, h: BOX_H, rectRadius: 0.06,
    fill: { color: P.CARD_BG }, line: { color: P.CARD_LINE, width: 1 },
    shadow: { type: "outer", color: "9CA3AF", blur: 6, offset: 2, angle: 90, opacity: 0.28 },
  });
  s.addText(label.toUpperCase(), {
    x: BOX_X + PAD_SIDE, y: y + 0.06, w: BOX_W - PAD_SIDE * 2, h: 0.26,
    fontFace: "Calibri", fontSize: 10, bold: true, color: P.LABEL, margin: 0, charSpacing: 0.5,
  });
  const innerX = BOX_X + PAD_SIDE, innerY = y + PAD_TOP;
  const innerW = BOX_W - PAD_SIDE * 2, innerH = BOX_H - PAD_TOP - PAD_BOTTOM;
  if (imageUrl) {
    // zoom>1 ise ONCE (onizlemedeki AYNI geometriyle) kirpilmis bir kopya
    // uretilir - bkz. cropToZoom yukarida. zoom<=1 ise cropped===orijinal,
    // asagidaki kod yolu (naturalW/H ile "contain") DEGISMEDEN calisir.
    const cropped = await cropToZoom(imageUrl, naturalW, naturalH, innerW / innerH, zoomX, zoomY, P.CARD_BG);
    // addImage'in KENDI w/h'i = gorselin GERCEK en-boy oranini tasiyan
    // deger (piksel/96 ile "inc" olcegine getirilir, mutlak buyuklugun
    // onemi yok - sizing asagida bunu ZATEN hedef kutuya yeniden olcekler,
    // sadece ORAN dogru olsun yeter). Boyut bilinmiyorsa (nadiren - orn.
    // gorsel bozuksa) kutuyla ayni birebir orana duser, yani eski (yanlis
    // ama en azindan tasmayan) "stretch" davranisina guvenli sekilde geri
    // dusulur.
    const ownW = cropped.width ? cropped.width / 96 : innerW;
    const ownH = cropped.height ? cropped.height / 96 : innerH;
    s.addImage({ data: cropped.url, x: innerX, y: innerY, w: ownW, h: ownH, sizing: { type: "contain", w: innerW, h: innerH } });
  } else {
    s.addText(`${label} görseli yüklenmedi`, {
      x: innerX, y: innerY, w: innerW, h: innerH,
      fontFace: "Calibri", fontSize: 12, italic: true, color: P.MUT, align: "center", valign: "middle", margin: 0,
    });
  }
}

/**
 * "Velocity & Burndown Parametreleri" (sihirbazin 4. adimi) slaydini ekler -
 * BURNDOWN USTTE, VELOCITY ALTTA (PO'nun paylastigi ornek ekran goruntusundeki
 * sirayla AYNI, kullanici teyidi 2026-08-20). Ust bilgi/logo/serit/alt bilgi
 * diger slaytlarla (bkz. sprintDeckBuilder.addContentSlide) BIREBIR AYNI
 * konumlandirmayi kullanir. Ikisi de yuklenmemisse slayt yine de eklenir -
 * bos "yüklenmedi" kartlariyla - cagiran taraf (fullDeckBuilder) bu yuzden
 * kosullu bir kontrole GEREK DUYMAZ.
 */
export async function addVelocityBurndownSlide(pptx, data, veloData, assets, theme = "light") {
  const v = veloData || {};
  const P = VELO_PALETTE[theme] || VELO_PALETTE.light;
  const TEAL = "164E63", ORANGE = "E67514";

  const s = pptx.addSlide();
  s.background = { color: P.PAGE_BG };
  if (assets.slide_bg) s.addImage({ data: assets.slide_bg, x: 0, y: 0, w: 13.333, h: 7.5 });

  s.addText(data.subtitle, { x: 0.4, y: 0.24, w: 9.8, h: 0.6, fontFace: "Calibri", fontSize: 25, bold: true, color: P.HEADER, margin: 0, valign: "middle" });
  const logos = logoPositions({ rightEdge: 13.195, top: 0.147, height: 0.357, gap: 0.084 });
  s.addImage({ data: assets.logo_b, ...logos.b });
  s.addImage({ data: assets.logo_a, ...logos.a });
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 1.0, w: 3.4, h: 0.05, fill: { color: TEAL } });
  s.addShape(pptx.ShapeType.rect, { x: 3.4, y: 1.0, w: 13.333 - 3.4, h: 0.05, fill: { color: ORANGE } });

  await drawImageBox(pptx, s, TOP_Y, "Burndown Graph", v.burndownUrl, v.burndownWidth, v.burndownHeight, v.burndownZoomX, v.burndownZoomY, P);
  await drawImageBox(pptx, s, BOTTOM_Y, "Velocity Chart", v.velocityUrl, v.velocityWidth, v.velocityHeight, v.velocityZoomX, v.velocityZoomY, P);

  const footerTeam = (data.teamName || "Ekip").trim();
  s.addShape(pptx.ShapeType.rect, { x: 0, y: 7.14, w: 13.333, h: 0.36, fill: { color: TEAL } });
  s.addText(`Gizli & Dahili Kullanım   |   ${footerTeam}`, { x: 0.4, y: 7.14, w: 7, h: 0.36, fontFace: "Calibri", fontSize: 10, color: "D6E4EA", margin: 0, valign: "middle" });
  return s;
}

/**
 * Bu takim icin Velocity & Burndown slaydi uretilmeli mi? PO en az bir gorsel
 * yuklediyse evet. Ikisi de yoksa slayt HIC eklenmez - burndown/velocity
 * kullanmayan ekiplerin (orn. Mobil Uygulamalar) ciktisinda bos bir
 * "yüklenmedi" sayfasi kaliyordu (kullanici karari 2026-09-07: "eklenmeyen
 * ekipler icin bos sayfayi kaldiralim"). Tekil (fullDeckBuilder) ve ortak
 * (jointDeckBuilder) sunum AYNI kurali kullanir.
 */
export function hasVelocityContent(veloData) {
  const v = veloData || {};
  const dolu = (u) => typeof u === "string" && u.trim() !== "";
  return dolu(v.burndownUrl) || dolu(v.velocityUrl);
}
