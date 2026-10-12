import type { RenderedPanel } from "../shared/schemas";

export interface EditablePanelItem {
  title: string;
  detail: string;
}

export function generatedPanelItems(panel: RenderedPanel): EditablePanelItem[] {
  const plan = panel.plan;
  if (plan?.framework?.steps) {
    return plan.framework.steps.map((step) => ({
      title: step.name,
      detail: step.description ?? "",
    }));
  }
  if (plan?.keyFindings?.findings) {
    return plan.keyFindings.findings.map((item) => ({
      title: item.title,
      detail: item.detail ?? item.figure ?? "",
    }));
  }
  if (plan?.timeline) {
    return plan.timeline.map((item) => ({ title: item.when, detail: item.what }));
  }
  if (plan?.comparison?.rows) {
    return plan.comparison.rows.map((row) => ({
      title: row.label,
      detail: row.cells.join(" · "),
    }));
  }
  if (plan?.beforeAfter) {
    return [
      {
        title: plan.beforeAfter.before.label,
        detail: plan.beforeAfter.before.description ?? "",
      },
      {
        title: plan.beforeAfter.after.label,
        detail: plan.beforeAfter.after.description ?? "",
      },
    ];
  }
  if (plan?.careerTimeline?.roles) {
    return plan.careerTimeline.roles.map((role) => ({
      title: `${role.title} · ${role.company}`,
      detail: [role.period, ...role.achievements].filter(Boolean).join(" · "),
    }));
  }
  if (plan?.skillsMatrix?.groups) {
    return plan.skillsMatrix.groups.map((group) => ({
      title: group.name,
      detail: group.skills
        .map((skill) =>
          skill.level ? `${skill.name} (${skill.level})` : skill.name
        )
        .join(" · "),
    }));
  }
  if (plan?.profileCard?.stats?.length) {
    return plan.profileCard.stats.map((stat) => ({
      title: stat.label,
      detail: stat.value,
    }));
  }
  if (plan?.annotatedHero?.annotations) {
    return plan.annotatedHero.annotations.map((annotation) => ({
      title: annotation.label,
      detail: annotation.sub ?? annotation.targetHint,
    }));
  }
  if (plan?.chart) {
    return plan.chart.series.flatMap((series) =>
      series.points.map((point) => ({
        title: point.label,
        detail: `${point.value}${plan.chart?.unit ?? ""}`,
      }))
    );
  }
  if (plan?.nodes?.length) {
    return plan.nodes.map((node) => ({
      title: node.label,
      detail: node.subtitle ?? "",
    }));
  }
  return [];
}

export function panelItems(panel: RenderedPanel): EditablePanelItem[] {
  return panel.copyOverrides?.items ?? generatedPanelItems(panel);
}

export function generatedPanelPrimary(panel: RenderedPanel): string {
  return (
    panel.plan?.insight?.text ??
    panel.plan?.definitionCard?.definition ??
    panel.plan?.quoteCard?.text ??
    panel.caption
  );
}

export function panelPrimary(panel: RenderedPanel): string {
  return panel.copyOverrides?.primary ?? generatedPanelPrimary(panel);
}

export function panelKicker(panel: RenderedPanel, fallback: string): string {
  return panel.copyOverrides?.kicker ?? fallback;
}
