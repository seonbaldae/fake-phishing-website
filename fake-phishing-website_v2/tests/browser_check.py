"""Real Chromium behavior tests with strictly in-memory test assets; the deployed code keeps CSP."""
from pathlib import Path
import asyncio, json, re, base64
from PIL import Image, ImageChops
from io import BytesIO
from playwright.async_api import async_playwright

ROOT = Path(__file__).resolve().parents[1]
PUBLIC = ROOT / 'public'
CSS=(PUBLIC/'styles.css').read_text()
ADS=(PUBLIC/'ads.js').read_text().replace('export const ADS =','const ADS =',1)
DATA={}
for f in (PUBLIC/'assets').rglob('*'):
    if f.suffix.lower() in ('.png','.gif'):
        DATA[f.relative_to(PUBLIC).as_posix()]='data:image/'+('gif' if f.suffix=='.gif' else 'png')+';base64,'+base64.b64encode(f.read_bytes()).decode()
# Original character is not shipped in the overlay, and must remain untouched in the repository.
DATA['assets/character.png']='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jNgMAAAAASUVORK5CYII='
HTML=(PUBLIC/'index.html').read_text()
HTML=re.sub(r'<meta http-equiv="Content-Security-Policy"[^>]*>', '', HTML)
HTML=re.sub(r'<script type="module" src="app.js"></script>', '', HTML)
HTML=re.sub(r'<link rel="stylesheet" href="styles.css">', '<style>'+CSS+'</style>', HTML)
HTML=HTML.replace('src="assets/character.png"','src="'+DATA['assets/character.png']+'"')
APP=(PUBLIC/'app.js').read_text().replace("import { ADS } from './ads.js';",ADS,1)
APP=APP.replace("const stylesheet = document.createElement('link');\n    stylesheet.rel = 'stylesheet';\n    stylesheet.href = 'styles.css';", "const stylesheet = document.createElement('style');\n    stylesheet.textContent = "+json.dumps(CSS)+";")
APP=APP.replace("image.setAttribute('src', asset)", "image.setAttribute('src', IMAGES[asset])")
APP=APP.replace("image.setAttribute('src', `assets/tiles/${id}.png`)", "image.setAttribute('src', IMAGES[`assets/tiles/${id}.png`])")
APP="const IMAGES="+json.dumps(DATA)+";\n"+APP

async def main():
    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True, executable_path='/usr/bin/chromium', args=['--no-sandbox'])
        async def run(width, height, reduced_motion=False):
            context = await browser.new_context(viewport={'width':width,'height':height}, reduced_motion='reduce' if reduced_motion else 'no-preference', service_workers='block')
            page = await context.new_page()
            errors=[]
            page.on('pageerror', lambda err: errors.append(str(err)))
            await page.set_content(HTML,wait_until='load')
            await page.add_script_tag(content=APP)
            await page.locator('retro-ad-board').wait_for()
            await page.wait_for_timeout(150)
            assert not errors,errors
            board=page.locator('retro-ad-board')
            tiles=board.locator('retro-ad-tile')
            assert await tiles.count()==39,await tiles.count()
            assert await board.locator('retro-ad-banner').count()==1
            assert await board.locator('prize-ticket').count()==1
            assert await page.locator('demo-banner').locator('strong').count()==1
            main_banner=page.locator('prize-hero').locator('retro-ad-banner').locator('img')
            url=await main_banner.get_attribute('src')
            assert url.startswith('data:image/png' if reduced_motion else 'data:image/gif'), url
            if not reduced_motion and width > 700:
                screenshot_before=Image.open(BytesIO(await main_banner.screenshot())).convert('RGB')
                await page.wait_for_timeout(1900)
                screenshot_after=Image.open(BytesIO(await main_banner.screenshot())).convert('RGB')
                assert ImageChops.difference(screenshot_before,screenshot_after).getbbox(), 'GIF frame did not change in Chromium'
            # All banner interactions must open the original native <dialog>.
            dialog=page.locator('explanation-dialog').locator('dialog')
            first=tiles.first.locator('button')
            await first.focus()
            await page.keyboard.press('Enter')
            assert await dialog.evaluate('(d)=>d.open')
            await page.keyboard.press('Escape')
            assert not await dialog.evaluate('(d)=>d.open')
            assert await first.evaluate('(b)=>b.getRootNode().activeElement===b')
            # CTA reuses same modal and close buttons.
            hero_button=page.locator('prize-hero').locator('#claim-button')
            await hero_button.click()
            assert await dialog.evaluate('(d)=>d.open')
            await dialog.locator('#confirm-dialog').click()
            assert not await dialog.evaluate('(d)=>d.open')
            assert await hero_button.evaluate('(b)=>b.getRootNode().activeElement===b')
            toggle=page.locator('site-header').locator('retro-motion-toggle').locator('button')
            if reduced_motion:
                assert await toggle.is_disabled()
                assert (await main_banner.get_attribute('src')).startswith('data:image/png')
            else:
                await toggle.click()
                assert (await main_banner.get_attribute('src')).startswith('data:image/png')
                await toggle.click()
                assert (await main_banner.get_attribute('src')).startswith('data:image/gif')
            overflow=await page.evaluate('document.documentElement.scrollWidth>innerWidth')
            assert not overflow,f'Horizontal overflow at {width}'
            await page.screenshot(path=str(ROOT/f'preview-{width}-{height}.png'),full_page=True)
            print(f'PASS: Chromium {width}x{height}, reduced={reduced_motion}, 39 tiles, native dialog, focus, GIF/PNG, overflow')
            await context.close()
        await run(1280,900)
        await run(390,844)
        await run(390,844,True)
        await browser.close()

if __name__=='__main__':
    asyncio.run(main())
