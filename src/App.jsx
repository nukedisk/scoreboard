import { useEffect, useLayoutEffect, useRef, useState } from "react";

const STORAGE_KEY = "scoreboard:v1";

// Pool of emojis handed out to participants (no two participants share one)
const EMOJIS = [
  "👻", "🧟‍♂️", "👹", "🧛", "👺", "🤡", "💀", "👽", "🪦", "🦇",

];

const pickEmoji = (used) => {
  const free = EMOJIS.filter((e) => !used.includes(e));
  return free.length ? free[Math.floor(Math.random() * free.length)] : null;
};

const load = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    // Give an emoji to participants saved before emojis existed
    const used = saved.map((p) => p.emoji).filter(Boolean);
    return saved.map((p) => {
      if (p.emoji) return p;
      const emoji = pickEmoji(used) || "";
      if (emoji) used.push(emoji);
      return { ...p, emoji };
    });
  } catch {
    return [];
  }
};

const total = (p) => p.history.reduce((sum, h) => sum + h.points, 0);
const uid = () => crypto.randomUUID();

export default function App() {
  const [players, setPlayers] = useState(load);
  const [name, setName] = useState("");

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(players));
    } catch {
      /* storage unavailable */
    }
  }, [players]);

  const addPlayer = (e) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setPlayers((ps) => {
      const emoji = pickEmoji(ps.map((p) => p.emoji));
      if (!emoji) return ps; // every emoji is taken
      return [...ps, { id: uid(), name: trimmed, emoji, history: [] }];
    });
    setName("");
  };

  const removePlayer = (id) => setPlayers((ps) => ps.filter((p) => p.id !== id));

  const addScore = (id, points) =>
    setPlayers((ps) =>
      ps.map((p) =>
        p.id === id
          ? { ...p, history: [...p.history, { id: uid(), points, at: Date.now() }] }
          : p
      )
    );

  const removeEntry = (id, entryId) =>
    setPlayers((ps) =>
      ps.map((p) =>
        p.id === id ? { ...p, history: p.history.filter((h) => h.id !== entryId) } : p
      )
    );

  const resetScores = () =>
    setPlayers((ps) => ps.map((p) => ({ ...p, history: [] })));

  const full = players.length >= EMOJIS.length;
  const ranked = [...players].sort((a, b) => total(b) - total(a));
  const orderKey = ranked.map((p) => p.id).join();

  const [openIds, setOpenIds] = useState(() => new Set());
  const toggleOpen = (id) =>
    setOpenIds((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  // Slide rows to their new position when the ranking changes
  const rowEls = useRef(new Map());
  const prevTops = useRef(new Map());
  const prevOrder = useRef(orderKey);

  useLayoutEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const orderChanged = prevOrder.current !== orderKey;
    prevOrder.current = orderKey;

    rowEls.current.forEach((el, id) => {
      const top = el.offsetTop;
      const prev = prevTops.current.get(id);
      prevTops.current.set(id, top);
      if (reduce || !orderChanged || prev === undefined || prev === top) return;
      el.style.transition = "none";
      el.style.transform = `translateY(${prev - top}px)`;
      el.getBoundingClientRect(); // force reflow
      el.style.transition = "transform 400ms ease";
      el.style.transform = "";
    });
    prevTops.current.forEach((_, id) => {
      if (!rowEls.current.has(id)) prevTops.current.delete(id);
    });
  });

  return (
    <main className="app">
      <header className="top">
        <h1>Scoreboard</h1>
        {players.length > 0 && (
          <button className="ghost" onClick={resetScores}>
            Reset all scores
          </button>
        )}
      </header>

      <form className="add-player" onSubmit={addPlayer}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Participant name"
          aria-label="Participant name"
        />
        <button type="submit" className="primary" disabled={full}>
          Add participant
        </button>
      </form>
      {full && (
        <p className="notice">
          Maximum of {EMOJIS.length} participants reached. Remove one to add another.
        </p>
      )}

      {ranked.length === 0 ? (
        <p className="empty">No participants yet. Add a name above to start scoring.</p>
      ) : (
        <ol className="list">
          {ranked.map((p, i) => (
            <Row
              key={p.id}
              player={p}
              rank={i + 1}
              leading={i === 0 && total(p) > 0}
              open={openIds.has(p.id)}
              onToggle={toggleOpen}
              setRef={(el) =>
                el ? rowEls.current.set(p.id, el) : rowEls.current.delete(p.id)
              }
              onScore={addScore}
              onRemove={removePlayer}
              onRemoveEntry={removeEntry}
            />
          ))}
        </ol>
      )}
    </main>
  );
}

function Row({ player, rank, leading, open, onToggle, setRef, onScore, onRemove, onRemoveEntry }) {
  const [points, setPoints] = useState("");

  const submit = (e) => {
    e.preventDefault();
    const n = Number(points);
    if (!points || Number.isNaN(n) || n === 0) return;
    onScore(player.id, n);
    setPoints("");
  };

  const fmt = (ts) =>
    new Date(ts).toLocaleString([], { dateStyle: "short", timeStyle: "short" });

  return (
    <li ref={setRef} className={`row ${leading ? "leading" : ""}`}>
      <div className="main">
        <span className="rank">{rank}</span>
        <span className="emoji" aria-hidden="true">{player.emoji}</span>
        <span className="name">{player.name}</span>
        <span className="total">{total(player)}</span>
      </div>

      <div className="actions">
        <form onSubmit={submit} className="score-form">
          <input
            type="number"
            value={points}
            onChange={(e) => setPoints(e.target.value)}
            placeholder="+ points"
            aria-label={`Points for ${player.name}`}
          />
          <button type="submit" className="primary">
            Add score
          </button>
        </form>
        <button className="ghost" onClick={() => onToggle(player.id)} aria-expanded={open}>
          {open ? "Hide history" : `History (${player.history.length})`}
        </button>
        <button
          className="danger"
          onClick={() => onRemove(player.id)}
          aria-label={`Remove ${player.name}`}
        >
          Remove
        </button>
      </div>

      {open && (
        <div className="history">
          {player.history.length === 0 ? (
            <p className="empty small">No scores yet.</p>
          ) : (
            <ul>
              {[...player.history].reverse().map((h) => (
                <li key={h.id}>
                  <span className={h.points > 0 ? "pos" : "neg"}>
                    {h.points > 0 ? "+" : ""}
                    {h.points}
                  </span>
                  <time>{fmt(h.at)}</time>
                  <button
                    className="ghost tiny"
                    onClick={() => onRemoveEntry(player.id, h.id)}
                    aria-label="Delete this entry"
                  >
                    Delete
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}
