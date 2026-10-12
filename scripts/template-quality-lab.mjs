import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "playwright";

const root = join(process.cwd(), "tmp", "template-lab");
const allTemplates = ["tachyon","aurora-glass","bento-grid","swiss-poster","adaptive-editorial","editorial-report","modern-technical","data-story","bold-social","editorial-broadsheet","magazine-cover","new-yorker-frame","terminal-brutalist","engineering-spec","notebook-cell","receipt","index-card","boarding-pass","highlighter-reader","sticky-notes","kindle-highlight","editorial-brutalist","tabloid-splash","risograph-zine","galaxy-brain"];
const allFormats = { square:[1080,1080], vertical:[1080,1920], landscape:[1200,627] };
const templates = process.env.READOPP_LAB_TEMPLATES
  ? process.env.READOPP_LAB_TEMPLATES.split(",").filter(Boolean)
  : allTemplates;
const formats = process.env.READOPP_LAB_FORMATS
  ? Object.fromEntries(process.env.READOPP_LAB_FORMATS.split(",").filter((format) => allFormats[format]).map((format) => [format, allFormats[format]]))
  : allFormats;
const adaptiveTemplates = new Set(["adaptive-editorial","editorial-report","modern-technical","data-story","bold-social"]);
const adaptiveCases = [
  ["cover", "quote"],
  ["priorities", "framework"],
  ["hierarchy", "framework"],
  ["radial", "radial"],
  ["architecture", "architecture"],
  ["chart", "chart"],
  ["diverging", "diverging"],
  ["report", "framework"],
  ["contents", "framework"],
  ["essay", "quote"],
];
const selectedLayouts = process.env.READOPP_LAB_LAYOUTS
  ? new Set(process.env.READOPP_LAB_LAYOUTS.split(",").filter(Boolean))
  : null;
const densities = process.env.READOPP_LAB_DENSITIES
  ? process.env.READOPP_LAB_DENSITIES.split(",").filter(Boolean)
  : ["balanced"];
mkdirSync(root,{recursive:true});
const browser=await chromium.launch({headless:true});
const results=[];
try {
  for(const template of templates){
    const dir=join(root,template);mkdirSync(dir,{recursive:true});
    const cases = adaptiveTemplates.has(template)
      ? adaptiveCases.filter(([layout]) => !selectedLayouts || selectedLayouts.has(layout))
      : [[null, null]];
    for(const [format,[width,height]] of Object.entries(formats)){
      for(const density of densities){
      for(const [layout,mode] of cases){
      const page=await browser.newPage({viewport:{width,height}});
      try{
        const query = layout ? `?layout=${layout}&mode=${mode}&density=${density}` : `?density=${density}`;
        const response=await page.goto(`http://127.0.0.1:3000/api/template-lab/${template}/${format}${query}`,{waitUntil:"load",timeout:30000});
        if(!response?.ok()) throw new Error(`HTTP ${response?.status()}`);
        const densitySuffix=density==="balanced"?"":`-${density}`;
        const png=`${template}/${format}${layout?`-${layout}`:""}${densitySuffix}.png`;
        await page.screenshot({path:join(root,png)});
        const overflow=await page.evaluate(()=>{
          const layout=document.querySelector(".layout");
          const bounds=layout?.getBoundingClientRect();
          const internalOverflow=bounds?[...layout.querySelectorAll("*")].filter((element)=>{
            if(element.tagName==="I") return false;
            const rect=element.getBoundingClientRect();
            if(rect.width===0&&rect.height===0) return false;
            return rect.left<bounds.left-1||rect.right>bounds.right+1||rect.top<bounds.top-1||rect.bottom>bounds.bottom+1;
          }).slice(0,8).map((element)=>element.className||element.tagName):[];
          return {x:Math.max(0,document.documentElement.scrollWidth-innerWidth),y:Math.max(0,document.documentElement.scrollHeight-innerHeight),internalOverflow};
        });
        results.push({template,format,layout,density,png,...overflow});
      }catch(error){results.push({template,format,layout,error:error.message});}
      await page.close();
      }
      }
    }
    console.log(`rendered ${template}`);
  }
}finally{await browser.close()}
writeFileSync(join(root,"report.json"),JSON.stringify(results,null,2));
const cards=results.map(r=>`<article><div>${r.png?`<img src="${r.png}">`:`<p>${r.error}</p>`}</div><b>${r.template}</b><span>${r.format}${r.layout?` · ${r.layout}`:""}${r.density&&r.density!=="balanced"?` · ${r.density}`:""}${r.x||r.y?` · overflow ${r.x}×${r.y}`:""}${r.internalOverflow?.length?` · internal ${r.internalOverflow.length}`:""}</span></article>`).join("");
writeFileSync(join(root,"index.html"),`<!doctype html><style>*{box-sizing:border-box}body{margin:0;padding:32px;background:#0b1020;color:#fff;font:14px system-ui}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:28px}article div{height:320px;background:#182036;border-radius:14px;overflow:hidden}img{width:100%;height:100%;object-fit:contain}b,span{display:block;margin-top:8px}span{margin-top:3px;color:#94a3b8;font:10px monospace;text-transform:uppercase}</style><h1>Readopp template audit</h1><p>${results.length} controlled renders</p><main class="grid">${cards}</main>`);
console.log(`${results.length} renders · ${results.filter(r=>r.error).length} errors · ${results.filter(r=>r.x||r.y).length} viewport overflow warnings · ${results.filter(r=>r.internalOverflow?.length).length} internal overflow warnings`);
