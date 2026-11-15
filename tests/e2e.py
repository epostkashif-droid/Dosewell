"""Browser tests for Dosewell: user flows, hostile data, layout breakage and random tapping.
Run: npm run build && python3 tests/e2e.py   (needs: pip install playwright; a Chrome/Chromium binary)"""
import asyncio, json, os, random, subprocess, sys, time
from playwright.async_api import async_playwright
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CHROME = os.environ.get("CHROME", "/usr/bin/google-chrome")
URL = "http://localhost:8766/index.html"
XSS = ['<img src=x onerror=window.__xss=1>', '"><script>window.__xss=1</script>', "'><svg onload=window.__xss=1>", '</textarea><img src=x onerror=window.__xss=1>', 'javascript:window.__xss=1', '" autofocus onfocus="window.__xss=1', '&lt;b&gt;' + 'W' * 70]
results, errors = [], []
def check(name, ok, detail=""):
    results.append((name, bool(ok), detail)); print(("PASS " if ok else "FAIL ") + name + ((" :: " + str(detail)) if detail and not ok else ""))

def hostile_state():
    x = lambda i: XSS[i % len(XSS)]
    today = time.strftime("%Y-%m-%d")
    st = {"people": [{"id": "p%d" % i, "name": x(i), "relation": "Mother", "color": i, "blood": "B+", "allergies": x(i + 1), "conditions": x(i + 2), "doctor": x(i + 3), "doctorPhone": x(i + 4)} for i in range(6)],
          "meds": [{"id": "m%d" % i, "personId": "p%d" % (i % 6), "name": x(i), "strength": x(i + 1), "form": "Tablet", "qty": 1, "times": ["00:05", "08:00", "13:00", "23:55"], "days": [0, 1, 2, 3, 4, 5, 6], "food": "After food", "start": "2026-01-01", "end": "", "stock": 2, "notes": x(i + 2), "active": True, "created": 0} for i in range(8)],
          "logs": {today: {"m0|00:05": "t0005", "m1|00:05": "s"}},
          "contacts": [{"id": "c%d" % i, "name": x(i), "relation": x(i + 1), "phone": '+91 98400 1234%d"><img src=x onerror=window.__xss=1>' % i, "guardian": True} for i in range(3)],
          "settings": {"onboarded": True, "threshold": 2, "cc": '91"><img src=x onerror=window.__xss=1>', "ack": {"p0": x(0)}}, "updatedAt": 1}
    px = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="
    recs = [{"id": "r1", "title": x(0), "type": "Prescription", "date": today, "personId": "p0", "note": x(1), "img": px},
            {"id": "r2", "title": "evil1", "img": px + '" onerror="window.__xss=1'}, {"id": "r3", "title": "evil2", "img": "javascript:window.__xss=1"},
            {"id": "r4", "title": "evil3", "img": "data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9IndpbmRvdy5fX3hzcz0xIj48L3N2Zz4="}, {"id": 'r5"><img src=x onerror=window.__xss=1>', "title": "evil id", "img": px}]
    return st, recs

async def dom_is_clean(pg):
    return await pg.evaluate("""() => { const bad = []; if (window.__xss) bad.push('script ran');
      for (const el of document.querySelectorAll('*')) { for (const a of el.attributes) { if (/^on/i.test(a.name)) bad.push(el.tagName + ' ' + a.name); if (/^(href|src)$/.test(a.name) && /^\\s*javascript:/i.test(a.value)) bad.push('js url'); } }
      if (document.querySelectorAll('script').length > 1) bad.push('extra script'); if (document.querySelector('#app script, #panel script, #app iframe, #panel iframe, #app object')) bad.push('injected element'); return bad; }""")
async def no_overflow(pg):
    return await pg.evaluate("() => document.documentElement.scrollWidth <= window.innerWidth + 1")
TABS = ["today", "meds", "records", "progress", "more"]
async def goto_tab(pg, t):
    await pg.evaluate("h => { location.hash = h }", "#" + t); await pg.wait_for_timeout(120)

async def new_page(b, width=390, height=844, init=None, **kw):
    ctx = await b.new_context(viewport={"width": width, "height": height}, **kw); pg = await ctx.new_page()
    await pg.add_init_script("window.__DOSEWELL_TEST__ = true;" + (init or ""))
    pg.on("pageerror", lambda e: errors.append(str(e)))
    pg.on("console", lambda m: errors.append("console: " + m.text) if m.type == "error" and "Content Security Policy" not in m.text else None)
    await pg.goto(URL); await pg.wait_for_timeout(400); return ctx, pg

