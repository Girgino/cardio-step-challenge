# QR poster

Print-ready files:

- `poster-letter.pdf` (8.5 x 11 in)
- `poster-11x17.pdf` (11 x 17 in)

The QR code opens https://lmhstepchallenge.github.io/. The build checks it by reading the QR back out of each PDF.

## Change the dates or the prize line

1. Open `poster.config.json` in any text editor.
2. Change the text between the quotes for `dates` and `prize`. Keep the quotes and commas.
3. Rebuild (below), or ask Claude to "rebuild the poster".

## Rebuild

In Terminal:

```bash
cd materials/poster
npm install
npm run build
```

It needs Google Chrome installed in Applications. It writes both PDFs and also refreshes `docs/assets/join-qr.svg`, the QR used on the website and TV.

## Printing

- Print at 100% ("Actual size"), not "Fit to page".
- The design keeps a white border, so any office printer works.
- Before putting posters up, scan one printed copy with a phone camera.

## Files

- `poster.html`: the layout. Shared colors come from `docs/css/tokens.css`; the ECG line and Lake Monroe outline come from `docs/js`.
- `build.mjs`: fills in the template, prints the PDFs with headless Chrome and checks the QR.
- `build/`: intermediate files, not needed.
