import asyncio
import json
import subprocess
import time
import urllib.request
import websockets

async def run_test():
    proc = subprocess.Popen([
        r'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe',
        '--headless=new',
        '--remote-debugging-port=9223',
        'http://127.0.0.1:8000'
    ])
    try:
        await asyncio.sleep(2)
        req = urllib.request.urlopen('http://127.0.0.1:9223/json')
        targets = json.loads(req.read().decode())
        print("All targets:")
        for t in targets:
            print("  ", t['type'], t['url'], t.get('title'))
        page_target = next(t for t in targets if t['type'] == 'page')
        ws_url = page_target['webSocketDebuggerUrl']
        print(f"Connecting to {ws_url}...")

        async with websockets.connect(ws_url) as ws:
            msg_id = 0
            async def send(method, params=None):
                nonlocal msg_id
                msg_id += 1
                payload = {"id": msg_id, "method": method, "params": params or {}}
                await ws.send(json.dumps(payload))
                return msg_id

            await send("Console.enable")
            await send("Runtime.enable")
            await send("Page.enable")
            await send("Network.enable")
            await send("Page.navigate", {"url": "http://127.0.0.1:8000/"})

            async def eval_js(expr):
                nonlocal msg_id
                msg_id += 1
                req_id = msg_id
                await ws.send(json.dumps({
                    "id": req_id,
                    "method": "Runtime.evaluate",
                    "params": {"expression": expr, "returnByValue": True}
                }))
                while True:
                    resp = json.loads(await ws.recv())
                    if resp.get("id") == req_id:
                        res_obj = resp.get("result", {})
                        if "exceptionDetails" in res_obj:
                            print("EVAL EXCEPTION:", res_obj["exceptionDetails"].get("exception", {}).get("description"))
                        return res_obj.get("result", {}).get("value")
                    if resp.get("method") == "Console.messageAdded":
                        print("CONSOLE:", resp["params"]["message"]["text"])
                    elif resp.get("method") == "Runtime.consoleAPICalled":
                        args = [str(a.get("value")) for a in resp["params"]["args"]]
                        print("CONSOLE API:", resp["params"]["type"], " ".join(args))
                    elif resp.get("method") == "Runtime.exceptionThrown":
                        print("EXCEPTION:", resp["params"]["exceptionDetails"].get("exception", {}).get("description"))

            # Poll until PinLock is defined
            for attempt in range(30):
                pin_exists = await eval_js("typeof PinLock !== 'undefined'")
                if pin_exists:
                    print(f"PinLock ready after attempt {attempt}")
                    break
                await asyncio.sleep(0.5)

            cur_url = await eval_js("window.location.href")
            print("Current URL:", cur_url)
            pin_exists = await eval_js("typeof PinLock !== 'undefined'")
            print("PinLock defined?:", pin_exists)

            # Submit PIN 1234
            res = await eval_js("PinLock.enterDigit('1'); PinLock.enterDigit('2'); PinLock.enterDigit('3'); PinLock.enterDigit('4'); PinLock.submitPin(); 'logged in'")
            print("Pin login result:", res)
            await asyncio.sleep(1.5)

            # Check active tab
            active_tab = await eval_js("App.currentTab")
            print("Initial active tab:", active_tab)

            # Now click Notes tab button
            print("\n--- Clicking Notes Tab ---")
            await eval_js("document.querySelector(\".nav-tabs .tab-btn[data-tab='notes']\").click()")
            for i in range(5):
                await asyncio.sleep(0.3)
                cur = await eval_js("App.currentTab")
                pane_notes = await eval_js("document.getElementById('tabNotes').className")
                notes_rect = await eval_js("JSON.stringify(document.getElementById('tabNotes').getBoundingClientRect())")
                notes_cont_rect = await eval_js("JSON.stringify(document.querySelector('.notes-container').getBoundingClientRect())")
                print(f"Time +{0.3*(i+1):.1f}s: currentTab={cur}, tabNotes={pane_notes}, notes_rect={notes_rect}, cont_rect={notes_cont_rect}")

            # Now click Guide tab button
            print("\n--- Clicking Guide Tab ---")
            await eval_js("document.querySelector(\".nav-tabs .tab-btn[data-tab='guide']\").click()")
            for i in range(5):
                await asyncio.sleep(0.3)
                cur = await eval_js("App.currentTab")
                pane_guide = await eval_js("document.getElementById('tabGuide').className")
                guide_rect = await eval_js("JSON.stringify(document.getElementById('tabGuide').getBoundingClientRect())")
                guide_cont_rect = await eval_js("JSON.stringify(document.querySelector('.guide-container').getBoundingClientRect())")
                print(f"Time +{0.3*(i+1):.1f}s: currentTab={cur}, tabGuide={pane_guide}, guide_rect={guide_rect}, cont_rect={guide_cont_rect}")

            # Now click Timeline tab multiple times
            print("\n--- Clicking Timeline Tab 3 times ---")
            for click_num in range(1, 4):
                await eval_js("document.querySelector(\".nav-tabs .tab-btn[data-tab='timeline']\").click()")
                await asyncio.sleep(0.5)
                scroll_count = await eval_js("document.querySelectorAll('.unified-timeline-container').length")
                header_vis = await eval_js("document.querySelector('.timeline-header-bar').offsetHeight")
                print(f"Click {click_num}: unified-timeline-container count={scroll_count}, header height={header_vis}")

    finally:
        proc.terminate()

if __name__ == "__main__":
    asyncio.run(run_test())
