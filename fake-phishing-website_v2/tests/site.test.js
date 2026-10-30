import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ADS } from '../public/ads.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
const script = fs.readFileSync(path.join(root, 'public/app.js'), 'utf8');
const css = fs.readFileSync(path.join(root, 'public/styles.css'), 'utf8');
const config = JSON.parse(fs.readFileSync(path.join(root, 'vercel.json'), 'utf8'));

// These act as regression contracts for the original simulated landing page.
test('original simulation and security components remain reusable', () => {
  for (const name of ['demo-banner','site-header','countdown-timer','prize-hero','prize-ticket','safety-ticker','red-flags','site-footer','explanation-dialog']) {
    assert.match(html, new RegExp(`<template id="${name}-template">`));
    assert.match(script, new RegExp(`['"]${name}['"]`));
  }
  assert.match(script, /this\.deadline \?\?= Date\.now\(\) \+ 5 \* 60 \* 1000/);
  assert.match(script, /Math\.max\(0, Math\.ceil/);
  assert.match(script, /this\.trigger\?\.focus\(\)/);
  assert.match(script, /this\.dialog\.showModal\(\)/);
});

test('only native JS Web Components / open Shadow DOM, no framework or runtime dependencies', () => {
  assert.match(script, /class ShadowComponent extends HTMLElement/);
  assert.match(script, /this\.attachShadow\(\{ mode: 'open' \}\)/);
  for (const name of ['retro-ad-board','retro-ad-tile','retro-ad-banner','retro-motion-toggle']) {
    assert.match(html, new RegExp(`<template id="${name}-template">`));
    assert.ok(script.includes(`'${name}'`));
  }
  assert.doesNotMatch(script, /\b(?:React|Vue|Angular|jQuery|innerHTML|eval)\b/);
  const pkg = JSON.parse(fs.readFileSync(path.join(root,'package.json'), 'utf8'));
  assert.equal(pkg.type, 'module');
  assert.equal(pkg.dependencies, undefined);
  assert.equal(pkg.devDependencies, undefined);
});

test('banner assets and provided content are local and deterministic', () => {
  assert.equal(ADS.length, 39);
  for (const ad of ADS) {
    assert.ok(fs.existsSync(path.join(root, 'public/assets/tiles', `${ad.asset}.png`)), ad.asset);
    assert.ok(ad.headline && ad.detail && ad.eyebrow);
  }
  for (const name of ['hackathon-hero','hackathon-card']) {
    for (const ext of ['.gif','-still.png']) assert.ok(fs.existsSync(path.join(root,`public/assets/${name}${ext}`)));
  }
  // The original white character is intentionally not replaced by this overlay package.
  assert.match(html,/src="assets\/character\.png"/);
  for (const phrase of ['AI와 맞짱뜨기','인간 개발자 VS AI','해커톤에서 붙어보자','AI에게 도전장 보내기','모의 피싱 시연용·실제 이벤트 아님']) {
    assert.ok(html.includes(phrase),phrase);
  }
  assert.ok(ADS.some(ad=>ad.headline.includes('해커톤 도전자 등장')));
  assert.ok(ADS.some(ad=>ad.detail.includes('디버깅 지옥에서 살아남기')));
});

test('motion control replaces GIF source with real static PNG; OS preference overrides', () => {
  assert.match(script, /window\.matchMedia\('\(prefers-reduced-motion: reduce\)'\)/);
  assert.match(script, /!media\.matches && motionChoice !== false/);
  assert.match(script, /animated \? 'gif' : 'png'/);
  assert.match(script, /'retro-motion-change'/);
  assert.match(script, /document\.removeEventListener\('retro-motion-change'/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
  assert.match(css, /:host\(\[motion="off"\]\) \.ad-tile:after/);
});

test('warning, no data collection and strict CSP preserved', () => {
  assert.match(html,/모의 피싱 시연용·실제 이벤트 아님/);
  assert.match(html,/<meta name="robots" content="noindex, nofollow">/);
  assert.doesNotMatch(html, /<(?:form|input|textarea|iframe)\b/i);
  assert.doesNotMatch(script, /\b(?:fetch|XMLHttpRequest|sendBeacon|WebSocket|localStorage|sessionStorage)\b/);
  for (const rule of ["default-src 'self'", "connect-src 'none'", "form-action 'none'", "base-uri 'none'"]) assert.ok(html.includes(rule));
  for (const val of ['실제 참가 신청', '당첨금', '카지노','한게임포커']) assert.equal(html.includes(val)||ADS.some(x=>Object.values(x).some(v=>v.includes(val))),false,val);
});

test('Vercel deployment and original security headers remain intact', () => {
  assert.equal(config.framework,null);
  assert.equal(config.outputDirectory,'public');
  assert.equal(config.buildCommand,'');
  const headers = config.headers[0].headers;
  assert.ok(headers.some(x=>x.key==='X-Robots-Tag'&&x.value==='noindex, nofollow'));
  const csp = headers.find(x=>x.key==='Content-Security-Policy').value;
  for (const rule of ["connect-src 'none'", "frame-ancestors 'none'", "form-action 'none'"]) assert.ok(csp.includes(rule));
});

test('all banner tiles are activatable and the modal has accessible controls',()=>{
  assert.match(script, /requestExplanation\(button\)/);
  assert.match(script, /\{ bubbles: true, composed: true \}/);
  assert.match(html, /<dialog id="explanation" aria-labelledby="dialog-title" aria-describedby="dialog-description"/);
  assert.match(html, /id="close-dialog"/);
  assert.match(html, /id="confirm-dialog"/);
  assert.match(css,/button:focus-visible/);
});
