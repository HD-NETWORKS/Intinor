import { DangerZone } from "@/components/system/DangerZone";

export default function SystemPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-100">System maintenance</h1>
        <p className="text-sm text-slate-500">
          Unit health lives on the overview page. This page is only whole-unit maintenance
          actions — kept on its own screen, away from every routine control, on purpose.
        </p>
      </div>

      <DangerZone />
    </div>
  );
}
