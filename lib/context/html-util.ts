export const wikiCSSHead = `
      <Head>
        <link
          rel="stylesheet"
          href="https://en.wikipedia.org/w/load.php?modules=site.styles&only=styles"
        />
      </Head>
      `;

export const extendWikiHTML = (html: string): string => {
  return `<!doctype html>
          <html lang="zh">
          <head>
            <meta charset="utf-8" />
            <link rel="stylesheet" href="https://en.wikipedia.org/w/load.php?modules=site.styles&only=styles" />
            <style>
              .annotate-btn {
                background: #f59e0b;
                border: none;
                padding: 4px 8px;
                border-radius: 4px;
                cursor: pointer;
                color: white;
                font-size: 12px;
              }
              .mark {
                margin: 4px 0;
                padding: 2px 6px;
                background: #fef3c7;
                border-left: 3px solid #f59e0b;
              }
            </style>
          </head>
          <body>
            ${wikiCSSHead + html}
          </body>
          </html>`
  .replace(
    /<a\s+[^>]*role=["']button["'][^>]*>[\s\S]*?<\/a>/gi,
    `<button class="annotate-btn" onclick="(function(el){
      var note = prompt('Please Input annotation: ');
      if (!note) return;

      var heading = el.closest('.mw-heading') || el.closest('h2, h3, h4');
      var titleEl = heading ? heading.querySelector('h2,h3,h4') || heading : null;
      var sectionId = titleEl ? (titleEl.id || '') : '';
      var sectionTitle = titleEl ? (titleEl.textContent || '') : '';

      var p = document.createElement('p');
      p.className = 'mark';
      p.textContent = note;
      el.parentNode.insertBefore(p, el.nextSibling);

      window.parent.postMessage({
        type: 'ANNOTATION_ADDED',
        sectionId: sectionId,
        sectionTitle: sectionTitle,
        text: note
      }, '*');
    })(this)">Annotate</button>`
  )

    .replace(/<div[^>]*id=(["'])toc\1[^>]*>[\s\S]*?<\/ul>\s*<\/div>/i, "")

    .replace(
      /^\s*<div[^>]*class=(["'])[^"']*\bmw-parser-output\b[^"']*\1[^>]*>\s*/i,
      ""
    )

    .replace(/\s*<\/div>\s*$/i, "");
};