async def flow(b):
    ctx, pg = await new_page(b)
    check("first run shows onboarding, navigation hidden", await pg.is_visible("text=Never miss a dose") and not await pg.is_visible("#navwrap"))
    await pg.click('[data-a="onb-next"]'); await pg.click('[data-a="onb-accept"]')
    check("cannot continue without accepting the disclaimer", await pg.is_visible("text=Before you begin"))
    await pg.check("#onb-ok"); await pg.click('[data-a="onb-accept"]')
    await pg.fill("#p-name", "Amma"); await pg.select_option("#p-rel", "Mother"); await pg.click('form[data-form="person"] .btn.primary')
    check("onboarding ends on Today with an add-medicine prompt", await pg.is_visible("text=No medicines yet"))
    await pg.click("#fab"); await pg.fill("#m-name", "Metformin"); await pg.fill("#m-str", "500 mg")
    await pg.fill('#times input[type=time]', "00:00"); await pg.click('[data-a="add-time"]'); await pg.locator('#times input[type=time]').nth(1).fill("23:59")
    await pg.fill("#m-stock", "3"); await pg.click('form[data-form="med"] .btn.primary'); await pg.wait_for_timeout(200)
    rows = await pg.locator(".dose").count()
    check("a medicine added today lists only doses still ahead (no instant misses)", rows >= 1 and not await pg.is_visible(".pill.bad"), rows)
    await pg.locator(".dose .tick").first.click(); await pg.wait_for_timeout(150)
    check("one tap marks a dose taken", await pg.locator(".dose.is-taken").count() == 1)
    st = await pg.evaluate("() => window.__dosewell.get()")
    check("stock decreases when taken", st["meds"][0]["stock"] == 2, st["meds"][0]["stock"])
    await pg.reload(); await pg.wait_for_timeout(400)
    check("data survives a restart", await pg.locator(".dose.is-taken").count() == 1)
    await pg.locator(".dose.is-taken .tick").click(); await pg.click('[data-a="undo"]'); await pg.wait_for_timeout(150)
    st = await pg.evaluate("() => window.__dosewell.get()")
    check("undo restores the dose and the stock", await pg.locator(".dose.is-taken").count() == 0 and st["meds"][0]["stock"] == 3)
    # validation
    await pg.click("#fab"); await pg.fill("#m-name", "   "); await pg.click('form[data-form="med"] .btn.primary'); await pg.wait_for_timeout(100)
    check("blank medicine name is rejected", await pg.is_visible("#m-name"))
    await pg.fill("#m-name", "X"); await pg.fill("#m-start", "2026-12-10"); await pg.fill("#m-end", "2026-12-01"); await pg.click('form[data-form="med"] .btn.primary'); await pg.wait_for_timeout(100)
    check("end date before start date is rejected", await pg.is_visible("#m-name"))
    await pg.keyboard.press("Escape"); check("Escape closes a sheet", not await pg.is_visible("#panel"))
    # contact + guardian
    await goto_tab(pg, "more"); await pg.click('[data-a="edit-contact"]'); await pg.fill("#c-name", "Imran"); await pg.fill("#c-ph", "98400 12345"); await pg.click('form[data-form="contact"] .btn.primary'); await pg.wait_for_timeout(100)
    check("first contact defaults to guardian", await pg.is_visible(".pill.ok >> text=Guardian"))
    # export/import round trip through the real file input
    st = await pg.evaluate("() => JSON.stringify({app:'dosewell',format:1,state:window.__dosewell.get(),records:[]})")
    path = "/tmp/dw-backup.json"; open(path, "w").write(st)
    await pg.click('[data-a="ask-reset"]'); await pg.click('[data-a="reset"]'); await pg.wait_for_timeout(300)
    check("erase everything returns to first run", await pg.is_visible("text=Never miss a dose") and (await pg.evaluate("() => window.__dosewell.get().people.length")) == 0)
    await pg.reload(); await pg.wait_for_timeout(300); check("erased data stays erased after restart", await pg.is_visible("text=Never miss a dose"))
    await pg.evaluate("() => window.__dosewell.load({settings:{onboarded:true}}, [])"); await goto_tab(pg, "more")
    await pg.set_input_files("#imp", path); await pg.wait_for_timeout(300); await pg.click('[data-a="do-import"]'); await pg.wait_for_timeout(300)
    st2 = await pg.evaluate("() => window.__dosewell.get()")
    check("backup restores people, medicines and contacts", len(st2["people"]) == 1 and len(st2["meds"]) == 1 and len(st2["contacts"]) == 1)
    for name, body in [("empty", ""), ("not json", "{{{"), ("wrong app", '{"app":"other","state":{}}'), ("array", "[1,2,3]"), ("null", "null"), ("deep", "[" * 5000 + "]" * 5000), ("proto", '{"app":"dosewell","state":{"__proto__":{"x":1},"people":"x"}}')]:
        p = "/tmp/dw-bad.json"; open(p, "w").write(body); await pg.set_input_files("#imp", p); await pg.wait_for_timeout(150)
        if name == "proto": await pg.click('[data-a="close"]', force=True)
    st3 = await pg.evaluate("() => window.__dosewell.get()")
    check("broken or foreign backup files are refused and change nothing", len(st3["people"]) == 1 and len(st3["meds"]) == 1)
    await ctx.close()

