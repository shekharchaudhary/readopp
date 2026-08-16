import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const root = join(process.cwd(), "tmp", "template-lab");
const templates = ["tachyon","aurora-glass","bento-grid","swiss-poster","editorial-broadsheet","magazine-cover","new-yorker-frame","terminal-brutalist","engineering-spec","notebook-cell","receipt","index-card","boarding-pass","highlighter-reader","sticky-notes","kindle-highlight","editorial-brutalist","tabloid-splash","risograph-zine","galaxy-brain"];
const formats = { square:[1080,1080], vertical:[1080,1920], landscape:[1200,627] };
mkdirSync(root,{recursive:true});
const browser=await chromium.launch({headless:true});
const results=[];
try {
  for(const template of templates){
    const dir=join(root,template);mkdirSync(dir,{recursive:true});
    for(const [format,[width,height]] of Object.entries(formats)){
      const page=await browser.newPage({viewport:{width,height}});
      try{
        const response=await page.goto(`http://127.0.0.1:3000/api/template-lab/${template}/${format}`,{waitUntil:"load",timeout:30000});
        if(!response?.ok()) throw new Error(`HTTP ${response?.status()}`);
        const png=`${template}/${format}.png`;
        await page.screenshot({path:join(root,png)});
        const overflow=await page.evaluate(()=>({x:Math.max(0,document.documentElement.scrollWidth-innerWidth),y:Math.max(0,document.documentElement.scrollHeight-innerHeight)}));
        results.push({template,format,png,...overflow});
      }catch(error){results.push({template,format,error:error.message});}
      await page.close();
    }
    console.log(`rendered ${template}`);
  }
}finally{await browser.close()}
writeFileSync(join(root,"report.json"),JSON.stringify(results,null,2));
const cards=results.map(r=>`<article><div>${r.png?`<img src="${r.png}">`:`<p>${r.error}</p>`}</div><b>${r.template}</b><span>${r.format}${r.x||r.y?` · overflow ${r.x}×${r.y}`:""}</span></article>`).join("");
writeFileSync(join(root,"index.html"),`<!doctype html><style>*{box-sizing:border-box}body{margin:0;padding:32px;background:#0b1020;color:#fff;font:14px system-ui}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:28px}article div{height:320px;background:#182036;border-radius:14px;overflow:hidden}img{width:100%;height:100%;object-fit:contain}b,span{display:block;margin-top:8px}span{margin-top:3px;color:#94a3b8;font:10px monospace;text-transform:uppercase}</style><h1>Readopp template audit</h1><p>${results.length} controlled renders</p><main class="grid">${cards}</main>`);
console.log(`${results.length} renders · ${results.filter(r=>r.error).length} errors · ${results.filter(r=>r.x||r.y).length} overflow warnings`);
