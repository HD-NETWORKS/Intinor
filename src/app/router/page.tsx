"use client";

import { useCallback, useEffect, useState } from "react";
import { useIntinorClient } from "@/hooks/useIntinorClient";
import { IntinorApiError } from "@/lib/intinor-client";
import { useUnitMeta, writeModeOf } from "@/hooks/useUnitMeta";
import { useSourceUsage } from "@/hooks/useSourceUsage";
import { isMutable } from "@/lib/settings/mutable";
import { buildPutBody, type ConflictWarning } from "@/lib/settings/apply";
import type { SettingsChange } from "@/lib/settings/diff";
import { ConfirmChangesDialog } from "@/components/settings/ConfirmChangesDialog";
import { SourceTile, type SourceKind } from "@/components/router/SourceTile";
import { EncoderDestTile } from "@/components/router/EncoderDestTile";
import type {
  Encoder,
  EncoderSettingsRequest,
  EncoderSettingsResponse,
  VideoSourceConstraint,
} from "@/lib/intinor/types";

interface SourceRef {
  kind: SourceKind;
  index?: number;
  href: string;
  label: string;
}

function parseSourceHref(href: string): { kind: SourceKind; index?: number } | null {
  if (/test_picture/.test(href)) return { kind: "test_picture" };
  const ni = href.match(/network_inputs\/(\d+)/);
  if (ni) return { kind: "network_input", index: Number(ni[1]) };
  const vi = href.match(/video_inputs\/(\d+)/);
  if (vi) return { kind: "video_input", index: Number(vi[1]) };
  const vm = href.match(/video_mixers\/(\d+)/);
  if (vm) return { kind: "video_mixer", index: Number(vm[1]) };
  return null;
}

function describe(err: unknown, fallback: string): string {
  if (err instanceof IntinorApiError) return `${err.message} (HTTP ${err.status})`;
  if (err instanceof Error) return err.message;
  return fallback;
}

interface EncoderRouterInfo {
  index: number;
  description: string;
  source: string;
  mutable: string[] | undefined;
}

