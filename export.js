/* ============================================================
   Marginalia — export
   Builds PDF (jsPDF), EPUB (JSZip, hand-built OPF/NCX), and
   plain text files entirely in the browser. Nothing leaves
   the device for export.
   ============================================================ */

function htmlToPlainParagraphs(html) {
  const div = document.createElement("div");
  div.innerHTML = html || "";
  const blocks = [];
  div.querySelectorAll("p, div, br").forEach(() => {}); // no-op, structure kept via innerText
  const text = div.innerText || div.textContent || "";
  return text.split(/\n+/).map((s) => s.trim()).filter(Boolean);
}

function escapeXml(str) {
  return (str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/* ---------------- TXT ---------------- */
function exportTxt(book) {
  let out = `${book.title}\n`;
  if (book.author) out += `by ${book.author}\n`;
  out += "\n" + "=".repeat(40) + "\n\n";
  book.chapters.forEach((ch, i) => {
    out += `${ch.title || "Chapter " + (i + 1)}\n\n`;
    out += htmlToPlainParagraphs(ch.content).join("\n\n");
    out += "\n\n\n";
  });
  downloadBlob(new Blob([out], { type: "text/plain" }), `${slug(book.title)}.txt`);
}

/* ---------------- PDF ---------------- */
function exportPdf(book) {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 72;
  const maxW = pageW - margin * 2;
  let y = 0;

  // title page
  doc.setFont("times", "bold");
  doc.setFontSize(28);
  const titleLines = doc.splitTextToSize(book.title, maxW);
  y = pageH / 2 - titleLines.length * 16;
  titleLines.forEach((line) => {
    doc.text(line, pageW / 2, y, { align: "center" });
    y += 34;
  });
  if (book.author) {
    doc.setFont("times", "italic");
    doc.setFontSize(14);
    doc.text(book.author, pageW / 2, y + 10, { align: "center" });
  }

  book.chapters.forEach((ch) => {
    doc.addPage();
    y = margin;
    doc.setFont("times", "bold");
    doc.setFontSize(20);
    const chLines = doc.splitTextToSize(ch.title || "Untitled Chapter", maxW);
    chLines.forEach((line) => {
      doc.text(line, margin, y);
      y += 26;
    });
    y += 14;

    doc.setFont("times", "normal");
    doc.setFontSize(12);
    const paras = htmlToPlainParagraphs(ch.content);
    paras.forEach((para) => {
      const lines = doc.splitTextToSize(para, maxW);
      lines.forEach((line) => {
        if (y > pageH - margin) {
          doc.addPage();
          y = margin;
        }
        doc.text(line, margin, y);
        y += 17;
      });
      y += 10;
    });
  });

  doc.save(`${slug(book.title)}.pdf`);
}

/* ---------------- EPUB ---------------- */
async function exportEpub(book) {
  const zip = new JSZip();
  const uuid = "urn:uuid:" + (book.id || Date.now());
  const modified = new Date().toISOString().replace(/\.\d+Z$/, "Z");

  zip.file("mimetype", "application/epub+zip", { compression: "STORE" });

  zip.file(
    "META-INF/container.xml",
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
  </rootfiles>
</container>`
  );

  const manifestItems = [];
  const spineItems = [];
  const navItems = [];
  const ncxItems = [];

  book.chapters.forEach((ch, i) => {
    const id = `chap${i + 1}`;
    const file = `${id}.xhtml`;
    const title = escapeXml(ch.title || `Chapter ${i + 1}`);
    const paras = htmlToPlainParagraphs(ch.content)
      .map((p) => `<p>${escapeXml(p)}</p>`)
      .join("\n    ");

    zip.file(
      `OEBPS/${file}`,
      `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml">
<head><title>${title}</title>
<link rel="stylesheet" type="text/css" href="style.css"/>
</head>
<body>
  <h1>${title}</h1>
  <section>
    ${paras || "<p></p>"}
  </section>
</body>
</html>`
    );

    manifestItems.push(`<item id="${id}" href="${file}" media-type="application/xhtml+xml"/>`);
    spineItems.push(`<itemref idref="${id}"/>`);
    navItems.push(`<li><a href="${file}">${title}</a></li>`);
    ncxItems.push(
      `<navPoint id="np${i + 1}" playOrder="${i + 1}"><navLabel><text>${title}</text></navLabel><content src="${file}"/></navPoint>`
    );
  });

  zip.file(
    "OEBPS/style.css",
    `body{font-family:Georgia,"Source Serif 4",serif;line-height:1.6;margin:2em;color:#22201b;}
h1{font-family:Georgia,serif;font-size:1.5em;margin-bottom:1em;}
p{margin:0 0 1em;text-indent:0;}`
  );

  zip.file(
    "OEBPS/nav.xhtml",
    `<?xml version="1.0" encoding="UTF-8"?>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops">
<head><title>Table of Contents</title></head>
<body>
  <nav epub:type="toc" id="toc">
    <h1>Contents</h1>
    <ol>
      ${navItems.join("\n      ")}
    </ol>
  </nav>
</body>
</html>`
  );

  zip.file(
    "OEBPS/toc.ncx",
    `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head>
    <meta name="dtb:uid" content="${uuid}"/>
  </head>
  <docTitle><text>${escapeXml(book.title)}</text></docTitle>
  <navMap>
    ${ncxItems.join("\n    ")}
  </navMap>
</ncx>`
  );

  zip.file(
    "OEBPS/content.opf",
    `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="BookId">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="BookId">${uuid}</dc:identifier>
    <dc:title>${escapeXml(book.title)}</dc:title>
    <dc:creator>${escapeXml(book.author || "Unknown")}</dc:creator>
    <dc:language>en</dc:language>
    <meta property="dcterms:modified">${modified}</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="css" href="style.css" media-type="text/css"/>
    ${manifestItems.join("\n    ")}
  </manifest>
  <spine toc="ncx">
    ${spineItems.join("\n    ")}
  </spine>
</package>`
  );

  const blob = await zip.generateAsync({ type: "blob", mimeType: "application/epub+zip" });
  downloadBlob(blob, `${slug(book.title)}.epub`);
}

function slug(str) {
  return (str || "book")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "book";
}