async def guardian(b):
    ctx, pg = await new_page(b)
    await pg.evaluate("""() => { const d = new Date(); d.setDate(d.getDate() - 3); const s = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
      window.__dosewell.load({ people: [{id:'p1',name:'Amma',relation:'Mother'}], meds: [{id:'m1',personId:'p1',name:'Metformin',times:['00:00'],days:[0,1,2,3,4,5,6],start:s,form:'Tablet',food:'After food'}], contacts: [{id:'c1',name:'Imran',phone:'98400 12345',guardian:true}], settings:{onboarded:true} }, []) }""")
    await pg.wait_for_timeout(200)
    check("guardian banner appears after 3 missed doses in a row", await pg.is_visible("text=has missed"))
    await pg.click('[data-a="guardian"]')
    href = await pg.get_attribute('#panel a.btn.primary', 'href')
    check("WhatsApp link carries the guardian's number with country code and the message", href.startswith("https://wa.me/919840012345?text=") and "missed" in href, href[:80])
    await pg.click('#panel [data-a="ack"]'); await pg.wait_for_timeout(150)
    check("banner hides once the guardian is told", not await pg.is_visible("text=has missed"))
    await ctx.close()

async def injection(b):
    ctx, pg = await new_page(b)
    st, recs = hostile_state()
    await pg.evaluate("([s, r]) => window.__dosewell.load(s, r)", [st, recs]); await pg.wait_for_timeout(200)
    kept = await pg.evaluate("() => document.querySelectorAll('.rec').length") if False else None
    for t in TABS:
        await goto_tab(pg, t); bad = await dom_is_clean(pg); check("hostile text renders as text on " + t, not bad, bad)
        n = await pg.locator("#app [data-a]").count()
        for i in range(min(n, 60)):
            el = pg.locator("#app [data-a]").nth(i)
            try:
                a = await el.get_attribute("data-a", timeout=500)
                if a in ("ask-reset", "start-fresh", "export", "who", "day", "rtype", "theme", "take", "ask-notif", "ask-exact"): continue
                await el.click(timeout=800); await pg.wait_for_timeout(60)
                bad = await dom_is_clean(pg)
                if bad: check("hostile text in sheet opened by " + str(a), False, bad)
                if await pg.is_visible("#alarm.open"): await pg.click('[data-a="alarm-close"]')
                if await pg.is_visible("#sheet.open"): await pg.keyboard.press("Escape")
            except Exception: pass
        await goto_tab(pg, t)
    await goto_tab(pg, "records")
    check("records with forged image data are dropped, the valid one is kept", await pg.locator(".rec").count() == 1, await pg.locator(".rec").count())
    await goto_tab(pg, "more"); await pg.locator('[data-a="ecard"]').first.click(); bad = await dom_is_clean(pg); check("emergency card escapes every field", not bad, bad)
    tel = await pg.evaluate("() => [...document.querySelectorAll('a[href^=\"tel:\"]')].map(a => a.getAttribute('href'))")
    check("phone links contain digits only", all(__import__('re').fullmatch(r"tel:\+?\d*", h) for h in tel), tel)
    await pg.keyboard.press("Escape")
    await goto_tab(pg, "today"); await pg.wait_for_timeout(100)
    if await pg.is_visible('[data-a="guardian"]'):
        await pg.locator('[data-a="guardian"]').first.click(); bad = await dom_is_clean(pg); check("guardian sheet escapes every field", not bad, bad)
        hrefs = await pg.evaluate("() => [...document.querySelectorAll('#panel a')].map(a => a.getAttribute('href'))")
        check("guardian links are only wa.me, sms: or tel:", all(h.startswith(("https://wa.me/", "sms:", "tel:")) for h in hrefs), hrefs); await pg.keyboard.press("Escape")
    # forged attributes reaching action handlers
    await pg.evaluate("""() => { const b = document.createElement('button'); b.dataset.a = '__proto__'; document.body.appendChild(b); b.click(); b.dataset.a = 'constructor'; b.click(); b.dataset.a = 'take'; b.dataset.d = '<x>'; b.dataset.k = 'm0|<x>'; b.click(); b.dataset.a = 'day'; b.dataset.d = '2999-01-01'; b.click(); b.dataset.a='who'; b.dataset.id='"><img src=x onerror=window.__xss=1>'; b.click(); b.remove(); }""")
    await pg.wait_for_timeout(100); bad = await dom_is_clean(pg); check("forged action attributes are ignored", not bad, bad)
    blocked = await pg.evaluate("""async () => { const d = document.createElement('div'); d.innerHTML = '<img src="data:image/png;base64,AAAA" onerror="window.__csp=1">'; document.body.appendChild(d); const s = document.createElement('script'); s.textContent = 'window.__csp=1'; document.body.appendChild(s); await new Promise(r => setTimeout(r, 300)); d.remove(); s.remove(); let net = 'blocked'; try { await fetch('https://example.com/', {mode:'no-cors'}); net = 'allowed'; } catch (e) {} return [window.__csp === undefined, net]; }""")
    check("content security policy blocks inline script even if markup were injected", blocked[0])
    check("content security policy blocks outbound network requests", blocked[1] == "blocked", blocked[1])
    await ctx.close()

