import { DangerZone } from "@/components/system/DangerZone";
import { FirmwarePanel } from "@/components/system/FirmwarePanel";
import { BackupPanel } from "@/components/system/BackupPanel";

export default function SystemPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-fg">System maintenance</h1>
        <p className="text-sm text-faint">
          Unit health lives on the overview page. This page is whole-unit maintenance —
          firmware, backups, and destructive actions — kept on its own screen, away from every
          routine control, on purpose.
        </p>
      </div>

      <FirmwarePanel />
      <BackupPanel />
      <DangerZone />
    </div>
  );
}
