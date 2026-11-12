import html2canvas from 'html2canvas';
import { jsPDF } from 'jspdf';

/** Exports the same isolated HTML document that is used for printing. */
export async function exportReceipt(source: HTMLElement, ticket: boolean, printWindow?: Window): Promise<Blob | undefined> {
  const host=document.createElement('section');
  host.className='receipt export-document';
  host.style.cssText='position:absolute;left:-12000px;top:0;box-sizing:border-box;margin:0;border:0;border-radius:0;box-shadow:none;background:#fff;color:#171717;width:'+(ticket?'80mm':'210mm')+';padding:'+(ticket?'4mm':'12mm')+';font-size:'+(ticket?'13px':'13px')+';';
  const content=source.cloneNode(true) as HTMLElement;
  content.style.display='block'; host.appendChild(content);document.body.appendChild(host);
  try {
    await document.fonts.ready;
    await Promise.all(Array.from(host.querySelectorAll('img')).map(img=>img.complete?Promise.resolve():new Promise<void>((resolve,reject)=>{img.onload=()=>resolve();img.onerror=()=>reject(new Error('No se pudo cargar el logo'));})));
    if (printWindow) {
      const styles=Array.from(document.querySelectorAll('link[rel="stylesheet"],style')).map(node=>node.outerHTML).join('');
      const doc=printWindow.document;
      doc.open();doc.write('<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Imprimir comprobante</title>'+styles+'<style>@page{size:'+(ticket?'80mm auto':'A4')+';margin:0}body{margin:0;background:#fff}.export-document{position:static!important;left:0!important;top:0!important}.receipt tr{break-inside:avoid}.receipt thead{display:table-header-group}</style></head><body></body></html>');doc.close();
      const printable=host.cloneNode(true) as HTMLElement;doc.body.appendChild(doc.importNode(printable,true));
      await Promise.all(Array.from(doc.querySelectorAll('link[rel="stylesheet"]')).map(link=>(link as HTMLLinkElement).sheet?Promise.resolve():new Promise<void>(resolve=>{link.addEventListener('load',()=>resolve(),{once:true});link.addEventListener('error',()=>resolve(),{once:true});})));
      await Promise.all(Array.from(doc.images).map(img=>img.complete?Promise.resolve():new Promise<void>(resolve=>{img.onload=()=>resolve();img.onerror=()=>resolve();})));
      await doc.fonts.ready;printWindow.focus();printWindow.print();return;
    }
    const bounds=host.getBoundingClientRect();
    const canvas=await html2canvas(host,{scale:2,backgroundColor:'#fff',useCORS:false,logging:false,windowWidth:1200});
    const width=ticket?80:210;
    const pdf=new jsPDF({unit:'mm',format:ticket?[80,Math.max(90,canvas.height*80/canvas.width)]: 'a4',compress:true});
    if(ticket){pdf.addImage(canvas,'PNG',0,0,width,canvas.height*width/canvas.width);}
    else {
      const scale=canvas.width/bounds.width;
      const breaks=Array.from(host.querySelectorAll('tr,p,.receipt-head,.receipt-legend')).map(node=>Math.round((node.getBoundingClientRect().bottom-bounds.top)*scale)).sort((a,b)=>a-b);
      let offset=0,page=0;
      while(offset<canvas.height){
        const top=page?12:0;
        const capacity=Math.floor((297-top-12)*canvas.width/210);
        const limit=Math.min(canvas.height,offset+capacity);
        const safe=breaks.filter(y=>y>offset+30&&y<=limit);
        const end=limit===canvas.height?limit:(safe.length?safe[safe.length-1]:limit);
        const slice=document.createElement('canvas');slice.width=canvas.width;slice.height=end-offset;
        const context=slice.getContext('2d');if(!context)throw new Error('Canvas no disponible');
        context.drawImage(canvas,0,offset,canvas.width,end-offset,0,0,canvas.width,end-offset);
        if(page)pdf.addPage();pdf.addImage(slice,'PNG',0,top,width,slice.height*width/slice.width);
        offset=end;page++;
      }
    }
    return pdf.output('blob');
  } finally { host.remove(); }
}