async def layout(b):
    st, recs = hostile_state()
    for w, scheme in [(320, "light"), (360, "dark"), (412, "light"), (768, "light")]:
        ctx, pg = await new_page(b, width=w, height=740, color_scheme=scheme)
        await pg.evaluate("([s, r]) => window.__dosewell.load(s, r)", [st, recs]); await pg.wait_for_timeout(150)
        for t in TABS:
            await goto_tab(pg, t); check(f"no sideways scroll at {w}px on {t} with 70-character unbroken text", await no_overflow(pg))
        await goto_tab(pg, "meds"); await pg.click("#fab"); await pg.wait_for_timeout(100)
        ok = await pg.evaluate("() => { const p = document.querySelector('#panel'); return p.scrollWidth <= p.clientWidth + 1 }"); check(f"medicine form fits at {w}px", ok); await pg.keyboard.press("Escape")
        await ctx.close()
    ctx, pg = await new_page(b)
    await pg.evaluate("([s, r]) => window.__dosewell.load(s, r)", [st, recs])
    small = []
    for t in TABS:
        await goto_tab(pg, t)
        small += await pg.evaluate("""() => [...document.querySelectorAll('#app button, #app a.btn, #nav a, #fab, #app select, #app input:not([type=checkbox]):not([type=file])')].filter(e => e.offsetParent).map(e => [e.getBoundingClientRect(), (e.dataset.a || e.id || e.tagName)]).filter(([r]) => r.height < 40 || r.width < 40).map(([r, n]) => n + ' ' + Math.round(r.width) + 'x' + Math.round(r.height))""")
    check("every tappable control is at least 40px", not small, sorted(set(small))[:8])
    unl = []
    for opener in [("meds", "#fab"), ("more", '[data-a="edit-person"]'), ("more", '[data-a="edit-contact"]'), ("records", "#fab")]:
        await goto_tab(pg, opener[0]); await pg.locator(opener[1]).first.click(); await pg.wait_for_timeout(80)
        unl += await pg.evaluate("""() => [...document.querySelectorAll('#panel input:not([type=file]), #panel select')].filter(e => !(e.labels && e.labels.length) && !e.getAttribute('aria-label')).map(e => e.id || e.name)""")
        await pg.keyboard.press("Escape")
    await goto_tab(pg, "more"); unl += await pg.evaluate("""() => [...document.querySelectorAll('#app input:not([type=file]), #app select')].filter(e => !(e.labels && e.labels.length) && !e.getAttribute('aria-label')).map(e => e.id)""")
    check("every form field has a label", not unl, unl)
    await ctx.close()

