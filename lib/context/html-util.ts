export const wikiCSSHead = `
      <Head>
        <link
          rel="stylesheet"
          href="https://en.wikipedia.org/w/load.php?modules=site.styles&only=styles"
        />
      </Head>
      `;

function buttonHTML(label: string) {
  return `<button class="annotate-btn" onclick="(function(el){
      var note = prompt('Please Input annotation: ');
      if (!note) return;
      var heading = el.previousElementSibling;
      heading = heading ? heading.firstElementChild : heading;
      var sectionTitle = heading ? heading.id : '';
      var p = document.createElement('p');
      p.className = 'mark';
      p.textContent = note;
      el.parentNode.insertBefore(p, el.nextSibling);
      window.parent.postMessage({
        type: 'ANNOTATION_ADDED',
        sectionTitle: sectionTitle,
        text: note
      }, '*');
    })(this)">Annotate</button>
  `
}

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
              body{
                background-color: white;
              }
            </style>
          </head>
          <body>
            ${wikiCSSHead + html}
          </body>
          </html>`
  .replaceAll(
    "</h2></div>",
    `</h2></div>${buttonHTML("h2")}`
  )
  .replaceAll(
    "</h1></div>",
    `</h1></div>${buttonHTML("h1")}`
  )
  .replaceAll(
    "</h3></div>",
    `</h3></div>${buttonHTML("h3")}`
  )
;
};


export const extendMarkHTML = (html: string): string => {
  return `<!doctype html>
  <html lang="zh">
  <head>
    <meta charset="utf-8" />
    <link rel="stylesheet" href="https://en.wikipedia.org/w/load.php?modules=site.styles&only=styles" />
    <style>
      body {
        background: white;
        position: relative;
        font-family: system-ui, sans-serif;
      }
      #mark-btn {
        display: none;
        position: absolute;
        background: #000;
        color: white;
        border: none;
        border-radius: 6px;
        padding: 8px 14px;
        cursor: pointer;
        font-size: 14px;
        font-weight: 600;
        z-index: 9999;
        box-shadow: 0 3px 10px rgba(0, 0, 0, 0.25);
        transition: background 0.2s ease, transform 0.1s ease;
      }
      #mark-btn:hover {
        background: #222;
        transform: scale(1.05);
      }
    </style>
  </head>
  <body>
    ${html}
    <button id="mark-btn">Mark as reference</button>

    <script>
      const markBtn = document.getElementById('mark-btn');

      // 计算最近标题 ID 的辅助函数
      function findNearestHeadingId(node) {
        let el = node;
        while (el) {
          if (el.matches && el.matches('h1, h2, h3')) {
            return el.id || '';
          }
          el = el.parentElement;
        }
        return '';
      }

      document.addEventListener('mouseup', (e) => {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed) {
          markBtn.style.display = 'none';
          return;
        }

        const range = selection.getRangeAt(0);
        const rect = range.getBoundingClientRect();
        markBtn.style.display = 'block';
        markBtn.style.left = window.scrollX + rect.left + 'px';
        markBtn.style.top = window.scrollY + rect.top - 40 + 'px';
      });

      document.addEventListener('mousedown', (e) => {
        if (!markBtn.contains(e.target)) {
          markBtn.style.display = 'none';
        }
      });

      markBtn.addEventListener('click', () => {
        const selection = window.getSelection();
        if (!selection || selection.isCollapsed) return;
        const text = selection.toString().trim();
        if (!text) return;

        // 找到选中文本所在的 DOM 节点
        const anchorNode = selection.anchorNode;
        const sectionId = anchorNode ? findNearestHeadingId(anchorNode.parentElement) : '';

        window.parent.postMessage({
          type: 'RERMARK_ADD',
          text,
          sectionId
        }, '*');

        markBtn.style.display = 'none';
        selection.removeAllRanges();
      });
    </script>
  </body>
  </html>`;
};