export default function RouterPage() {
  const client = useIntinorClient();
  const meta = useUnitMeta();
  const writeMode = writeModeOf(meta);
  const saveBlocked = writeMode === "live-readonly";
  const { usage, refresh: refreshUsage } = useSourceUsage();

  const [sources, setSources] = useState<SourceRef[] | null>(null);
  const [encoderInfos, setEncoderInfos] = useState<EncoderRouterInfo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState(0);

  // No setState calls in here — invoked directly from an effect body, so every
  // state update has to happen in the effect's own .then()/.catch(), never
  // synchronously inside the function being called (react-hooks/set-state-in-effect).
  const load = useCallback(async (): Promise<{
    sources: SourceRef[];
    encoderInfos: EncoderRouterInfo[];
  }> => {
    const encodersList = await client.getEncoders();
    if (encodersList.encoders.length === 0) {
      return { sources: [], encoderInfos: [] };
    }
    const settingsList = await Promise.all(
      encodersList.encoders.map((e: Encoder) => client.getEncoderSettings(e.index)),
    );
    const master: VideoSourceConstraint[] =
      settingsList.find((s: EncoderSettingsResponse) => s._constraints?.video_source?.source?.length)
        ?._constraints?.video_source?.source ?? [];

    const sourceRefs: SourceRef[] = master
      .filter((s) => typeof s.value === "string")
      .map((s) => {
        const href = s.value as string;
        const parsed = parseSourceHref(href);
        return {
          kind: parsed?.kind ?? "test_picture",
          index: parsed?.index,
          href,
          label: s.name ?? s.description ?? href,
        };
      });

    const infos: EncoderRouterInfo[] = encodersList.encoders.map((e: Encoder, i: number) => ({
      index: e.index,
      description: e.description,
      source: settingsList[i].video_source?.source ?? "",
      mutable: settingsList[i]._constraints?.mutable,
    }));

    return { sources: sourceRefs, encoderInfos: infos };
  }, [client]);

  useEffect(() => {
    let cancelled = false;
    load()
      .then(({ sources: loadedSources, encoderInfos: loadedInfos }) => {
        if (cancelled) return;
        setSources(loadedSources);
        setEncoderInfos(loadedInfos);
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) setError(describe(err, "Failed to load router panel"));
      });
    return () => {
      cancelled = true;
    };
  }, [load, reloadTick]);

  const [draggingHref, setDraggingHref] = useState<string | null>(null);

  const [pending, setPending] = useState<{
    encoderIndex: number;
    loaded: EncoderSettingsResponse;
    changes: SettingsChange[];
  } | null>(null);
  const [conflicts, setConflicts] = useState<ConflictWarning[]>([]);
  const [stage, setStage] = useState<"idle" | "confirming" | "saving" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  const labelFor = useCallback(
    (href: string) => sources?.find((s) => s.href === href)?.label ?? href,
    [sources],
  );

  const beginDrop = useCallback(
    async (encoderIndex: number, href: string) => {
      setSaveError(null);
      try {
        // Single fresh read: unlike the settings-editor pages, there's no earlier
        // "original" to detect drift against — the drop itself is the first and
        // only look at this encoder's state before proposing the change.
        const loaded = await client.getEncoderSettings(encoderIndex);
        if (!isMutable("video_source.source", loaded._constraints?.mutable)) {
          setSaveError("Video source isn't editable for your account on this encoder.");
          setStage("error");
          return;
        }
        const changes: SettingsChange[] = [
          {
            path: "video_source.source",
            label: "Video source",
            from: labelFor(loaded.video_source?.source ?? ""),
            to: labelFor(href),
            value: href,
          },
        ];
        setConflicts([]);
        setPending({ encoderIndex, loaded, changes });
        setStage("confirming");
      } catch (err) {
        setSaveError(describe(err, "Could not read the encoder before proposing a change"));
        setStage("error");
      }
    },
    [client, labelFor],
  );

  const cancel = useCallback(() => {
    setPending(null);
    setConflicts([]);
    setStage("idle");
  }, []);

  const commit = useCallback(async () => {
    if (!pending) return;
    setStage("saving");
    setSaveError(null);
    try {
      await client.putEncoderSettings(
        pending.encoderIndex,
        buildPutBody(pending.loaded, pending.changes) as EncoderSettingsRequest,
      );
      setPending(null);
      setConflicts([]);
      setStage("idle");
      setReloadTick((t) => t + 1);
      void refreshUsage();
    } catch (err) {
      setSaveError(describe(err, "Save failed"));
      setStage("error");
    }
  }, [client, pending, refreshUsage]);

  if (error) {
    return (
      <div className="mx-auto max-w-6xl rounded border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
        {error}
      </div>
    );
  }
  if (!sources || !encoderInfos) {
    return <p className="text-sm text-slate-500">Loading router panel…</p>;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-100">Router panel</h1>
        <p className="text-sm text-slate-500">
          Drag a source onto an encoder to reassign it — a visual alternative to the encoder
          settings page&apos;s source dropdown. Same underlying write (
          <code className="rounded bg-slate-800 px-1">video_source.source</code>), same
          confirm-before-save flow.
        </p>
      </div>

      {saveBlocked && (
        <div className="rounded border border-sky-500/40 bg-sky-500/10 px-3 py-2 text-xs text-sky-300">
          Live unit, read-only mode — dragging is disabled by the proxy.
        </div>
      )}

      <div>
        <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-slate-400">
          Encoders ({encoderInfos.length})
        </h2>
        {encoderInfos.length === 0 ? (
          <p className="text-sm text-slate-500">This unit has no encoders.</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {encoderInfos.map((e) => (
              <EncoderDestTile
                key={e.index}
                index={e.index}
                sourceLabel={labelFor(e.source)}
                dropDisabled={saveBlocked || !isMutable("video_source.source", e.mutable)}
                isDragActive={draggingHref != null}
                onDrop={(href) => void beginDrop(e.index, href)}
              />
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 className="mb-2 text-sm font-medium uppercase tracking-wide text-slate-400">Sources</h2>
        {sources.length === 0 ? (
          <p className="text-sm text-slate-500">No sources available.</p>
        ) : (
          <div className="flex flex-wrap gap-3">
            {sources.map((s) => (
              <SourceTile
                key={s.href}
                kind={s.kind}
                index={s.index}
                href={s.href}
                label={s.label}
                dragDisabled={saveBlocked}
                onDragStart={() => setDraggingHref(s.href)}
                onDragEnd={() => setDraggingHref(null)}
                usedBy={usage.get(s.href)?.map((e) => e.label)}
              />
            ))}
          </div>
        )}
      </div>

      {saveError && stage === "error" && (
        <p className="text-xs text-red-300">{saveError}</p>
      )}

      {(stage === "confirming" || stage === "saving") && pending && (
        <ConfirmChangesDialog
          changes={pending.changes}
          conflicts={conflicts}
          writeMode={writeMode}
          unitId={meta?.unitId ?? null}
          saving={stage === "saving"}
          onConfirm={() => void commit()}
          onCancel={cancel}
        />
      )}
    </div>
  );
}