async def resilience(b):
    ctx, pg = await new_page(b, init="Storage.prototype.setItem = function(){ throw new DOMException('full','QuotaExceededError') }; Storage.prototype.getItem = function(){ throw new Error('blocked') }; try { delete window.indexedDB } catch (e) {}")
    await pg.click('[data-a="onb-next"]'); await pg.check("#onb-ok"); await pg.click('[data-a="onb-accept"]'); await pg.click('[data-a="try-sample"]'); await pg.wait_for_timeout(200)
    check("app still works when the phone refuses storage", await pg.locator(".dose").count() > 0)
    await ctx.close()
    for junk in ['not json', '{"people":"x","meds":7}', '[]', '{"v":1,"people":[{"id":"p1","name":"A"}],"meds":[{"id":"m1","personId":"p1","name":"M","times":["99:99"]}],"logs":"x"}', '"' + "A" * 200000 + '"']:
        ctx, pg = await new_page(b, init="try { localStorage.setItem('dosewell_state_v2', %s) } catch (e) {}" % json.dumps(junk))
        ok = await pg.is_visible("#app") and (await pg.evaluate("() => document.querySelector('#app').children.length")) > 0
        check("corrupted saved data cannot crash start-up: " + junk[:24], ok); await ctx.close()

async def monkey(b):
    random.seed(1114); st, recs = hostile_state()
    ctx, pg = await new_page(b); await pg.evaluate("([s, r]) => window.__dosewell.load(s, r)", [st, recs])
    before = len(errors); taps = 0
    for i in range(700):
        try:
            if i % 9 == 0: await goto_tab(pg, random.choice(TABS))
            els = pg.locator("[data-a]:visible, #nav a:visible, input:visible, select:visible, summary:visible"); n = await els.count()
            if not n: await pg.evaluate("() => window.__dosewell.load({settings:{onboarded:true}}, [])"); continue
            el = els.nth(random.randrange(n)); tag = await el.evaluate("e => e.tagName + ':' + (e.type || '')", timeout=400)
            if tag.startswith("INPUT:file"): continue
            if tag.startswith("INPUT") and ("checkbox" not in tag): await el.fill(random.choice(["", "x", "9" * 30, XSS[0], "2026-02-31", "25:61", "-5", "1e9", "😀" * 40]), timeout=400, force=True); await pg.keyboard.press("Enter")
            elif tag.startswith("SELECT"): await el.select_option(index=0, timeout=400)
            else: await el.click(timeout=400, force=True)
            taps += 1
            if random.random() < .08: await pg.keyboard.press("Escape")
            if random.random() < .03: await pg.reload(); await pg.wait_for_timeout(200)
        except Exception: pass
    bad = await dom_is_clean(pg)
    check(f"{taps} random taps and junk entries cause no script errors", len(errors) == before, errors[before:before + 3])
    check("random tapping leaves no injected markup", not bad, bad)
    st = await pg.evaluate("() => JSON.stringify(window.__dosewell.get())"); check("saved data is still valid after random tapping", len(st) < 300000 and json.loads(st)["v"] == 1)
    await ctx.close()

