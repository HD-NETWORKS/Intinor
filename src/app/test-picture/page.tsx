"use client";

import { useCallback, useRef, useState } from "react";
import { useIntinorClient } from "@/hooks/useIntinorClient";
import type {
  RequestMetadata,
  TestPictureSettings,
  TestPictureSettingsResponse,
} from "@/lib/intinor/types";
import type { FieldSection } from "@/lib/settings/fields";
import { optionsFromDescribed } from "@/lib/settings/options";
import { useSettingsEditor } from "@/hooks/useSettingsEditor";
import { useUnitMeta, writeModeOf } from "@/hooks/useUnitMeta";
import { SettingsForm } from "@/components/settings/SettingsForm";

function testPictureSections(s: TestPictureSettingsResponse): FieldSection[] {
  const c = s._constraints;
  const codes = c?.layout_codes?.map((l) => l.value).filter(Boolean).join(", ");

  return [
    {
      title: "Test picture",
      description: "Shown as a fallback when a pipe's configured source is unavailable.",
      fields: [
        { path: "active", label: "Active", kind: "checkbox" },
        {
          path: "background",
          label: "Background",
          kind: "select",
          options: optionsFromDescribed(c?.background),
        },
        {
          path: "audio",
          label: "Audio",
          kind: "select",
          options: optionsFromDescribed(c?.audio),
        },
        {
          path: "animation_overlay",
          label: "Animation overlay",
          kind: "select",
          options: optionsFromDescribed(c?.animation_overlay),
        },
        {
          path: "text_overlay",
          label: "Text overlay",
          kind: "text",
          help: codes
            ? `Time-code placeholders: ${codes}. Default: "${c?.default_text_overlay ?? ""}".`
            : undefined,
        },
      ],
    },
  ];
}

/** Not part of the settings object above — a raw image PUT/GET with no JSON schema on the unit. */
function CustomBackgroundUpload() {
  const client = useIntinorClient();
  const meta = useUnitMeta();
  const writeMode = writeModeOf(meta);
  const fileInput = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const upload = useCallback(async () => {
    if (!pending) return;
    setUploading(true);
    setError(null);
    try {
      await client.putCustomBackground(pending);
      setPending(null);
      if (fileInput.current) fileInput.current.value = "";
      setRefreshKey((k) => k + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }, [client, pending]);

  const saveBlocked = writeMode === "live-readonly";

  return (
    <section className="space-y-3 rounded-lg border border-border-default bg-panel p-4">
      <div>
        <h2 className="font-medium text-body">Custom background</h2>
        <p className="text-xs text-faint">
          Uploaded via <code>PUT test_picture/custom_background</code> — a raw image, not part of
          the settings object above. Select &quot;Custom image&quot; as the background to use it.
        </p>
      </div>

      {/* Proxied API image — plain <img> is correct here. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={client.customBackgroundUrl(refreshKey || undefined)}
        alt="Current custom background"
        className="max-h-48 rounded border border-slate-700 bg-slate-950 object-contain"
      />

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={fileInput}
          type="file"
          accept="image/png,image/jpeg"
          disabled={saveBlocked}
          onChange={(e) => setPending(e.target.files?.[0] ?? null)}
          className="text-sm text-body"
        />
        <button
          onClick={() => void upload()}
          disabled={!pending || uploading || saveBlocked}
          className="rounded bg-sky-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-40"
        >
          {uploading ? "Uploading…" : "Upload"}
        </button>
        {saveBlocked && (
          <span className="text-xs text-accent">
            Live unit, read-only mode — uploads are disabled by the proxy.
          </span>
        )}
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </section>
  );
}

export default function TestPicturePage() {
  const meta = useUnitMeta();
  const client = useIntinorClient();
  const load = useCallback(() => client.getTestPictureSettings(), [client]);
  const save = useCallback(
    (body: TestPictureSettingsResponse) =>
      client.putTestPictureSettings(body as TestPictureSettings & RequestMetadata),
    [client],
  );

  const editor = useSettingsEditor<TestPictureSettingsResponse>({
    load,
    save,
    sectionsOf: testPictureSections,
    mutableOf: (s) => s._constraints?.mutable,
  });

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <SettingsForm
        title="Test picture"
        description="Unit-wide fallback source, used by any pipe whose configured video source drops."
        editor={editor}
        meta={meta}
      />
      <CustomBackgroundUpload />
    </div>
  );
}
