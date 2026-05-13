// Self-contained CSS for the HTML report. Inlined into the rendered file
// via <style>; no external font / asset references so reports survive
// archival without a network.

export const STYLES = `
*, *::before, *::after { box-sizing: border-box; }
body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  margin: 0;
  padding: 32px 24px;
  max-width: 1100px;
  margin: 0 auto;
  color: #1f2328;
  background: #fafafa;
  line-height: 1.55;
}
h1, h2, h3 { margin: 24px 0 12px; line-height: 1.25; }
h1 { font-size: 24px; }
h2 { font-size: 18px; border-bottom: 1px solid #d0d7de; padding-bottom: 6px; margin-top: 32px; }
header { padding-bottom: 24px; border-bottom: 1px solid #d0d7de; margin-bottom: 8px; }
.meta { display: flex; flex-wrap: wrap; gap: 16px; font-size: 13px; color: #57606a; margin-top: 8px; }
.meta span { white-space: nowrap; }
.pass-rate { font-size: 40px; font-weight: 700; margin-top: 12px; }
.pass-rate.ok { color: #1a7f37; }
.pass-rate.bad { color: #cf222e; }
.pass-rate small { font-size: 14px; font-weight: 400; color: #57606a; margin-left: 6px; }
table { width: 100%; border-collapse: collapse; margin: 12px 0; font-size: 14px; }
th, td { padding: 8px 12px; text-align: left; border-bottom: 1px solid #d0d7de; }
th { background: #f6f8fa; font-weight: 600; font-size: 13px; color: #57606a; text-transform: uppercase; letter-spacing: 0.04em; }
td.num { font-variant-numeric: tabular-nums; text-align: right; }
details {
  margin: 8px 0;
  border: 1px solid #d0d7de;
  border-radius: 6px;
  background: white;
  overflow: hidden;
}
summary {
  padding: 12px 16px;
  cursor: pointer;
  font-weight: 600;
  font-size: 14px;
  user-select: none;
}
summary:hover { background: #f6f8fa; }
summary.fail { color: #cf222e; }
summary.pass { color: #1a7f37; }
.body { padding: 12px 16px 16px; border-top: 1px solid #d0d7de; background: #fafbfc; }
.field { margin: 10px 0; font-size: 14px; }
.field-label { display: inline-block; min-width: 132px; color: #57606a; font-weight: 500; font-size: 13px; vertical-align: top; }
.text {
  white-space: pre-wrap;
  background: white;
  padding: 12px 14px;
  border-radius: 6px;
  border: 1px solid #d0d7de;
  font-size: 13px;
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
  margin-top: 8px;
  overflow-x: auto;
}
.tag { display: inline-block; padding: 2px 8px; border-radius: 999px; font-size: 12px; font-weight: 500; margin-right: 6px; }
.tag.ok { background: #dafbe1; color: #1a7f37; }
.tag.fail { background: #ffebe9; color: #cf222e; }
.tag.skip { background: #fff8c5; color: #9a6700; }
.tag.muted { background: #eaeef2; color: #57606a; }
code { font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace; font-size: 13px; background: #f6f8fa; padding: 2px 6px; border-radius: 4px; }
footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #d0d7de; color: #57606a; font-size: 12px; }
footer a { color: #0969da; text-decoration: none; }
footer a:hover { text-decoration: underline; }
`.trim();