STUB = """
window.__calls = []; window.__store = {state: '', recs: {}, pending: '[]', allowed: false};
const rec = (n, a) => window.__calls.push([n].concat(Array.from(a)));
window.DosewellNative = {
  status(){ return JSON.stringify({supported:true, allowed: window.__store.allowed, asked:false, exact:true}) },
  askNotif(){ rec('askNotif', arguments); window.__store.allowed = true; setTimeout(() => window.__dwResume && window.__dwResume(), 50) },
  askExact(){ rec('askExact', arguments) }, schedule(j){ rec('schedule', arguments) }, cancelAll(){ rec('cancelAll', arguments) },
  takePending(){ const p = window.__store.pending; window.__store.pending = '[]'; return p }, setSnooze(m){ rec('setSnooze', arguments) }, clearDelivered(i){ rec('clearDelivered', arguments) },
  saveState(j){ window.__store.state = j; try { sessionStorage.setItem('nstate', j) } catch (e) {} }, loadState(){ try { return sessionStorage.getItem('nstate') || '' } catch (e) { return '' } },
  recordIds(){ return JSON.stringify(Object.keys(window.__store.recs)) }, readRecord(i){ return window.__store.recs[i] || '' }, writeRecord(i, j){ window.__store.recs[i] = j; return true }, deleteRecord(i){ delete window.__store.recs[i] },
  copy(t){ rec('copy', arguments) }, shareText(t){ rec('shareText', arguments) }, shareImage(b, t){ rec('shareImage', [b.length, t]) }, shareFile(n, t){ rec('shareFile', [n, t.length]) }, bars(d, c){ rec('bars', arguments) }
};
"""
async def android_shell(b):
    """The page exactly as the Android app loads it: from file://, with the phone bridge present."""
    ctx = await b.new_context(viewport={"width": 390, "height": 844}); pg = await ctx.new_page()
    await pg.add_init_script("window.__DOSEWELL_TEST__ = true;" + STUB)
    pg.on("pageerror", lambda e: errors.append("shell: " + str(e))); csp = []
    pg.on("console", lambda m: csp.append(m.text) if m.type == "error" else None)
    await pg.goto("file://" + os.path.join(ROOT, "www", "index.html")); await pg.wait_for_timeout(500)
    check("app starts from local files under its security policy", await pg.is_visible("text=Never miss a dose"), csp[:2])
    font = await pg.evaluate("async () => { await document.fonts.ready; return document.fonts.check('16px Jakarta') }")
    check("bundled font loads without any network or file fetch", font)
    await pg.click('[data-a="onb-next"]'); await pg.check("#onb-ok"); await pg.click('[data-a="onb-accept"]')
    await pg.fill("#p-name", "Amma"); await pg.click('form[data-form="person"] .btn.primary'); await pg.wait_for_timeout(200)
    check("first run asks for notification permission with an explanation", await pg.is_visible("text=Turn on reminders"))
    await pg.click('#panel [data-a="ask-notif"]'); await pg.wait_for_timeout(300)
    await pg.click("#fab"); await pg.fill("#m-name", "Metformin"); await pg.fill('#times input[type=time]', "23:59"); await pg.click('form[data-form="med"] .btn.primary'); await pg.wait_for_timeout(1600)
    calls = await pg.evaluate("() => window.__calls"); sched = [c for c in calls if c[0] == "schedule"]
    plan = json.loads(sched[-1][1]) if sched else []
    doses = [x for x in plan if x.get("k")]
    check("saving a medicine schedules phone reminders 30 days ahead", 28 <= len(doses) <= 31, len(doses))
    ok = all(isinstance(x["id"], int) and 0 < x["id"] < 1000000000 and x["at"] > time.time() * 1000 and x["title"] and x["fu"] == 45 for x in doses) and len(set(x["id"] for x in plan)) == len(plan)
    check("every reminder has a unique id, a future time, a title and a 45-minute follow-up", ok)
    check("the plan ends with a nudge to reopen the app", plan and plan[-1].get("plain") is True and plan[-1]["at"] > doses[-1]["at"])
    check("times are in ascending order", all(plan[i]["at"] <= plan[i + 1]["at"] for i in range(len(plan) - 1)))
    # a dose marked Taken on the notification while the app was closed
    d = doses[0]
    await pg.evaluate("p => { window.__store.pending = JSON.stringify([p, {d:'<x>',k:'m|1',t:'9999'}, null, {d:p.d,k:'ghost|08:00',t:'0800'}]); window.__dwResume() }", {"d": d["d"], "k": d["k"], "t": "2359"})
    await pg.wait_for_timeout(300); st = await pg.evaluate("() => window.__dosewell.get()")
    check("Taken pressed on a notification is recorded when the app opens; forged entries are ignored", st["logs"].get(d["d"], {}) == {d["k"]: "t2359"}, st["logs"])
    check("state is mirrored to the phone's own storage", "Metformin" in await pg.evaluate("() => window.__store.state"))
    await pg.evaluate("() => { document.querySelector('#m-name') || 0; }")
    back = await pg.evaluate("() => { location.hash = '#more'; return new Promise(r => setTimeout(() => { const a = window.__dwBack(); setTimeout(() => r([a, location.hash, window.__dwBack()]), 100) }, 100)) }")
    check("back button returns to Today, then leaves the app", back[0] is True and back[1] == "#today" and back[2] is False, back)
    await pg.evaluate("() => { location.hash = '#progress' }"); await pg.wait_for_timeout(200); await pg.click('[data-a="share"]'); await pg.wait_for_timeout(400); await pg.click('[data-a="share-native"]'); await pg.click('[data-a="copy-share"]')
    await pg.keyboard.press("Escape"); await pg.evaluate("() => { location.hash = '#more' }"); await pg.wait_for_timeout(200); await pg.click('[data-a="export"]'); await pg.wait_for_timeout(100)
    names = [c[0] for c in await pg.evaluate("() => window.__calls")]
    check("share picture, copy and backup go through the phone bridge", all(n in names for n in ("shareImage", "copy", "shareFile", "bars", "setSnooze")), names[-8:])
    await pg.reload(); await pg.wait_for_timeout(400); await pg.evaluate("() => { location.hash = '#meds' }"); await pg.wait_for_timeout(200)
    check("app restores from the phone's storage after a restart", await pg.is_visible("text=Metformin"))
    check("no security-policy violations while running as the Android app", not [c for c in csp if "Content Security Policy" in c], csp[:2])
    await ctx.close()

