"use client";

/**
 * MappingProfileSelector — load/save column mapping profiles.
 *
 * Features:
 *   - Dropdown to select existing profiles
 *   - Auto-match: fingerprint → find matching profile
 *   - Save current mapping as new profile
 */
import React, { useState } from "react";
import { trpc } from "@/lib/trpc/client";

interface MappingProfile {
  id: string;
  name: string;
  fileFingerprint: string | null;
  mapping: unknown;
}

interface MappingProfileSelectorProps {
  fingerprint: string | null;
  onProfileLoad: (mapping: Array<{ sourceCol: string; targetField: string }>) => void;
  currentMapping: Array<{ sourceCol: string; targetField: string }>;
}

export function MappingProfileSelector({
  fingerprint,
  onProfileLoad,
  currentMapping,
}: MappingProfileSelectorProps) {
  const [profileName, setProfileName] = useState("");
  const [showSave, setShowSave] = useState(false);

  // Fetch available profiles
  const profilesQuery = trpc.import.getProfiles.useQuery();

  // Auto-match by fingerprint
  const matchQuery = trpc.import.matchProfile.useQuery(
    { fingerprint: fingerprint ?? "" },
    { enabled: !!fingerprint }
  );

  // Save mutation
  const saveMutation = trpc.import.saveProfile.useMutation({
    onSuccess: () => {
      setShowSave(false);
      setProfileName("");
      profilesQuery.refetch();
    },
  });

  const handleSave = () => {
    if (!profileName.trim() || !fingerprint) return;
    saveMutation.mutate({
      name: profileName.trim(),
      fingerprint,
      mapping: currentMapping,
    });
  };

  const handleLoadProfile = (profile: MappingProfile) => {
    const mapping = profile.mapping as Array<{
      sourceCol: string;
      targetField: string;
    }>;
    if (Array.isArray(mapping)) {
      onProfileLoad(mapping);
    }
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        flexWrap: "wrap",
        fontSize: "14px",
      }}
    >
      {/* Auto-match notification */}
      {matchQuery.data && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 12px",
            borderRadius: "8px",
            backgroundColor: "rgba(34, 197, 94, 0.1)",
            border: "1px solid rgba(34, 197, 94, 0.3)",
          }}
        >
          <span>✅</span>
          <span>
            Eşleşen profil: <strong>{matchQuery.data.name}</strong>
          </span>
          <button
            onClick={() => handleLoadProfile(matchQuery.data!)}
            style={{
              padding: "4px 12px",
              borderRadius: "6px",
              border: "1px solid rgba(34, 197, 94, 0.5)",
              background: "rgba(34, 197, 94, 0.15)",
              cursor: "pointer",
              fontSize: "13px",
              color: "inherit",
            }}
          >
            Uygula
          </button>
        </div>
      )}

      {/* Profile dropdown */}
      {profilesQuery.data && profilesQuery.data.length > 0 && (
        <select
          onChange={(e) => {
            const profile = profilesQuery.data?.find(
              (p) => p.id === e.target.value
            );
            if (profile) handleLoadProfile(profile as unknown as MappingProfile);
          }}
          defaultValue=""
          style={{
            padding: "8px 12px",
            borderRadius: "8px",
            border: "1px solid var(--border, #3f3f46)",
            backgroundColor: "var(--bg-secondary, #27272a)",
            color: "inherit",
            fontSize: "14px",
          }}
        >
          <option value="" disabled>
            Profil Seçin...
          </option>
          {profilesQuery.data.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      )}

      {/* Save button */}
      {!showSave ? (
        <button
          onClick={() => setShowSave(true)}
          style={{
            padding: "8px 16px",
            borderRadius: "8px",
            border: "1px solid var(--border, #3f3f46)",
            background: "transparent",
            cursor: "pointer",
            fontSize: "13px",
            color: "inherit",
            opacity: 0.8,
          }}
        >
          💾 Profil Kaydet
        </button>
      ) : (
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <input
            type="text"
            value={profileName}
            onChange={(e) => setProfileName(e.target.value)}
            placeholder="Profil adı..."
            style={{
              padding: "8px 12px",
              borderRadius: "8px",
              border: "1px solid var(--border, #3f3f46)",
              backgroundColor: "var(--bg-secondary, #27272a)",
              color: "inherit",
              fontSize: "14px",
              width: "200px",
            }}
          />
          <button
            onClick={handleSave}
            disabled={!profileName.trim() || saveMutation.isPending}
            style={{
              padding: "8px 16px",
              borderRadius: "8px",
              border: "none",
              background: "var(--accent, #6366f1)",
              color: "white",
              cursor: "pointer",
              fontSize: "13px",
              opacity: profileName.trim() ? 1 : 0.5,
            }}
          >
            {saveMutation.isPending ? "Kaydediliyor..." : "Kaydet"}
          </button>
          <button
            onClick={() => setShowSave(false)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "inherit",
              opacity: 0.6,
            }}
          >
            ✕
          </button>
        </div>
      )}
    </div>
  );
}
