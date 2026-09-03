import * as XLSX from "xlsx";
import { writeFileSync } from "fs";
const satirlar=[["Ekip","Is Zekasi Ekibi"],["Başlangıç",new Date(Date.UTC(2026,5,1))],["Rapor Tarihi",new Date(Date.UTC(2026,7,10))],[],
  ["Gösterge","","Muge","Emrah"],["Toplam Planlanan Efor","",168,148],["Tamamlanan Efor","",47,32],["Kalan İş Günü","",94,94]];
const ws=XLSX.utils.aoa_to_sheet(satirlar);const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,"Rapor");
writeFileSync("/app/kaptest.b64", Buffer.from(XLSX.write(wb,{type:"array",bookType:"xlsx"})).toString("base64"));
console.log("uretildi");
