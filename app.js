const WORKER_URL = "https://crab-news-worker.anyberg-1d4.workers.dev";

const VIDEO_ID = "LDU_Txk06tM";
const REFRESH_MS = 30000;
const MAX_COMMENTS = 300;
const STORAGE_KEY = "crabNewsLastSeen";

const chat = document.getElementById("chat");
const count = document.getElementById("count");
const connection = document.getElementById("connection");
const statusMessage = document.getElementById("status-message");

const known = new Set();
let comments = [];
let lastSeenId = localStorage.getItem(STORAGE_KEY);
let paused = false;
let loading = false;
let initialized = false;

function formatTime(value) {
  return new Date(value).toLocaleString();
}

function renderComment(comment, isNew = false) {
  const card = document.createElement("article");
  card.className = "message" + (isNew ? " new" : "");

  const username = document.createElement("div");
  username.className = "username";
  username.textContent = comment.author;

  const body = document.createElement("div");
  body.className = "message-body";
  body.textContent = comment.text;

  const timestamp = document.createElement("div");
  timestamp.className = "timestamp";
  timestamp.textContent = formatTime(comment.publishedAt);

  const link = document.createElement("a");
  link.href = `https://www.youtube.com/watch?v=${VIDEO_ID}&lc=${encodeURIComponent(comment.id)}`;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = "View original comment";

  card.append(username, body, timestamp, link);
  return card;
}

function displayAll(newIds = new Set()) {
  const fragment = document.createDocumentFragment();

  comments.forEach(comment => {
    fragment.appendChild(
      renderComment(comment, newIds.has(comment.id))
    );
  });

  chat.replaceChildren(fragment);
  count.textContent = `${comments.length} COMMENTS`;

  if (!paused) {
    chat.scrollTop = chat.scrollHeight;
  }
}

function mergeComments(incoming) {
  const fresh = [];

  for (const item of incoming) {
    if (!item.id || known.has(item.id)) continue;

    known.add(item.id);
    fresh.push(item);
  }

  if (!fresh.length) return;

  comments.push(...fresh);

  // Keep chronological order.
  comments.sort((a, b) =>
    new Date(a.publishedAt) - new Date(b.publishedAt)
  );

  comments = comments.slice(-MAX_COMMENTS);

  displayAll(new Set(fresh.map(item => item.id)));
}

async function refresh() {
  if (loading) return;

  loading = true;

  try {
    const url = new URL(`${WORKER_URL}/comments`);
    url.searchParams.set("videoId", VIDEO_ID);

    if (lastSeenId) {
      url.searchParams.set("afterId", lastSeenId);
    }

    const response = await fetch(url, {
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!Array.isArray(data.recent)) {
      throw new Error("Invalid comment response");
    }

    if (!initialized) {
      // Start with the latest 100 comments.
      mergeComments(data.recent);
      initialized = true;
    }

    // Recover comments posted since the previous session/poll.
    if (Array.isArray(data.newComments)) {
      mergeComments(data.newComments);
    }

    if (data.latestCommentId) {
      lastSeenId = data.latestCommentId;
      localStorage.setItem(STORAGE_KEY, lastSeenId);
    }

    if (data.truncated) {
      statusMessage.textContent =
        "WARNING: Catch-up limit reached. Some older comments may be missing.";
    } else {
      statusMessage.textContent =
        "Monitoring the Crab Rave comment section.";
    }

    connection.textContent = "CONNECTED";
  } catch (error) {
    console.error("Crab News connection error:", error);
    connection.textContent = "RECONNECTING";
    statusMessage.textContent =
      "Connection interrupted. Retrying automatically...";
  } finally {
    loading = false;
  }
}

document.getElementById("pause").addEventListener("click", event => {
  paused = !paused;

  event.target.textContent = paused
    ? "RESUME AUTO-SCROLL"
    : "PAUSE AUTO-SCROLL";

  if (!paused) {
    chat.scrollTop = chat.scrollHeight;
  }
});

document.getElementById("fullscreen").addEventListener("click", async () => {
  try {
    if (!document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    } else {
      await document.exitFullscreen();
    }
  } catch (error) {
    console.error("Fullscreen error:", error);
  }
});

function updateClock() {
  document.getElementById("clock").textContent =
    new Date().toLocaleTimeString();
}

updateClock();
setInterval(updateClock, 1000);

refresh();
setInterval(refresh, REFRESH_MS);