async def looks(b):
    """Every look, in light and dark, at narrow and wide widths, with hostile data: no sideways scroll, no script errors."""
    st, recs = hostile_state()
    for sk in ["lilac", "garden", "sunset", "ocean", "clear"]:
        for scheme in ["light", "dark"]:
            ctx, pg = await new_page(b, width=320, height=740, color_scheme=scheme)
            s2 = json.loads(json.dumps(st)); s2["settings"]["skin"] = sk
            await pg.evaluate("([s, r]) => window.__dosewell.load(s, r)", [s2, recs]); await pg.wait_for_timeout(120)
            applied = await pg.evaluate("() => document.documentElement.dataset.skin")
            bad = []
            for t in TABS:
                await goto_tab(pg, t)
                if not await no_overflow(pg): bad.append(t)
            check(f"{sk} {scheme}: look applies and every tab fits 320px", applied == sk and not bad, (applied, bad))
            await ctx.close()
    ctx, pg = await new_page(b)
    await pg.click('[data-a="skin"][data-t="garden"]'); await pg.wait_for_timeout(100)
    check("look can be picked on the welcome screen", await pg.evaluate("() => document.documentElement.dataset.skin") == "garden")
    await pg.click('[data-a="onb-next"]'); await pg.check("#onb-ok"); await pg.click('[data-a="onb-accept"]'); await pg.click('[data-a="try-sample"]'); await pg.wait_for_timeout(150)
    if await pg.is_visible('#alarm.open'): await pg.click('[data-a="alarm-close"]')
    await goto_tab(pg, "more"); await pg.click('[data-a="skin"][data-t="sunset"]'); await pg.wait_for_timeout(100)
    await pg.reload(); await pg.wait_for_timeout(300)
    check("chosen look survives a restart", await pg.evaluate("() => document.documentElement.dataset.skin") == "sunset")
    await pg.evaluate("() => window.__dosewell.load({settings:{onboarded:true, skin:'<script>'}}, [])")
    check("an unknown look falls back to the default", await pg.evaluate("() => document.documentElement.dataset.skin") == "lilac")
    await ctx.close()

async def main():
    srv = subprocess.Popen([sys.executable, "-m", "http.server", "8766", "--directory", os.path.join(ROOT, "www")], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL); time.sleep(1)
    try:
        async with async_playwright() as p:
            b = await p.chromium.launch(executable_path=CHROME, args=["--no-sandbox"])
            for part in (flow, guardian, injection, layout, looks, resilience, android_shell, monkey):
                try: await part(b)
                except Exception as e: check(part.__name__ + " ran to the end", False, repr(e)[:300])
            await b.close()
    finally: srv.terminate()
    check("no uncaught script errors in any test", not errors, errors[:5])
    fails = [r for r in results if not r[1]]; print(f"\n{len(results) - len(fails)} passed, {len(fails)} failed"); json.dump(results, open("/tmp/e2e-results.json", "w")); sys.exit(1 if fails else 0)
asyncio.run(main())
