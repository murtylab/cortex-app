import React, { useEffect, useMemo, useState } from "react";

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
  groupDepth?: number;
  maxThumbsPerGroup?: number;
  showPathDebug?: boolean;
  foldable?: boolean;
  viewOnly?: boolean;
  isPreload?: boolean;

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
}: ImagePreviewGroupedDnDProps) {
  const getGroupKey = (file?: FileWithPath) => {
    const rel = file?.webkitRelativePath ?? "";
    if (!rel) return "Ungrouped";

    const parts = rel.split("/").filter(Boolean);
    if (parts.length <= groupDepth + 1) return parts[0] || "Ungrouped";
    return parts[groupDepth] || parts[0] || "Ungrouped";
  };

  const [itemGroupMap, setItemGroupMap] = useState<Record<string, string>>({});
  const [dragItem, setDragItem] = useState<{ uid: string; fromKey: string } | null>(null);


  const [isPanelCollapsed, setIsPanelCollapsed] = useState<boolean>(foldable);


  useEffect(() => {
    setIsPanelCollapsed(foldable);
  }, [foldable]);

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

  useEffect(() => {
    if (files.length === 0) {
      setCustomGroups([]);
      setGroupError("");
      setIsAddingGroup(false);
      setNewGroupName("");
    }
  }, [files.length]);

  const allGroupKeys = useMemo(() => {
    const keys = [...Object.keys(grouped), ...customGroups];
    return Array.from(new Set(keys));
  }, [grouped, customGroups]);

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
    if (!name || name === k) {
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
      <div style={{ border: "1px dashed rgba(0,0,0,0.25)", borderRadius: 12, padding: 12 }}>
        <div style={{ fontWeight: 700, color: "black" }}>{title}</div>
        <div style={{ marginTop: 6, color: "rgba(0,0,0,0.55)" }}>No images yet.</div>
      </div>
    );
  }

  return (
    <div
      style={{
        border: "1px solid rgba(0,0,0,0.12)",
        borderRadius: 10,
        padding: 10,
        background: "rgba(0,0,0,0.02)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <div style={{ fontWeight: 700, color: "black" }}>
          {title} <span style={{ fontWeight: 450, color: "rgba(0,0,0,0.55)" }}>({files.length})</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {foldable && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsPanelCollapsed((prev) => !prev);
              }}
              style={btnStyle()}
            >
              {isPanelCollapsed ? "▸ Unfold" : "▾ Fold"}
            </button>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              startAddGroup();
            }}
            style={btnStyle()}
          >
            Add Group
          </button>

          <button
            type="button"
            disabled={isPreload}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (isPreload) return;
              onClear?.();
              setCustomGroups([]);
            }}
            style={btnStyle(isPreload)}
          >
            Clear All
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
        <>
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
                disabled={isPreload}
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

              <button type="button" onClick={confirmAddGroup} disabled={isPreload} style={btnStyle(isPreload)}>
                Confirm
              </button>
              <button type="button" onClick={cancelAddGroup} disabled={isPreload} style={btnStyle(isPreload)}>
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
            style={{
              display: "grid",
              gridTemplateColumns: orderedKeys.length <= 1 ? "minmax(0, 1fr)" : "repeat(2, minmax(0, 1fr))",
              gap: 12,
              alignItems: "start",
            }}
          >
            {orderedKeys.map((k) => {
              const items = grouped[k] || [];
              const isOver = overKey === k && dragKey && dragKey !== k;
    

              return (
                <div
                  key={`${k}::${displayName(k)}`}
                  onDragOver={(e: React.DragEvent<HTMLDivElement>) => {
                    if(isPreload) return;
                    if (dragItem) e.preventDefault();
                  }}
                  onDrop={(e: React.DragEvent<HTMLDivElement>) => {
                    if(isPreload) return;
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
                    draggable = {!isPreload}
                    onDragStart={(e) => {
                      if(isPreload) return;
                      setDragKey(k);
                      e.dataTransfer.effectAllowed = "move";
                    }}
                    onDragEnd={() => {
                      if(isPreload) return;
                      setDragKey(null);
                      setOverKey(null);
                    }}
                    onDragOver={(e) => {
                      if(isPreload) return;
                      e.preventDefault();
                      setOverKey(k);
                      e.dataTransfer.dropEffect = "move";
                    }}
                    onDrop={(e) => {
                      if(isPreload) return;
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
                          disabled={isPreload}
                          onChange={(e) => setDraftName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitRename(k);
                            if (e.key === "Escape") cancelRename();
                          }}
                          onBlur={() => commitRename(k)}
                          style={{
                            width: 240,
                            maxWidth: "60vw",
                            borderRadius: 10,
                            border: "1px solid rgba(0,0,0,0.25)",
                            padding: "6px 10px",
                            fontWeight: 800,
                            outline: "none",
                          }}
                        />
                      ) : (
                        <div
                          style={{
                            fontWeight: 800,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {displayName(k)} <span style={{ fontWeight: 500, opacity: 0.6 }}>{items.length}</span>
                        </div>
                      )}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      {editingKey !== k && (
                        <button
                          type="button"
                          disabled={isPreload}
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            if(isPreload) return;
                            startRename(k);
                          }}
                          style={btnStyle(isPreload)}
                          title="Rename group"
                        >
                          ✏️ Rename
                        </button>
                      )}

                      <button
                        type="button"
                        disabled={isPreload}
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          if(isPreload) return;

                          const uidsToRemove = items.map((it) => it.id);
                          onClearGroup?.(k, uidsToRemove);
                          setCustomGroups((prev) => prev.filter((g) => g !== k));
                        }}
                        style={btnStyle(isPreload)}
                      >
                        Clear Group
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
                            draggable = {!isPreload}
                            onDragStart={(e) => {
                              if(isPreload) return; 
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
                                    borderRadius: 10,
                                    padding: "6px 8px",
                                    background: "rgba(0,0,0,0.55)",
                                    color: "white",
                                    cursor: "pointer",
                                    fontSize: 12,
                                  }}
                                  title="Remove"
                                >
                                  ✕
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
                            {isPreload ? "Empty group." : "Empty group. Drag images here."}
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
        </>
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



