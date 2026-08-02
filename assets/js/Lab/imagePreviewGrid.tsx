import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pencil, X } from "lucide-react";

type FileWithPath = File & { webkitRelativePath?: string };

type PreviewFile = {
  uid: string;
  blobURL: string;
  file: FileWithPath;
  label: string;
  groupKey: string;
  serverKey?: string;
};

type GroupedItem = PreviewFile & { idx: number; id: string };
type GroupedMap = Record<string, GroupedItem[]>;

type ImagePreviewGroupedDnDProps = {
  files: PreviewFile[];
  title?: string;
  /** Lab page only: mono eyebrow + secondary control styling. Whole-brain leaves default. */
  variant?: "default" | "lab";
  /** Lab variant eyebrow override (e.g. "Uploaded stimuli"). Falls back to title. */
  eyebrow?: string;
  groupDepth?: number;
  maxThumbsPerGroup?: number;
  showPathDebug?: boolean;
  foldable?: boolean;
  viewOnly?: boolean;
  isPreload?: boolean;
  allowPreloadEditing?: boolean;
  tutorialCustomGroups?: string[] | null;
  tutorialStateKey?: string | null;
  panelCollapsed?: boolean;
  onPanelCollapsedChange?: (collapsed: boolean) => void;
  tutorialCollapseToggleKey?: string | null;

  onRemove?: (uid: string) => void;
  onClear?: () => void;
  onClearGroup?: (groupKey: string, uidsToRemove: string[]) => void;
  onGroupOrderChange?: (order: string[]) => void;
  onRenameGroup?: (groupKey: string, newDisplayName: string) => void;
  onMoveItemToGroup?: (uid: string, toGroupKey: string) => void;
  onRenameGroupKey?: (oldKey: string, newKey: string) => void;
};

