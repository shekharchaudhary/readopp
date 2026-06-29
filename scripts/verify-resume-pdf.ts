import { writeFile } from "node:fs/promises";
import { getBrowser } from "../lib/playwright";
import {
  RESUME_PAGE_TEMPLATES,
  renderResumePage,
} from "../lib/render/resumePage";
import type { ResumeDoc } from "../lib/shared/schemas";

const doc: ResumeDoc = {
  contact: {
    name: "Shekhar Chaudhary",
    headline: "Software Engineer",
    email: "sk582489@gmail.com",
    phone: "+1 555 0100",
    location: "San Francisco, CA",
    links: [{ label: "github.com/shekharR", url: "https://github.com/shekharR" }],
  },
  summary:
    "Full-stack engineer with a focus on building reliable data pipelines and clean product UIs.",
  experience: [
    {
      title: "Senior Engineer",
      company: "Acme Corp",
      location: "Remote",
      period: "2023 – Present",
      bullets: [
        "Led the migration of the rendering pipeline to a streaming architecture.",
        "Cut p95 render latency by 40% through caching and batching.",
      ],
    },
    {
      title: "Engineer",
      company: "Beta Labs",
      period: "2021 – 2023",
      bullets: ["Shipped the v1 export system used by 10k+ users."],
    },
  ],
  education: [
    {
      degree: "B.S. Computer Science",
      institution: "State University",
      period: "2017 – 2021",
    },
  ],
  skills: [
    {
      name: "Languages",
      skills: [
        { name: "TypeScript", level: "expert" },
        { name: "Python", level: "strong" },
        { name: "Go", level: "familiar" },
      ],
    },
    {
      name: "Infra",
      skills: [{ name: "Postgres" }, { name: "Playwright" }, { name: "Vercel" }],
    },
  ],
  certifications: [{ name: "AWS Certified Developer", issuer: "Amazon", year: "2022" }],
  languages: [{ name: "English", level: "Native" }],
  projects: [
    { name: "Readopp", description: "Turns articles into visual carousels." },
  ],
  awards: [],
};

async function main() {
  const browser = await getBrowser();
  for (const t of RESUME_PAGE_TEMPLATES) {
    const html = renderResumePage(doc, t.id);
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.setContent(html, { waitUntil: "load" });
    const pdf = Buffer.from(
      await page.pdf({ format: "Letter", printBackground: true, preferCSSPageSize: true })
    );
    await writeFile(`/tmp/resume-${t.id}.pdf`, pdf);
    // eslint-disable-next-line no-console
    console.log(`${t.id}: ${(pdf.length / 1024).toFixed(0)}KB → /tmp/resume-${t.id}.pdf`);
    await page.close();
    await ctx.close();
  }
  await browser.close();
}

main().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});
