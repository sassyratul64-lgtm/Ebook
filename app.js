/* ============================================================
   Marginalia — data layer
   Books & chapters persisted to localStorage.
   ============================================================ */
const STORE_KEY = "marginalia_books_v1";

const SPINE_COLORS = [
  { name: "Oxblood", value: "#8B3A3A" },
  { name: "Teal",    value: "#3F5A52" },
  { name: "Gold",    value: "#C9A15C" },
  { name: "Plum",    value: "#5A4A70" },
  { name: "Forest",  value: "#3E5240" },
  { name: "Slate",   value: "#4A5A66" },
];

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function loadBooks() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    console.error("Failed to load books", e);
    return [];
  }
}

function saveBooks(books) {
  localStorage.setItem(STORE_KEY, JSON.stringify(books));
}

function getBook(id) {
  return loadBooks().find((b) => b.id === id) || null;
}

function createBook({ title, author, genre, color }) {
  const books = loadBooks();
  const book = {
    id: uid(),
    title: title || "Untitled Book",
    author: author || "",
    genre: genre || "",
    color: color || SPINE_COLORS[0].value,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    chapters: [
      { id: uid(), title: "Chapter One", content: "" },
    ],
  };
  books.unshift(book);
  saveBooks(books);
  return book;
}

function deleteBook(id) {
  saveBooks(loadBooks().filter((b) => b.id !== id));
}

function updateBook(id, patch) {
  const books = loadBooks();
  const idx = books.findIndex((b) => b.id === id);
  if (idx === -1) return null;
  books[idx] = { ...books[idx], ...patch, updatedAt: Date.now() };
  saveBooks(books);
  return books[idx];
}

function addChapter(bookId, title) {
  const books = loadBooks();
  const book = books.find((b) => b.id === bookId);
  if (!book) return null;
  const chapter = { id: uid(), title: title || `Chapter ${book.chapters.length + 1}`, content: "" };
  book.chapters.push(chapter);
  book.updatedAt = Date.now();
  saveBooks(books);
  return chapter;
}

function updateChapter(bookId, chapterId, patch) {
  const books = loadBooks();
  const book = books.find((b) => b.id === bookId);
  if (!book) return;
  const ch = book.chapters.find((c) => c.id === chapterId);
  if (!ch) return;
  Object.assign(ch, patch);
  book.updatedAt = Date.now();
  saveBooks(books);
}

function deleteChapter(bookId, chapterId) {
  const books = loadBooks();
  const book = books.find((b) => b.id === bookId);
  if (!book) return;
  book.chapters = book.chapters.filter((c) => c.id !== chapterId);
  book.updatedAt = Date.now();
  saveBooks(books);
}

function wordCount(html) {
  const text = (html || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").trim();
  if (!text) return 0;
  return text.split(/\s+/).filter(Boolean).length;
}

function bookWordCount(book) {
  return book.chapters.reduce((sum, c) => sum + wordCount(c.content), 0);
}

function fmtDate(ts) {
  return new Date(ts).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}