export default function ImagePreviewGroupedDnD({
  files = [],
  title = "Uploaded Images",
  variant = "default",
  eyebrow,
  onRemove,
  onClear,
  onClearGroup,
  onGroupOrderChange,
  onRenameGroup,
  onMoveItemToGroup,
  onRenameGroupKey,
  groupDepth = 1,
  maxThumbsPerGroup = 100,
  showPathDebug = false,
  foldable = false,
  viewOnly = false,
  isPreload = false,
  allowPreloadEditing = false,
  tutorialCustomGroups = null,
  tutorialStateKey = null,
  panelCollapsed,
  onPanelCollapsedChange,
  tutorialCollapseToggleKey = null,
}: ImagePreviewGroupedDnDProps) {
  const isLab = variant === "lab";
  const getTutorialGroupOrder = (keys: string[]) =>
    [...keys].sort((left, right) => {
      if (left === "Tutorial Group") return 1;
      if (right === "Tutorial Group") return -1;
      return left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" });
    });

  const getGroupKey = (file?: FileWithPath) => {
    const rel = file?.webkitRelativePath ?? "";
    if (!rel) return "Ungrouped";

    const parts = rel.split("/").filter(Boolean);
    if (parts.length <= groupDepth + 1) return parts[0] || "Ungrouped";
    return parts[groupDepth] || parts[0] || "Ungrouped";
  };

  const [itemGroupMap, setItemGroupMap] = useState<Record<string, string>>({});
  const [dragItem, setDragItem] = useState<{ uid: string; fromKey: string } | null>(null);


  const [internalPanelCollapsed, setInternalPanelCollapsed] = useState<boolean>(foldable);
  const panelContentRef = useRef<HTMLDivElement | null>(null);
  const panelAnimationsRef = useRef<Animation[]>([]);
  const isPanelCollapseControlled = typeof panelCollapsed === "boolean";
  const isPanelCollapsed = isPanelCollapseControlled ? panelCollapsed : internalPanelCollapsed;


  useEffect(() => {
    if (!isPanelCollapseControlled) {
      setInternalPanelCollapsed(foldable);
    }
  }, [foldable, isPanelCollapseControlled]);

  useEffect(() => {
    panelAnimationsRef.current.forEach((animation) => {
      try {
        animation.cancel();
      } catch {
        // Ignore animations that are already finished.
      }
    });
    panelAnimationsRef.current = [];

    if (isPanelCollapsed || !panelContentRef.current) {
      return;
    }

    const animation = panelContentRef.current.animate(
      [
        {
          opacity: 0.18,
          transform: "translateY(-12px) scale(0.985)",
          filter: "blur(2px)",
        },
        {
          opacity: 1,
          transform: "translateY(0) scale(1)",
          filter: "blur(0px)",
        },
      ],
      {
        duration: 460,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
      }
    );

    panelAnimationsRef.current.push(animation);

    return () => {
      try {
        animation.cancel();
      } catch {
        // Ignore animations that are already finished.
      }
      panelAnimationsRef.current = panelAnimationsRef.current.filter((entry) => entry !== animation);
    };
  }, [isPanelCollapsed]);

  useEffect(() => {
    return () => {
      panelAnimationsRef.current.forEach((animation) => {
        try {
          animation.cancel();
        } catch {
          // Ignore animations that are already finished.
        }
      });
      panelAnimationsRef.current = [];
    };
  }, []);

  const updatePanelCollapsed = (nextCollapsed: boolean) => {
    onPanelCollapsedChange?.(nextCollapsed);

    if (!isPanelCollapseControlled) {
      setInternalPanelCollapsed(nextCollapsed);
    }
  };

  useEffect(() => {
    setItemGroupMap((prev) => {
      const next: Record<string, string> = { ...prev };

      files.forEach((item) => {
        const uid = item.uid;
        if (!(uid in next)) {
          next[uid] = item.groupKey || getGroupKey(item.file);
        }
      });

      Object.keys(next).forEach((uid) => {
        if (!files.some((f) => f.uid === uid)) delete next[uid];
      });

      return next;
    });
  }, [files, groupDepth]);

  const grouped: GroupedMap = useMemo(() => {
    const map = new Map<string, GroupedItem[]>();

    files.forEach((item, idx) => {
      const key = item.groupKey || itemGroupMap[item.uid] || "Ungrouped";
      if (!map.has(key)) map.set(key, []);

      map.get(key)!.push({
        ...item,
        idx,
        id: item.uid,
      });
    });

    const obj: GroupedMap = {};
    for (const [k, v] of map.entries()) obj[k] = v;
    return obj;
  }, [files, itemGroupMap]);

  const [groupOrder, setGroupOrder] = useState<string[]>([]);
  const [customGroups, setCustomGroups] = useState<string[]>([]);
  const previousTutorialCustomGroupsRef = useRef<string[] | null>(null);

  useEffect(() => {
    if (files.length === 0) {
      setCustomGroups([]);
      setGroupError("");
      setIsAddingGroup(false);
      setNewGroupName("");
    }
  }, [files.length]);

  useEffect(() => {
    if (tutorialCustomGroups !== null) {
      setCustomGroups(tutorialCustomGroups);
      setGroupError("");
      setIsAddingGroup(false);
      setNewGroupName("");
    } else if (previousTutorialCustomGroupsRef.current !== null) {
      setCustomGroups([]);
      setGroupError("");
      setIsAddingGroup(false);
      setNewGroupName("");
    }

    previousTutorialCustomGroupsRef.current = tutorialCustomGroups;
  }, [tutorialCustomGroups]);

  const effectiveCustomGroups = tutorialCustomGroups ?? customGroups;

  const allGroupKeys = useMemo(() => {
    const keys = [...Object.keys(grouped), ...effectiveCustomGroups];
    return Array.from(new Set(keys));
  }, [effectiveCustomGroups, grouped]);

  const tutorialOrderedGroupKeys = useMemo(() => getTutorialGroupOrder(allGroupKeys), [allGroupKeys]);

  useEffect(() => {
    if (tutorialStateKey === null) {
      return;
    }

    setGroupOrder(tutorialOrderedGroupKeys);
    onGroupOrderChange?.(tutorialOrderedGroupKeys);
  }, [onGroupOrderChange, tutorialOrderedGroupKeys, tutorialStateKey]);

  useEffect(() => {
    const keys = allGroupKeys;

    setGroupOrder((prev) => {
      const keep = prev.filter((k) => keys.includes(k));
      const add = keys.filter((k) => !keep.includes(k));
      const next = [...keep, ...add];
      onGroupOrderChange?.(next);
      return next;
    });
  }, [allGroupKeys, onGroupOrderChange]);

  const [groupNameMap, setGroupNameMap] = useState<Record<string, string>>({});

  useEffect(() => {
    const keys = allGroupKeys;

    setGroupNameMap((prev) => {
      const next: Record<string, string> = { ...prev };
      keys.forEach((k) => {
        if (!(k in next)) next[k] = k;
      });
      Object.keys(next).forEach((k) => {
        if (!keys.includes(k)) delete next[k];
      });
      return next;
    });
  }, [allGroupKeys]);



  const displayName = (k: string) => groupNameMap[k] ?? k;

  const [dragKey, setDragKey] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draftName, setDraftName] = useState<string>("");
  const [isAddingGroup, setIsAddingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [groupError, setGroupError] = useState("");
  const groupEditingDisabled = isPreload && !allowPreloadEditing;

  const orderedKeys = groupOrder.length ? groupOrder : allGroupKeys;

  const startAddGroup = () => {
    setGroupError("");
    setNewGroupName("");
    setIsAddingGroup(true);
  };

  const cancelAddGroup = () => {
    setIsAddingGroup(false);
    setNewGroupName("");
    setGroupError("");
  };

  const confirmAddGroup = () => {
    const name = newGroupName.trim();
    if (!name) {
      setGroupError("Group name is required.");
      return;
    }

    const exists = new Set(allGroupKeys);
    if (exists.has(name)) {
      setGroupError("Group name already exists.");
      return;
    }

    setCustomGroups((prev) => [...prev, name]);
    setIsAddingGroup(false);
    setNewGroupName("");
    setGroupError("");
  };

  const move = (fromKey: string | null, toKey: string) => {
    if (!fromKey || !toKey || fromKey === toKey) return;

    setGroupOrder((prev) => {
      const arr = [...prev];
      const from = arr.indexOf(fromKey);
      const to = arr.indexOf(toKey);
      if (from === -1 || to === -1) return prev;

      arr.splice(from, 1);
      arr.splice(to, 0, fromKey);
      onGroupOrderChange?.(arr);
      return arr;
    });
  };

  const startRename = (k: string) => {
    setEditingKey(k);
    setDraftName(displayName(k));
  };

  const commitRename = (k: string) => {
    const name = (draftName || "").trim();
    if (!name || name === k || name === displayName(k)) {
      setEditingKey(null);
      return;
    }

    const exists = new Set(allGroupKeys.filter((key) => key !== k));
    if (exists.has(name)) {
      setGroupError("Group name already exists.");
      return;
    }

    setCustomGroups((prev) => prev.map((g) => (g === k ? name : g)));
    setGroupOrder((prev) => prev.map((g) => (g === k ? name : g)));
    setGroupNameMap((prev) => {
      const next = { ...prev };
      delete next[k];
      next[name] = name;
      return next;
    });

    onRenameGroup?.(k, name);
    onRenameGroupKey?.(k, name);
    setEditingKey(null);
    setDraftName("");
    setGroupError("");
  };

  const cancelRename = () => {
    setEditingKey(null);
    setDraftName("");
  };

  function btnStyle(disabled = false): React.CSSProperties {
    if (isLab) {
      return {
        border: "0.5px solid var(--lab-hairline, #D6D2C6)",
        background: "transparent",
        color: disabled ? "var(--lab-muted, #8A8378)" : "var(--lab-text, #211F1C)",
        borderRadius: 5,
        padding: "9px 16px",
        cursor: disabled ? "not-allowed" : "pointer",
        fontFamily: "var(--lab-sans, 'Inter', sans-serif)",
        fontWeight: 500,
        fontSize: 13,
        whiteSpace: "nowrap",
        opacity: disabled ? 0.45 : 1,
        boxShadow: "none",
        textTransform: "none" as const,
      };
    }
    return {
      border: "1px solid rgba(0,0,0,0.15)",
      background: disabled ? "rgba(0,0,0,0.04)" : "white",
      color: disabled ? "rgba(0,0,0,0.35)" : "black",
      borderRadius: 10,
      padding: "6px 10px",
      cursor: disabled ? "not-allowed" : "pointer",
      fontWeight: 700,
      fontSize: 12,
      whiteSpace: "nowrap",
      opacity: disabled ? 0.8 : 1,
    };
  }



  if (!files.length) {
    return (
      <div
        style={{
          border: isLab ? "0.5px solid var(--lab-hairline, #D6D2C6)" : "1px dashed rgba(0,0,0,0.25)",
          borderRadius: isLab ? 8 : 12,
          padding: 12,
          background: isLab ? "var(--lab-panel, #FBFAF6)" : undefined,
        }}
      >
        {isLab ? (
          <div className="lab-eyebrow">{eyebrow || title}</div>
        ) : (
          <div style={{ fontWeight: 700, color: "black" }}>{title}</div>
        )}
        <div style={{ marginTop: 6, color: isLab ? "var(--lab-muted, #8A8378)" : "rgba(0,0,0,0.55)", fontSize: isLab ? 14 : undefined }}>
          No images yet.
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        border: isLab ? "0.5px solid var(--lab-hairline, #D6D2C6)" : "1px solid rgba(0,0,0,0.12)",
        borderRadius: isLab ? 8 : 10,
        padding: 10,
        background: isLab ? "var(--lab-panel, #FBFAF6)" : "rgba(0,0,0,0.02)",
        boxShadow: "none",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        {isLab ? (
          <div className="lab-eyebrow">{eyebrow || title}</div>
        ) : (
          <div style={{ fontWeight: 700, color: "black" }}>
            {title} <span style={{ fontWeight: 450, color: "rgba(0,0,0,0.55)" }}>({files.length})</span>
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {isLab && (
            <span
              className="lab-mono-num"
              style={{
                fontFamily: "var(--lab-mono, 'IBM Plex Mono', monospace)",
                fontWeight: 500,
                fontSize: 13,
                color: "var(--lab-text, #211F1C)",
              }}
            >
              {files.length}
            </span>
          )}
          {foldable && (
            <button
              type="button"
              data-tutorial={tutorialCollapseToggleKey ?? undefined}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                updatePanelCollapsed(!isPanelCollapsed);
              }}
              style={btnStyle()}
            >
              {isLab
                ? (isPanelCollapsed ? "Unfold" : "Fold")
                : (isPanelCollapsed ? "▸ Unfold" : "▾ Fold")}
            </button>
          )}

          <button
            type="button"
            data-tutorial="lab-upload-add-group"
            disabled={groupEditingDisabled}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (groupEditingDisabled) return;
              startAddGroup();
            }}
            style={btnStyle(groupEditingDisabled)}
          >
            {isLab ? "Add group" : "Add Group"}
          </button>

          <button
            type="button"
            disabled={groupEditingDisabled}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (groupEditingDisabled) return;
              onClear?.();
              setCustomGroups([]);
            }}
            style={btnStyle(groupEditingDisabled)}
          >
            {isLab ? "Clear all" : "Clear All"}
          </button>
        </div>
      </div>

      {foldable && isPanelCollapsed && (
        <div
          style={{
            marginTop: 10,
            padding: "10px 12px",
            borderRadius: 8,
            background: "rgba(255,255,255,0.7)",
            border: "1px dashed rgba(0,0,0,0.14)",
            color: "rgba(0,0,0,0.62)",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          Unfold to see and rearrange
        </div>
      )}

      {!isPanelCollapsed && (
        <div ref={panelContentRef}>
          {isAddingGroup && (
            <div
              style={{
                marginTop: 10,
                display: "flex",
                alignItems: "center",
                gap: 8,
                flexWrap: "wrap",
              }}
            >
              <input
                autoFocus
                disabled={groupEditingDisabled}
                value={newGroupName}
                onChange={(e) => {
                  setNewGroupName(e.target.value);
                  if (groupError) setGroupError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") confirmAddGroup();
                  if (e.key === "Escape") cancelAddGroup();
                }}
                placeholder="New group name"
                style={{
                  width: 260,
                  maxWidth: "100%",
                  borderRadius: 10,
                  border: "1px solid rgba(0,0,0,0.25)",
                  padding: "6px 10px",
                  fontWeight: 600,
                  outline: "none",
                  background: "white",
                }}
              />

              <button type="button" onClick={confirmAddGroup} disabled={groupEditingDisabled} style={btnStyle(groupEditingDisabled)}>
                Confirm
              </button>
              <button type="button" onClick={cancelAddGroup} disabled={groupEditingDisabled} style={btnStyle(groupEditingDisabled)}>
                Cancel
              </button>
            </div>
          )}

          {groupError && (
            <div style={{ marginTop: 8, color: "#b42318", fontSize: 12, fontWeight: 600 }}>
              {groupError}
            </div>
          )}

          {showPathDebug && (
            <div
              style={{
                marginTop: 10,
                padding: 10,
                borderRadius: 10,
                background: "white",
                color: "black",
                fontSize: 12,
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 6 }}>DEBUG webkitRelativePath (first 5)</div>
              {files.slice(0, 5).map((f, i) => (
                <div key={i} style={{ opacity: 0.85 }}>
                  {f.file?.webkitRelativePath || "(no webkitRelativePath)"}
                </div>
              ))}
            </div>
          )}

          <div style={{ height: 12 }} />

          <div
            data-tutorial="lab-upload-group-grid"
            style={{
              display: "grid",
              gridTemplateColumns: orderedKeys.length <= 1 ? "minmax(0, 1fr)" : "repeat(2, minmax(0, 1fr))",
              gap: 12,
              alignItems: "start",
            }}
          >
            {orderedKeys.map((k, groupIndex) => {
              const items = grouped[k] || [];
              const isOver = overKey === k && dragKey && dragKey !== k;
    

              return (
                <div
                  key={`${k}::${displayName(k)}`}
                  data-tutorial-group-key={k}
                  onDragOver={(e: React.DragEvent<HTMLDivElement>) => {
                    if (groupEditingDisabled) return;
                    if (dragItem) e.preventDefault();
                  }}
                  onDrop={(e: React.DragEvent<HTMLDivElement>) => {
                    if (groupEditingDisabled) return;
                    e.preventDefault();
                    if (!dragItem?.uid) return;

                    onMoveItemToGroup?.(dragItem.uid, k);

                    setDragItem(null);
                    setOverKey(null);
                  }}
                  style={{
                    border: isOver ? "2px solid var(--highlight-color-button, #7aa7ff)" : "1px solid rgba(0,0,0,0.10)",
                    borderRadius: 10,
                    padding: 8,
                    background: "var(--background-color)",
                  }}
                >
                  <div
                    draggable={!groupEditingDisabled}
                    onDragStart={(e) => {
                      if (groupEditingDisabled) return;
                      setDragKey(k);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => {
                      if (groupEditingDisabled) return;
                      setDragKey(null);
                      setOverKey(null);
                    }}
                    onDragOver={(e) => {
                      if (groupEditingDisabled) return;
                      e.preventDefault();
                      setOverKey(k);
                      e.dataTransfer.dropEffect = "move";
                    }}
                    onDrop={(e) => {
                      if (groupEditingDisabled) return;
                      e.preventDefault();
                      move(dragKey, k);
                      setOverKey(null);
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                      padding: "4px 6px",
                      borderRadius: 8,
                      cursor: "grab",
                      userSelect: "none",
                      background: dragKey === k ? "rgba(0,0,0,0.05)" : "transparent",
                      color: "black",
                    }}
                    title="Drag this header to reorder groups"
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                      <span style={{ opacity: 0.7 }}>⋮⋮</span>

                      {editingKey === k ? (
                        <input
                          value={draftName}
                          autoFocus
                          disabled={groupEditingDisabled}
                          onChange={(e) => setDraftName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitRename(k);
                            if (e.key === "Escape") cancelRename();
                          }}
                          onBlur={() => commitRename(k)}
                          style={{
                            width: 240,
                            maxWidth: "60vw",
                            borderRadius: isLab ? 5 : 10,
                            border: isLab ? "0.5px solid var(--lab-hairline, #D6D2C6)" : "1px solid rgba(0,0,0,0.25)",
                            padding: "6px 10px",
                            fontFamily: isLab ? "var(--lab-mono, 'IBM Plex Mono', monospace)" : undefined,
                            fontWeight: isLab ? 400 : 800,
                            outline: "none",
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            fontFamily: isLab ? "var(--lab-mono, 'IBM Plex Mono', monospace)" : undefined,
                            fontWeight: isLab ? 400 : 800,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            color: isLab ? "var(--lab-text, #211F1C)" : undefined,
                          }}
                        >
                          {displayName(k)}{" "}
                          <span
                            style={{
                              fontFamily: isLab ? "var(--lab-mono, 'IBM Plex Mono', monospace)" : undefined,
                              fontWeight: 500,
                              opacity: 0.6,
                            }}
                          >
                            {items.length}
                          </span>
                        </div>
                      )}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      {editingKey !== k && (
                        <button
                          type="button"
                          disabled={groupEditingDisabled}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if (groupEditingDisabled) return;
                            startRename(k);
                          }}
                          style={{ ...btnStyle(groupEditingDisabled), display: "inline-flex", alignItems: "center", gap: 5 }}
                          title="Rename group"
                        >
                          <Pencil size={isLab ? 16 : 13} strokeWidth={1.5} aria-hidden="true" /> Rename
                        </button>
                      )}

                      <button
                        data-tutorial={groupIndex === 0 ? "lab-upload-clear-group" : undefined}
                        type="button"
                        disabled={groupEditingDisabled}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if (groupEditingDisabled) return;

                          const uidsToRemove = items.map((it) => it.id);
                          onClearGroup?.(k, uidsToRemove);
                          setCustomGroups((prev) => prev.filter((g) => g !== k));
                        }}
                        style={btnStyle(groupEditingDisabled)}
                      >
                        {isLab ? "Clear group" : "Clear Group"}
                      </button>
                    </div>
                  </div>

                  { (
                    <>
                      <div style={{ height: 8 }} />

                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fill, minmax(68px, 1fr))",
                          gap: 8,
                        }}
                      >
                        {items.slice(0, maxThumbsPerGroup).map((it) => (
                          <div
                            key={`${k}::${it.id}::${it.idx}`}
                            data-tutorial-item-uid={it.id}
                            draggable={!groupEditingDisabled}
                            onDragStart={(e) => {
                              if (groupEditingDisabled) return;
                              setDragItem({ uid: it.id, fromKey: k });
                              e.dataTransfer.effectAllowed = "move";
                            }}
                            onDragEnd={() => {
                              setDragItem(null);
                            }}
                            style={{
                              border: "1px solid rgba(0,0,0,0.10)",
                              borderRadius: 10,
                              overflow: "hidden",
                              background: "rgba(0,0,0,0.02)",
                              cursor: "grab",
                            }}
                          >
                            <div style={{ aspectRatio: "1 / 1", position: "relative" }}>
                              <img
                                src={it.blobURL}
                                alt={it.file?.name || "image"}
                                style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                              />
                                {(!viewOnly && !isPreload)  && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    onRemove?.(it.id);
                                  }}
                                  style={{
                                    position: "absolute",
                                    top: 8,
                                    right: 8,
                                    border: "none",
                                    borderRadius: 5,
                                    padding: "5px",
                                    background: "rgba(0,0,0,0.55)",
                                    color: "white",
                                    cursor: "pointer",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    lineHeight: 0,
                                  }}
                                  title="Remove"
                                >
                                  <X size={16} strokeWidth={1.5} aria-hidden="true" />
                                </button>
                                )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {!items.length && (
                        <div
                          style={{
                            border: "1px dashed rgba(0,0,0,0.16)",
                            borderRadius: 8,
                            padding: 8,
                            color: "rgba(0,0,0,0.55)",
                            fontSize: 11,
                          }}
                        >
                          {groupEditingDisabled ? "Empty group." : "Empty group. Drag images here."}
                        </div>
                      )}

                      {items.length > maxThumbsPerGroup && (
                        <div style={{ marginTop: 6, color: "rgba(0,0,0,0.55)", fontSize: 11 }}>
                          Showing first {maxThumbsPerGroup} thumbnails…
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function btnStyle(): React.CSSProperties {
  return {
    border: "1px solid rgba(0,0,0,0.15)",
    background: "white",
    color: "black",
    borderRadius: 8,
    padding: "6px 8px",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 12,
    whiteSpace: "nowrap",
  };
}



